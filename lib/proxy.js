/**
 * For test, page injection development.
 * A cross-platform programmable Fiddler alternative.
 * You can even replace express.js with it's `flow` function.
 */
const Overview = 'proxy'; // eslint-disable-line

const kit = require('./kit');
const {
    _,
    Promise
} = kit;
const http = require('http');
const https = require('https');
const os = require('os');
const crypto = require('crypto');
const {
    default: flow
} = require('noflow');
const tcpFrame = require('./tcpFrame');
let net = kit.require('net', __dirname);
const {
    Socket
} = net;

const regConnectHost = /([^:]+)(?::(\d+))?/;
const regGzipDeflat = /gzip|deflate/i;

var proxy = {

    agent: new http.Agent,

    httpsAgent: new https.Agent,

    /**
     * A simple request body middleware.
     * It will append a property `reqBody` to `ctx`.
     * It will append a property `body` to `ctx.req`.
     * @params opts {Object} Defaults:
     * ```js
     * {
     *     limit: Infinity,
     *     memoryLimit: 100 * 1024 // 100KB
     * }
     * ```
     * @return {Function} `(ctx) -> Promise`
     * @example
     * ```
     * let kit = require('nokit');
     * let proxy = kit.require('proxy');
     *
     * let app = proxy.flow();
     *
     * app.push(proxy.body());
     *
     * app.push(($) => {
     *     kit.logs($.reqBody);
     * });
     *
     * app.listen(8123);
     * ```
     */
    body(opts) {
        if (opts == null) {
            opts = {};
        }
        _.defaults(opts, {
            limit: Infinity,
            memoryLimit: 100 * 1024
        });

        return function (ctx) {
            if (!ctx.req.readable) {
                return ctx.next();
            }

            return new Promise(function (resolve, reject) {
                let buf = Buffer.alloc(0);
                let len = 0;
                let tmpFile = null;

                ctx.req.on('data', function (chunk) {
                    len += chunk.length;

                    if (len > opts.limit) {
                        reject(new Error('body exceeds max allowed size'));
                        return;
                    }

                    if ((len > opts.memoryLimit) && !tmpFile) {
                        tmpFile = kit.path.join(
                            os.tmpdir(),
                            `nokit-body-${crypto.randomBytes(16).toString('hex')}`
                        );

                        const f = kit.createWriteStream(tmpFile);
                        f.write(buf);
                        f.write(chunk);
                        ctx.req.pipe(f);
                        buf = undefined;
                        return;
                    }

                    return buf = Buffer.concat([buf, chunk]);
                });

                ctx.req.on('error', reject);

                const end = function () {
                    if (buf.length > 0) {
                        ctx.reqBody = buf;
                        ctx.req.body = buf;
                    }

                    return ctx.next().then(resolve, reject);
                };

                return ctx.req.on('end', function () {
                    if (tmpFile) {
                        return kit.readFile(tmpFile).then(
                            function (data) {
                                buf = data;
                                return end();
                            },
                            reject
                        );
                    } else {
                        return end();
                    }
                });
            });
        };
    },


    /**
     * Http CONNECT method tunneling proxy helper.
     * Most times it is used to proxy https and websocket.
     * @param {Object} opts Defaults:
     * ```js
     * {
     *     // If it returns false, the proxy will be ignored.
     *     filter: (req) => true,
     *
     *     handleReqHeaders: (headers) => headers,
     *
     *     host: null, // Optional. The target host force to.
     *     port: null, // Optional. The target port force to.
     *     onError: (err, socket) => {}
     * }
     * ```
     * @return {Function} The connect request handler.
     * @example
     * ```js
     * let kit = require('nokit');
     * let proxy = kit.require('proxy');
     *
     * let app = proxy.flow();
     *
     * // Directly connect to the original site.
     * app.server.on('connect', kit.proxy.connect());
     *
     * app.listen(8123);
     * ```
     */
    connect(opts) {
        let host, port;
        if (opts == null) {
            opts = {};
        }
        _.defaults(opts, {
            filter() {
                return true;
            },
            handleReqHeaders(h) {
                return h;
            },
            host: null,
            port: null,
            onError(err, req, socket) {
                const br = kit.require('brush');
                kit.log(err.toString() + ' -> ' + br.red(req.url));
                return socket.end();
            }
        });

        if (opts.host) {
            if (opts.host.indexOf(':') > -1) {
                [host, port] = Array.from(opts.host.split(':'));
            } else {
                ({
                    host,
                    port
                } = opts);
            }
        }

        return function (req, sock, head) {
            if (!opts.filter(req)) {
                return;
            }

            const isTransparentProxy = req.headers['proxy-connection'];
            const ms = isTransparentProxy ?
                req.url.match(regConnectHost) :
                req.headers.host.match(regConnectHost);

            const psock = new Socket;
            psock.connect(port || ms[2] || 80, host || ms[1], function () {
                if (isTransparentProxy) {
                    sock.write(`\
HTTP/${req.httpVersion} 200 Connection established\r\n\r\n\
`);
                } else { // https or websocket
                    let rawHeaders = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
                    const headers = opts.handleReqHeaders(req.headers);
                    for (let k in headers) {
                        const v = headers[k];
                        rawHeaders += `${k}: ${v}\r\n`;
                    }

                    rawHeaders += '\r\n';

                    psock.write(rawHeaders);
                }

                if (head.length > 0) {
                    psock.write(head);
                }

                sock.pipe(psock);
                return psock.pipe(sock);
            });

            sock.on('error', err => opts.onError(err, req, sock));
            return psock.on('error', function (err) {
                sock.destroy();
                return opts.onError(err, req, psock);
            });
        };
    },

    /**
     * Proxy and replace a single js file with a local one.
     * @param  {Object} opts
     * ```js
     * {
     *     url: Regex, // The url pattern to match
     *     file: String // The local js file path
     * }
     * ```
     * @return {Function} noflow middleware
     * @example
     * ```js
     * let kit = require('nokit');
     * let http = require('http');
     * let proxy = kit.require('proxy');
     *
     * let app = proxy.flow();
     *
     * app.push(proxy.debugJs({
     *     url: /main.js$/,
     *     file: './main.js'
     * }));
     *
     * app.listen(8123);
     * ```
     */
    debugJs(opts) {
        if (opts == null) {
            opts = {};
        }
        opts.useJs = true;

        const handler = proxy.serverHelper(opts);

        if (opts.file) {
            handler.watch(opts.file);
        }

        return flow(
            handler,
            proxy.select(opts.url, $ =>
                kit.readFile(opts.file).then(js => $.body = handler.browserHelper + js)
            ),
            proxy.url()
        );
    },

    /**
     * Create a etag middleware.
     * @return {Function}
     */
    etag() {
        const Stream = require('stream');
        const jhash = new(kit.require('jhash').constructor);

        return ctx => ctx.next().then(() =>
            Promise.resolve(ctx.body).then(function (data) {
                if (data instanceof Stream) {
                    return;
                }

                const hash = jhash.hash(data);

                if (+ctx.req.headers['if-none-match'] === hash) {
                    ctx.res.statusCode = 304;
                    ctx.res.end();
                    return kit.end();
                }

                if (!ctx.res.headersSent) {
                    return ctx.res.setHeader('ETag', hash);
                }
            })
        );
    },

    /**
     * A simple protocol to read, write, chmod, delete file via http.
     * The protocol is very simple
     * ```
     * POST / HTTP/1.1
     * file-action: ${action}
     *
     * ${body}
     * ```
     * The `action` is somethine like `{ type: 'create', path: '/home/u/a/b.js', mode: 0o777 }`
     * The `body` is the binary of the file content.
     * Both the `action` and the `body` are encrypt with the password and algorithm specified
     * in the opts.
     * @param {Object} opts defaults
     * ```js
     * {
     *     password: 'nokit',
     *     algorithm: 'aes128',
     *     rootAllowed: '/',
     *     actionKey: 'file-action'
     * }
     * ```
     * @return {Function} noflow middleware
     */
    file(opts) {
        if (opts == null) {
            opts = {};
        }
        _.defaults(opts, {
            password: 'nokit',
            algorithm: 'aes128',
            rootAllowed: '/',
            actionKey: 'file-action',
            typeKey: 'file-type'
        });

        const absRoot = kit.path.normalize(kit.path.resolve(opts.rootAllowed));

        const genCipher = () => crypto.createCipher(opts.algorithm, opts.password);
        const genDecipher = () => crypto.createDecipher(opts.algorithm, opts.password);

        const encrypt = function (val, isBase64) {
            if (isBase64) {
                return (kit.encrypt(val, opts.password, opts.algorithm)).toString('base64');
            } else {
                return kit.encrypt(val, opts.password, opts.algorithm);
            }
        };

        const decrypt = function (val, isBase64) {
            if (isBase64) {
                return (kit.decrypt(Buffer.from(val, 'base64'), opts.password, opts.algorithm)) + '';
            } else {
                return kit.decrypt(val, opts.password, opts.algorithm);
            }
        };

        return function ($) {
            let action, data;
            const error = function (status, msg) {
                $.res.statusCode = status;
                return $.body = encrypt(msg);
            };

            try {
                data = decrypt($.req.headers[opts.actionKey], true);
            } catch (error1) {
                return error(400, 'password wrong');
            }

            try {
                action = JSON.parse(data + '');
            } catch (error2) {
                return error(400, 'action is not a valid json');
            }

            const absPath = kit.path.normalize(kit.path.resolve(action.path));
            if (absPath.indexOf(absRoot) !== 0) {
                return error(400, 'the root of this path is not allow');
            }

            switch (action.type) {
                case 'read':
                    return kit.stat(action.path).then(function (stats) {
                        if (stats.isDirectory()) {
                            return kit.readdir(action.path).then(function (list) {
                                $.res.setHeader(opts.typeKey, encrypt(
                                    'directory', true
                                ));
                                return $.body = encrypt(JSON.stringify(list));
                            }, () => error(500, `read directory error: ${action.path}`));
                        } else {
                            $.res.setHeader(opts.typeKey, encrypt(
                                'file', true
                            ));
                            const file = kit.createReadStream(action.path);
                            file.pipe(genCipher()).pipe($.res);
                            return new Promise(function (resolve) {
                                $.res.on('close', resolve);
                                return $.res.on('error', function () {
                                    resolve();
                                    return error(500, `read file error: ${action.path}`);
                                });
                            });
                        }
                    });

                case 'write':
                    return kit.mkdirs(kit.path.dirname(action.path)).then(function () {
                        const file = kit.createWriteStream(action.path, {
                            mode: action.mode
                        });
                        $.req.pipe(genDecipher()).pipe(file);

                        return new Promise(function (resolve) {
                            file.on('close', resolve);
                            return file.on('error', function () {
                                error(500, `write error: ${action.path}`);
                                return resolve();
                            });
                        });
                    }, () => error(500, `write error: ${action.path}`));

                case 'chmod':
                    return kit.chmod(action.path, action.mode).then(() => $.body = encrypt(http.STATUS_CODES[200]), () => error(500, `chmod error: ${action.path}`));

                case 'remove':
                    return kit.remove(action.path).then(() => $.body = encrypt(http.STATUS_CODES[200]), () => error(500, `remove error: ${action.path}`));

                default:
                    return error(400, 'action.type is unknown');
            }
        };
    },

    /**
     * Make a file create request to `proxy.file`.
     * @param  {Object} opts Defaults
     * ```js
     * {
     *    action: 'read',
     *    url: '127.0.0.1',
     *    path: String,
     *    data: Any,
     *    password: 'nokit',
     *    algorithm: 'aes128',
     *    actionKey: 'file-action',
     *    typeKey: 'file-type'
     * }
     * ```
     * @return {Promise}
     */
    fileRequest(opts) {
        let data;
        if (opts == null) {
            opts = {};
        }
        _.defaults(opts, {
            action: 'read',
            url: '127.0.0.1',
            password: 'nokit',
            algorithm: 'aes128',
            actionKey: 'file-action',
            typeKey: 'file-type'
        });

        if (!('path' in opts)) {
            throw new Error('path option is not defined');
        }

        const genCipher = () => crypto.createCipher(opts.algorithm, opts.password);

        const encrypt = function (val, isBase64) {
            if (isBase64) {
                return (kit.encrypt(val, opts.password, opts.algorithm)).toString('base64');
            } else {
                return kit.encrypt(val, opts.password, opts.algorithm);
            }
        };

        const decrypt = function (val, isBase64) {
            if (isBase64) {
                return (kit.decrypt(Buffer.from(val, 'base64'), opts.password, opts.algorithm)) + '';
            } else {
                return kit.decrypt(val, opts.password, opts.algorithm);
            }
        };

        if (opts.data) {
            if (_.isFunction(opts.data.pipe)) {
                data = opts.data.pipe(genCipher());
            } else {
                data = encrypt(opts.data);
            }
        }

        return kit.request({
            url: opts.url,
            body: false,
            resEncoding: null,
            headers: {
                [opts.actionKey]: encrypt(JSON.stringify({
                    type: opts.type,
                    mode: opts.mode,
                    path: opts.path
                }), true)
            },
            reqData: data
        }).then(function (res) {
            const body = res.body && res.body.length && decrypt(res.body);

            if (res.statusCode >= 300) {
                return Promise.reject(new Error(res.statusCode + ':' + body));
            }

            let type = res.headers[opts.typeKey];
            type = type && decrypt(type, true);

            return {
                type,
                data: type === 'directory' ?
                    JSON.parse(body) :
                    body
            };
        });
    },

    /**
     * A minimal middleware composer for the future.
     * https://github.com/ysmood/noflow
     */
    flow,

    /**
     * Convert noflow middleware express middleware.
     * @param  {Function} fn noflow middleware
     * @return {FUnction} express middleware
     */
    flowToMid(fn) {
        return (req, res, next) =>
            flow(
                fn,
                () => next())(req, res).catch(next);
    },

    /**
     * Generate an express like unix path selector. See the example of `proxy.flow`.
     * @param {String} pattern
     * @param {Object} opts Same as the [path-to-regexp](https://github.com/pillarjs/path-to-regexp)'s
     * options.
     * @return {Function} `(String) -> Object`.
     * @example
     * ```js
     * let proxy = kit.require('proxy');
     * let match = proxy.match('/items/:id');
     * kit.log(match('/items/10')) // output => { id: '10' }
     * ```
     */
    match(pattern, opts) {
        const parse = kit.requireOptional('path-to-regexp', __dirname, '^2.1.0');
        const keys = [];
        const reg = parse(pattern, keys, opts);

        return function (url) {
            const qsIndex = url.indexOf("?");

            var ms = qsIndex > -1 ?
                url.slice(0, qsIndex).match(reg) :
                (ms = url.match(reg));

            if (ms === null) {
                return;
            }
            return ms.reduce(function (ret, elem, i) {
                if (i === 0) {
                    return {};
                }
                ret[keys[i - 1].name] = elem;
                return ret;
            }, null);
        };
    },

    /**
     * Convert a Express-like middleware to `proxy.flow` middleware.
     * @param  {Function} h `(req, res, next) ->`
     * @return {Function}   `(ctx) -> Promise`
     * ```js
     * let proxy = kit.require('proxy');
     * let http = require('http');
     * let bodyParser = require('body-parser');
     *
     * let middlewares = [
     *     proxy.midToFlow(bodyParser.json()),
     *
     *     (ctx) => ctx.body = ctx.req.body
     * ];
     *
     * http.createServer(proxy.flow(middlewares)).listen(8123);
     * ```
     */
    midToFlow(h) {
        return ctx =>
            new Promise(function (resolve, reject) {
                return h(ctx.req, ctx.res, function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        ctx.next().then(resolve, reject);
                    }

                });
            });
    },

    /**
     * A simple url parser middleware.
     * It will append a `url` object to `ctx`
     * @param {boolean}  parseQueryString
     * @param {boolean}  slashesDenoteHost
     * @return {Function}  `(ctx) -> Promise`
     * @example
     * ```
     * let kit = require('nokit');
     * let proxy = kit.require('proxy');
     *
     * let app = proxy.flow();
     *
     * app.push(proxy.parseUrl(true));
     *
     * app.push(($) => {
     *     kit.logs($.reqUrl.path);
     * });
     *
     * app.listen(8123);
     * ```
     */
    parseUrl(parseQueryString, slashesDenoteHost) {
        kit.require('url');

        return function ($) {
            $.reqUrl = kit.url.parse($.req.url, parseQueryString, slashesDenoteHost);
            return $.next();
        };
    },

    /**
     * A helper for http server port tunneling.
     * @param  {Object} opts
     * ```js
     * {
     *     allowedHosts: [],
     *     onSocketError: () => {},
     *     onRelayError: () => {}
     * }
     * ```
     * @return {Function} A http connect method helper.
     */
    relayConnect(opts) {
        if (opts == null) {
            opts = {};
        }
        _.defaults(opts, {
            allowedHosts: [],
            onSocketError(err) {
                return kit.logs(err);
            },
            onRelayError(err) {
                return kit.logs(err);
            }
        });

        return function (req, relay, head) {
            const hostTo = req.headers['host-to'];
            if (hostTo) {
                if (opts.allowedHosts.indexOf(hostTo) > -1) {
                    const [host, port] = Array.from(hostTo.split(':'));
                    relay.setTimeout(0);
                    var sock = net.connect(port, host, function () {
                        sock.write(head);
                        sock.pipe(relay);
                        return relay.pipe(sock);
                    });
                    sock.on('error', opts.onSocketError);
                    return relay.on('error', opts.onRelayError);

                } else {
                    return relay.end('host not allowed');
                }
            }
        };
    },

    /**
     * A helper for http server port tunneling.
     * @param  {Object} opts
     * ```js
     * {
     *     host: '0.0.0.0:9970',
     *     relayHost: '127.0.0.1:9971',
     *     hostTo: '127.0.0.1:8080',
     *     onSocketError: () => {},
     *     onRelayError: () => {}
     * }
     * ```
     * @return {Promise} Resolve a tcp server object.
     */
    relayClient(opts) {
        if (opts == null) {
            opts = {};
        }
        net = require('net');

        _.defaults(opts, {
            host: '0.0.0.0:9970',
            relayHost: '127.0.0.1:9971',
            hostTo: '127.0.0.1:8080',
            onSocketError(err) {
                return kit.logs(err);
            },
            onRelayError(err) {
                return kit.logs(err);
            }
        });

        const [hostHost, hostPort] = Array.from(opts.host.split(':'));
        const [relayHost, relayPort] = Array.from(opts.relayHost.split(':'));

        const server = net.createServer(function (sock) {
            var relay = net.connect(relayPort, relayHost, function () {
                relay.write(
                    'CONNECT / HTTP/1.1\r\n' +
                    'Connection: close\r\n' +
                    `Host-To: ${opts.hostTo}\r\n\r\n`
                );

                sock.pipe(relay);
                return relay.pipe(sock);
            });

            sock.on('error', opts.onSocketError);
            return relay.on('error', opts.onRelayError);
        });

        return kit.promisify(server.listen, server)(hostPort, hostHost)
            .then(() => server);
    },

    /**
     * Create a conditional middleware that only works when the pattern matches.
     * @param  {Object} sel The selector. Members:
     * ```js
     * {
     *  url: String | Regex | Function,
     *  method: String | Regex | Function,
     *  headers: Object
     * }
     * ```
     * When it's not an object, it will be convert via `sel = { url: sel }`.
     * The `url`, `method` and `headers` are act as selectors. If current
     * request matches the selector, the `middleware` will be called with the
     * captured result. If the selector is a function, it should return a
     * `non-undefined, non-null` value when matches, it will be assigned to the `ctx`.
     * When the `url` is a string, if `req.url` starts with the `url`, the rest
     * of the string will be captured.
     * @param  {Function} middleware
     * @return {Function}
     */
    select(sel, middleware) {
        if (!_.isPlainObject(sel)) {
            sel = {
                url: sel
            };
        }

        const matchKey = function (ctx, obj, key, pattern) {
            let str;
            if (pattern === undefined) {
                return true;
            }

            str = obj[key];

            if (!_.isString(str)) {
                return false;
            }

            const ret = (() => {
                if (_.isString(pattern)) {
                    if ((key === 'url') && _.startsWith(str, pattern)) {
                        str = str.slice(pattern.length);
                        if (str === '') {
                            str = '/';
                        }
                        return str;
                    } else if (str === pattern) {
                        return str;
                    }
                } else if (_.isRegExp(pattern)) {
                    return str.match(pattern);
                } else if (_.isFunction(pattern)) {
                    return pattern(str);
                }
            })();

            if (ret != null) {
                ctx[key] = ret;
                return true;
            }
        };

        const matchHeaders = function (ctx, headers) {
            if (headers === undefined) {
                return true;
            }

            const ret = {};

            for (let k in headers) {
                const v = headers[k];
                if (!matchKey(ret, ctx.req.headers, k, v)) {
                    return false;
                }
            }

            ctx.headers = ret;
            return true;
        };

        return function (ctx) {
            if (matchKey(ctx, ctx.req, 'method', sel.method) &&
                matchHeaders(ctx, sel.headers) &&
                matchKey(ctx, ctx.req, 'url', sel.url)) {
                if (_.isFunction(middleware)) {
                    return middleware(ctx);
                } else {
                    return ctx.body = middleware;
                }
            } else {
                return ctx.next();
            }
        };
    },

    /**
     * Create a http request middleware.
     * @param  {Object} opts Same as the sse.
     * @return {Function} `(req, res, next) ->`.
     * It has some extra properties:
     * ```js
     * {
     *  ssePrefix: '/nokit-sse',
     *  logPrefix: '/nokit-log',
     *  sse: kit.sse,
     *  watch: (filePath, reqUrl) => {},
     *  host: '', // The host of the event source.
     *  useJs: false // By default the browserHelper will be a html string
     * }
     * ```
     * @example
     * Visit 'http://127.0.0.1:80123', every 3 sec, the page will be reloaded.
     * If the `./static/default.css` is modified, the page `a.html` will also be reloaded.
     * ```js
     * let kit = require('nokit');
     * let http = require('http');
     * let proxy = kit.require('proxy');
     * let handler = proxy.serverHelper();
     *
     * let app = proxy.flow();
     *
     * handler.watch('./static/default.css', '/st/default.css');
     *
     * app.push(handler);
     *
     * app.push(proxy.select(/a\.html$/, proxy.url({
     *     handleResBody: (body) => body + handler.browserHelper
     * })));
     *
     * app.listen(8123);
     *
     * setInterval(() =>
     *     handler.sse.emit('fileModified', 'changed-file-path.js')
     * ), 3000);
     * ```
     * You can also use the `nokit.log` on the browser to log to the remote server.
     * ```js
     * nokit.log({ any: 'thing' });
     * ```
     */
    serverHelper(opts) {
        if (opts == null) {
            opts = {};
        }
        const br = kit.require('brush');
        kit.require('url');

        opts = _.defaults(opts, {
            ssePrefix: '/nokit-sse',
            logPrefix: '/nokit-log'
        });

        var handler = function (ctx) {
            let {
                req,
                res,
                url
            } = ctx;

            if (url == null) {
                url = kit.url.parse(req.url);
            }

            switch (url.path) {
                case opts.ssePrefix:
                    kit.logs(br.cyan('sse connected: ') + req.url);
                    handler.sse(req, res);
                    return new Promise(function () {});
                case opts.logPrefix:
                    var data = '';

                    req.on('data', chunk => data += chunk);

                    req.on('end', function () {
                        try {
                            kit.log(br.cyan('client') + br.grey(' | ') +
                                (data ?
                                    kit.xinspect(JSON.parse(data)) :
                                    data)
                            );
                            return res.end();
                        } catch (e) {
                            res.statusCode = 500;
                            return res.end(e.stack);
                        }
                    });
                    return new Promise(function () {});
                default:
                    return ctx.next();
            }
        };

        handler.sse = kit.require('sse')(opts);

        handler.browserHelper = kit.browserHelper(opts);

        const watchList = [];
        handler.watch = function (path, url) {
            if (_.includes(watchList, path)) {
                return;
            }

            return kit.fileExists(path).then(function (exists) {
                if (!exists) {
                    return;
                }

                kit.logs(br.cyan('watch:'), path);
                watchList.push(path);
                return kit.watchPath(path, {
                    handler() {
                        kit.logs(br.cyan('changed:'), path);
                        return handler.sse.emit('fileModified', url);
                    }
                });
            });
        };

        return handler;
    },

    /**
     * Create a static file middleware for `proxy.flow`.
     * @param  {String | Object} opts Same as the [send](https://github.com/pillarjs/send)'s.
     * It has an extra option `{ onFile: (path, stats, ctx) => void }`.
     * @return {Function} The middleware handler of `porxy.flow`.
     * ```js
     * let proxy = kit.require('proxy');
     * let http = require('http');
     *
     * let middlewares = [proxy.select({ url: '/st' }, proxy.static('static'))]
     *
     * http.createServer(proxy.flow(middlewares)).listen(8123);
     * ```
     */
    static(opts) {
        if (_.isString(opts)) {
            opts = {
                root: opts
            };
        }

        const send = kit.requireOptional('send', __dirname, '^0.16.2');

        return ctx => new Promise(function (resolve, reject) {
            const url = _.isString(ctx.url) ?
                ctx.url :
                ctx.req.url;

            const query = url.indexOf('?');
            const path = query < 0 ? url : url.slice(0, query);

            const s = send(ctx.req, path, opts);

            if (opts.onFile) {
                s.on('file', (path, stats) => opts.onFile(path, stats, ctx));
            }

            return s.on('error', function (err) {
                if (err.status === 404) {
                    return ctx.next().then(resolve, reject);
                } else {
                    err.statusCode = err.status;
                    return reject(err);
                }
            }).pipe(ctx.res);
        });
    },

    /**
     * Send or receive any size of package over a socket.
     * Add a `writeFrame` method and a `frame` event to `net.Socket` object.
     * The `writeFrame`'s signature is same with the `net.Socket.write`.
     * The `frame` event is the same with the native stream's `data` event.
     * @param {net.Socket} socket The nodejs native `net.Socket`.
     * @param {Object} opts Defaults
     * ```js
     * {
     *     // The extra first chunk to be used as part of a frame
     *     head: Buffer
     * }
     * ```
     */
    tcpFrame,

    /**
     * Use it to proxy one url to another.
     * @param {Object | String} opts Other options, if it is a string, it will
     * be converted to `{ url: opts }`. Default:
     * ```js
     * {
     *     // The target url forced to. Optional.
     *     // Such as proxy 'http://test.com/a' to 'http://test.com/b',
     *     // proxy 'http://test.com/a' to 'http://other.com/a',
     *     // proxy 'http://test.com' to 'other.com'.
     *     // It can also be an url object. Such as
     *     // `{ protocol: 'http:', host: 'test.com:8123', pathname: '/a/b', query: 's=1' }`.
     *     url: null,
     *
     *     // Mutate the url before the proxy take charge of it.
     *     handleUrl: (url) => url,
     *
     *     agent: customHttpAgent,
     *
     *     // Force the header's host same as the url's.
     *     isForceHeaderHost: false,
     *
     *     // The request data to use. The return value should be stream, buffer or string.
     *     handleReqData: (req) => req.body || req
     *
     *     // You can hack the headers before the proxy send it.
     *     handleReqHeaders: (headers, req) => headers
     *     handleResHeaders: (headers, req, proxyRes) => headers,
     *
     *     // Same option as the `kit.request`'s `handleResPipe`.
     *     handleResPipe: (res, stream) => stream,
     *
     *     // Manipulate the response body content of the response here,
     *     // such as inject script into it. Its return type is same as the `ctx.body`.
     *     handleResBody: (body, req, proxyRes) => body,
     *
     *     // Only when the `content-type` matches, handleResBody will work
     *     handleResBodyMIME: /text|json|javascript|css|xml/
     *
     *     // It will log some basic error info.
     *     error: (e, req) => {}
     * }
     * ```
     * @return {Function} `(req, res) => Promise` A middleware.
     * @example
     * ```js
     * let kit = require('nokit');
     * let proxy = kit.require('proxy');
     * let http = require('http');
     *
     * http.createServer(proxy.flow(
     *     // Transparent proxy
     *     proxy.select({ url: '/a' }, proxy.url()),
     *
     *     // Porxy to `a.com`
     *     proxy.select({ url: '/b' }, proxy.url({ url: 'a.com' })),
     *
     *     // Porxy to a file
     *     proxy.select({ url: '/c' }, proxy.url({ url: 'c.com/s.js' })),
     *
     *     proxy.select(
     *         { url: /$/, method: 'GET' },
     *         proxy.url({
     *             url: 'd.com',
     *             // Inject script to html page.
     *             handleResBody: (body, req, res) => {
     *                 if (res.headers['content-type'].indexOf('text/html') > -1)
     *                     return body + '<script>alert("test")</script>';
     *                 else
     *                     return body;
     *             }
     *         })
     *     )
     * ).listen(8123);
     * ```
     */
    url(opts) {
        kit.require('url');
        const br = kit.require('brush');

        if (_.isString(opts)) {
            opts = {
                url: opts
            };
        }

        if (opts == null) {
            opts = {};
        }

        _.defaults(opts, {
            globalBps: false,
            // agent: if opts.protocol == 'https:' then proxy.httpsAgent else proxy.agent
            protocol: 'http:',
            isForceHeaderHost: false,
            resEncoding: 'auto',
            handleReqData(req) {
                return req.body || req;
            },
            handleReqHeaders(headers) {
                return headers;
            },
            handleResHeaders(headers) {
                return headers;
            },
            handleUrl(url) {
                return url;
            },
            error(e, req) {
                return kit.logs(e.toString(), '->', br.red(req.url));
            },
            handleResBodyMIME: /text|json|javascript|css|xml/,
            resPipeError(res) {
                res.statusCode = 502;
                return res.end(`Proxy Error: ${http.STATUS_CODES[502]}`);
            },
            rejectUnauthorized: true
        });

        if (opts.handleResBody && !opts.handleResPipe) {
            opts.handleResPipe = () => null;
        }

        const normalizeUrl = function (req, url) {
            if (!url) {
                ({
                    url
                } = req);
            }

            return opts.handleUrl((() => {
                if (_.isString(url)) {
                    const sepIndex = url.indexOf('/');

                    switch (sepIndex) {
                        // such as url is '/get/page'
                        case 0:
                            return {
                                protocol: opts.protocol,
                                host: req.headers.host,
                                path: url
                            };

                            // such as url is 'test.com'
                        case -1:
                            return {
                                protocol: opts.protocol,
                                host: url,
                                path: kit.url.parse(req.url).path
                            };

                            // such as url is 'http://a.com/test'
                        default:
                            return kit.url.parse(url);
                    }
                } else {
                    return url;
                }

            })());
        };

        const normalizeStream = function (res) {
            if (opts.handleResBody) {
                return;
            }

            if (_.isNumber(opts.bps)) {
                let bps;
                if (opts.globalBps) {
                    const sockNum = _.keys(opts.agent.sockets).length;
                    bps = opts.bps / (sockNum + 1);
                } else {
                    ({
                        bps
                    } = opts);
                }

                const throttle = new kit.requireOptional('throttle', __dirname)(bps);

                throttle.pipe(res);
                return throttle;
            } else {
                return res;
            }
        };

        return function (ctx) {
            const {
                req,
                res
            } = ctx;
            const url = normalizeUrl(req, opts.url);
            const headers = opts.handleReqHeaders(req.headers, req);

            if (opts.isForceHeaderHost && opts.url) {
                headers['Host'] = url.host;
            }

            const autoUnzip = !!opts.handleResBody;

            let p = kit.request({
                method: req.method,
                url,
                headers,
                resPipe: normalizeStream(res),
                reqData: opts.handleReqData(req),
                autoTE: false,
                resEncoding: opts.resEncoding,
                handleResPipe: opts.handleResPipe,
                autoUnzip,
                agent: opts.agent,
                body: false,
                resPipeError: opts.resPipeError,
                rejectUnauthorized: opts.rejectUnauthorized
            });

            p.req.on('response', function (proxyRes) {
                if (!opts.handleResBodyMIME.test(proxyRes.headers['content-type'])) {
                    res.writeHead(
                        proxyRes.statusCode,
                        opts.handleResHeaders(proxyRes.headers, req, proxyRes)
                    );

                    if (opts.handleResBody) {
                        return proxyRes.pipe(res);
                    }
                } else if (!opts.handleResBody) {
                    return res.writeHead(
                        proxyRes.statusCode,
                        opts.handleResHeaders(proxyRes.headers, req, proxyRes)
                    );
                }
            });

            if (opts.handleResBody) {
                p = p.then(function (proxyRes) {
                    if (!opts.handleResBodyMIME.test(proxyRes.headers['content-type'])) {
                        return;
                    }

                    const hs = opts.handleResHeaders(proxyRes.headers, req, proxyRes);

                    res.statusCode = proxyRes.statusCode;

                    const encoding = proxyRes.headers['content-encoding'];

                    for (let k in hs) {
                        const v = hs[k];
                        res.setHeader(k, v);
                    }

                    if (proxyRes.body) {
                        if (autoUnzip && regGzipDeflat.test(encoding)) {
                            res.removeHeader('content-encoding');
                            res.removeHeader('Content-Encoding');
                            res.removeHeader('content-length');
                            res.removeHeader('Content-Length');
                            res.setHeader('transfer-encoding', 'chunked');
                        }

                        ctx.body = opts.handleResBody(proxyRes.body, req, proxyRes);
                    } else {
                        ctx.body = '';
                    }

                });
            }

            p.catch(e => opts.error(e, req));

            return p;
        };
    },

    /**
     * Add a `van` method to flow context object. It's a helper to set
     * and get the context body.
     * @param  {FlowContext} ctx
     */
    van(ctx) {
        ctx.van = function () {
            if (arguments.length === 0) {
                return ctx.req.body;
            } else {
                return ctx.body = arguments[0];
            }
        };
        return ctx.next();
    }
};

module.exports = proxy;