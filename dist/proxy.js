
/**
 * For test, page injection development.
 * A cross-platform programmable Fiddler alternative.
 * You can even replace express.js with it's `flow` function.
 */
var Overview, Promise, Socket, _, flow, http, kit, net, proxy, regConnectHost, regTunnelBegin, tcpFrame;

Overview = 'proxy';

kit = require('./kit');

_ = kit._, Promise = kit.Promise;

http = require('http');

flow = require('noflow')["default"];

tcpFrame = require('./tcpFrame');

net = kit.require('net', __dirname);

Socket = net.Socket;

regConnectHost = /([^:]+)(?::(\d+))?/;

regTunnelBegin = /^\w+\:\/\//;

proxy = {
  agent: new http.Agent,

  /**
   * A simple request body middleware.
   * It will append a property `reqBody` to `ctx`.
   * It will append a property `body` to `ctx.req`.
   * @return {Function} `(ctx) -> Promise`
   */
  body: function(opts) {
    return function(ctx) {
      if (!ctx.req.readable) {
        return ctx.next();
      }
      return new Promise(function(resolve, reject) {
        var buf;
        buf = new Buffer(0);
        ctx.req.on('data', function(chunk) {
          return buf = Buffer.concat([buf, chunk]);
        });
        ctx.req.on('error', reject);
        return ctx.req.on('end', function() {
          if (buf.length > 0) {
            ctx.reqBody = buf;
            ctx.req.body = buf;
          }
          return ctx.next().then(resolve, reject);
        });
      });
    };
  },

  /**
   * Add a `van` method to flow context object. It's a helper to set
   * and get the context body.
   * @param  {FlowContext} ctx
   */
  van: function(ctx) {
    ctx.van = function() {
      if (arguments.length === 0) {
        return ctx.body;
      } else {
        return ctx.body = arguments[0];
      }
    };
    return ctx.next();
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
  connect: function(opts) {
    var host, port, ref;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      filter: function() {
        return true;
      },
      handleReqHeaders: function(h) {
        return h;
      },
      host: null,
      port: null,
      onError: function(err, req, socket) {
        var br;
        br = kit.require('brush');
        kit.log(err.toString() + ' -> ' + br.red(req.url));
        return socket.end();
      }
    });
    if (opts.host) {
      if (opts.host.indexOf(':') > -1) {
        ref = opts.host.split(':'), host = ref[0], port = ref[1];
      } else {
        host = opts.host, port = opts.port;
      }
    }
    return function(req, sock, head) {
      var isTransparentProxy, ms, psock;
      if (!opts.filter(req)) {
        return;
      }
      isTransparentProxy = req.headers['proxy-connection'];
      ms = isTransparentProxy ? req.url.match(regConnectHost) : req.headers.host.match(regConnectHost);
      psock = new Socket;
      psock.connect(port || ms[2] || 80, host || ms[1], function() {
        var headers, k, rawHeaders, v;
        if (isTransparentProxy) {
          sock.write("HTTP/" + req.httpVersion + " 200 Connection established\r\n\r\n");
        } else {
          rawHeaders = req.method + " " + req.url + " HTTP/" + req.httpVersion + "\r\n";
          headers = opts.handleReqHeaders(req.headers);
          for (k in headers) {
            v = headers[k];
            rawHeaders += k + ": " + v + "\r\n";
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
      sock.on('error', function(err) {
        return opts.onError(err, req, sock);
      });
      return psock.on('error', function(err) {
        return opts.onError(err, req, psock);
      });
    };
  },

  /**
   * Create a etag middleware.
   * @return {Function}
   */
  etag: function() {
    var Stream, jhash;
    Stream = require('stream');
    jhash = new (kit.require('jhash').constructor);
    return function(ctx) {
      return ctx.next().then(function() {
        return Promise.resolve(ctx.body).then(function(data) {
          var hash;
          if (data instanceof Stream) {
            return;
          }
          hash = jhash.hash(data);
          if (+ctx.req.headers['if-none-match'] === hash) {
            ctx.res.statusCode = 304;
            ctx.res.end();
            return kit.end();
          }
          if (!ctx.res.headersSent) {
            return ctx.res.setHeader('ETag', hash);
          }
        });
      });
    };
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
  file: function(opts) {
    var absRoot, crypto, decrypt, encrypt, genCipher, genDecipher;
    if (opts == null) {
      opts = {};
    }
    crypto = require('crypto');
    _.defaults(opts, {
      password: 'nokit',
      algorithm: 'aes128',
      rootAllowed: '/',
      actionKey: 'file-action',
      typeKey: 'file-type'
    });
    absRoot = kit.path.normalize(kit.path.resolve(opts.rootAllowed));
    genCipher = function() {
      return crypto.createCipher(opts.algorithm, opts.password);
    };
    genDecipher = function() {
      return crypto.createDecipher(opts.algorithm, opts.password);
    };
    encrypt = function(val, isBase64) {
      if (isBase64) {
        return (kit.encrypt(val, opts.password, opts.algorithm)).toString('base64');
      } else {
        return kit.encrypt(val, opts.password, opts.algorithm);
      }
    };
    decrypt = function(val, isBase64) {
      if (isBase64) {
        return (kit.decrypt(new Buffer(val, 'base64'), opts.password, opts.algorithm)) + '';
      } else {
        return kit.decrypt(val, opts.password, opts.algorithm);
      }
    };
    return function($) {
      var absPath, action, data, err, error, error1, error2;
      error = function(status, msg) {
        $.res.statusCode = status;
        return $.body = encrypt(msg);
      };
      try {
        data = decrypt($.req.headers[opts.actionKey], true);
      } catch (error1) {
        err = error1;
        return error(400, 'password wrong');
      }
      try {
        action = JSON.parse(data + '');
      } catch (error2) {
        err = error2;
        return error(400, 'action is not a valid json');
      }
      absPath = kit.path.normalize(kit.path.resolve(action.path));
      if (absPath.indexOf(absRoot) !== 0) {
        return error(400, 'the root of this path is not allow');
      }
      switch (action.type) {
        case 'read':
          return kit.stat(action.path).then(function(stats) {
            var file;
            if (stats.isDirectory()) {
              return kit.readdir(action.path).then(function(list) {
                $.res.setHeader(opts.typeKey, encrypt('directory', true));
                return $.body = encrypt(JSON.stringify(list));
              }, function() {
                return error(500, 'read directory error: ' + action.path);
              });
            } else {
              $.res.setHeader(opts.typeKey, encrypt('file', true));
              file = kit.createReadStream(action.path);
              file.pipe(genCipher()).pipe($.res);
              return new Promise(function(resolve) {
                $.res.on('close', resolve);
                return $.res.on('error', function() {
                  resolve();
                  return error(500, 'read file error: ' + action.path);
                });
              });
            }
          });
        case 'write':
          return kit.mkdirs(kit.path.dirname(action.path)).then(function() {
            var file;
            file = kit.createWriteStream(action.path, {
              mode: action.mode
            });
            $.req.pipe(genDecipher()).pipe(file);
            return new Promise(function(resolve) {
              file.on('close', resolve);
              return file.on('error', function() {
                error(500, 'write error: ' + action.path);
                return resolve();
              });
            });
          }, function() {
            return error(500, 'write error: ' + action.path);
          });
        case 'chmod':
          return kit.chmod(action.path, action.mode).then(function() {
            return $.body = encrypt(http.STATUS_CODES[200]);
          }, function() {
            return error(500, 'chmod error: ' + action.path);
          });
        case 'remove':
          return kit.remove(action.path).then(function() {
            return $.body = encrypt(http.STATUS_CODES[200]);
          }, function() {
            return error(500, 'remove error: ' + action.path);
          });
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
  fileRequest: function(opts) {
    var crypto, data, decrypt, encrypt, genCipher, genDecipher, obj1;
    if (opts == null) {
      opts = {};
    }
    crypto = require('crypto');
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
    genCipher = function() {
      return crypto.createCipher(opts.algorithm, opts.password);
    };
    genDecipher = function() {
      return crypto.createDecipher(opts.algorithm, opts.password);
    };
    encrypt = function(val, isBase64) {
      if (isBase64) {
        return (kit.encrypt(val, opts.password, opts.algorithm)).toString('base64');
      } else {
        return kit.encrypt(val, opts.password, opts.algorithm);
      }
    };
    decrypt = function(val, isBase64) {
      if (isBase64) {
        return (kit.decrypt(new Buffer(val, 'base64'), opts.password, opts.algorithm)) + '';
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
      headers: (
        obj1 = {},
        obj1["" + opts.actionKey] = encrypt(JSON.stringify({
          type: opts.type,
          mode: opts.mode,
          path: opts.path
        }), true),
        obj1
      ),
      reqData: data
    }).then(function(res) {
      var body, type;
      body = res.body && res.body.length && decrypt(res.body);
      if (res.statusCode >= 300) {
        return Promise.reject(new Error(res.statusCode + ':' + body));
      }
      type = res.headers[opts.typeKey];
      type = type && decrypt(type, true);
      return {
        type: type,
        data: type === 'directory' ? JSON.parse(body) : body
      };
    });
  },

  /**
   * A minimal middleware composer for the future.
   * https://github.com/ysmood/noflow
   */
  flow: flow,

  /**
   * Convert noflow middleware express middleware.
   * @param  {Function} fn noflow middleware
   * @return {FUnction} express middleware
   */
  flowToMid: function(fn) {
    return function(req, res, next) {
      return flow(fn, function() {
        return next();
      })(req, res)["catch"](next);
    };
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
  match: function(pattern, opts) {
    var keys, parse, reg;
    parse = kit.requireOptional('path-to-regexp', __dirname, '^1.2.0');
    keys = [];
    reg = parse(pattern, keys, opts);
    return function(url) {
      var ms, qsIndex;
      qsIndex = url.indexOf("?");
      ms = qsIndex > -1 ? url.slice(0, qsIndex).match(reg) : ms = url.match(reg);
      if (ms === null) {
        return;
      }
      return ms.reduce(function(ret, elem, i) {
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
  midToFlow: function(h) {
    return function(ctx) {
      return new Promise(function(resolve, reject) {
        return h(ctx.req, ctx.res, function(err) {
          if (err) {
            reject(err);
          } else {
            ctx.next().then(resolve, reject);
          }
        });
      });
    };
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
  select: function(sel, middleware) {
    var matchHeaders, matchKey;
    if (!_.isPlainObject(sel)) {
      sel = {
        url: sel
      };
    }
    matchKey = function(ctx, obj, key, pattern) {
      var ret, str;
      if (pattern === void 0) {
        return true;
      }
      str = obj[key];
      if (!_.isString(str)) {
        return false;
      }
      ret = _.isString(pattern) ? key === 'url' && _.startsWith(str, pattern) ? (str = str.slice(pattern.length), str === '' ? str = '/' : void 0, str) : str === pattern ? str : void 0 : _.isRegExp(pattern) ? str.match(pattern) : _.isFunction(pattern) ? pattern(str) : void 0;
      if (ret != null) {
        ctx[key] = ret;
        return true;
      }
    };
    matchHeaders = function(ctx, headers) {
      var k, ret, v;
      headers = headers;
      if (headers === void 0) {
        return true;
      }
      ret = {};
      for (k in headers) {
        v = headers[k];
        if (!matchKey(ret, ctx.req.headers, k, v)) {
          return false;
        }
      }
      ctx.headers = ret;
      return true;
    };
    return function(ctx) {
      if (matchKey(ctx, ctx.req, 'method', sel.method) && matchHeaders(ctx, sel.headers) && matchKey(ctx, ctx.req, 'url', sel.url)) {
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
   *  watch: (filePath, reqUrl) => {}
   * }
   * ```
   * @example
   * Visit 'http://127.0.0.1:80123', every 3 sec, the page will be reloaded.
   * If the `./static/default.css` is modified, the page will also be reloaded.
   * ```js
   * let kit = require('nokit');
   * let http = require('http');
   * let proxy = kit.require('proxy');
   * let handler = kit.browserHelper();
   *
   * http.createServer(proxy.flow([handler]))
   * .listen(8123).then(() => {
   *     kit.log('listen ' + 8123);
   *
   *     handler.watch('./static/default.css', '/st/default.css');
   *
   *     setInterval(() =>
   *         handler.sse.emit('fileModified', 'changed-file-path.js')
   *     ), 3000);
   * });
   *
   * ```
   * You can also use the `nokit.log` on the browser to log to the remote server.
   * ```js
   * nokit.log({ any: 'thing' });
   * ```
   */
  serverHelper: function(opts) {
    var br, handler, watchList;
    if (opts == null) {
      opts = {};
    }
    br = kit.require('brush');
    opts = _.defaults(opts, {
      ssePrefix: '/nokit-sse',
      logPrefix: '/nokit-log'
    });
    handler = function(ctx) {
      var data, req, res;
      req = ctx.req, res = ctx.res;
      switch (req.url) {
        case opts.ssePrefix:
          handler.sse(req, res);
          return new Promise(function() {});
        case opts.logPrefix:
          data = '';
          req.on('data', function(chunk) {
            return data += chunk;
          });
          req.on('end', function() {
            var e, error1;
            try {
              kit.log(br.cyan('client') + br.grey(' | ') + (data ? kit.xinspect(JSON.parse(data)) : data));
              return res.end();
            } catch (error1) {
              e = error1;
              res.statusCode = 500;
              return res.end(e.stack);
            }
          });
          return new Promise(function() {});
        default:
          return ctx.next();
      }
    };
    handler.sse = kit.require('sse')(opts);
    watchList = [];
    handler.watch = function(path, url) {
      if (_.includes(watchList, path)) {
        return;
      }
      return kit.fileExists(path).then(function(exists) {
        if (!exists) {
          return;
        }
        kit.logs(br.cyan('watch:'), path);
        watchList.push(path);
        return kit.watchPath(path, {
          handler: function() {
            kit.logs(br.cyan('changed:'), path);
            return handler.sse.emit('fileModified', url);
          }
        });
      });
    };
    return handler;
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
  relayConnect: function(opts) {
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      allowedHosts: [],
      onSocketError: function(err) {
        return kit.logs(err);
      },
      onRelayError: function(err) {
        return kit.logs(err);
      }
    });
    return function(req, relay, head) {
      var host, hostTo, port, ref, sock;
      hostTo = req.headers['host-to'];
      if (hostTo) {
        if (opts.allowedHosts.indexOf(hostTo) > -1) {
          ref = hostTo.split(':'), host = ref[0], port = ref[1];
          relay.setTimeout(0);
          sock = net.connect(port, host, function() {
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
  relayClient: function(opts) {
    var hostHost, hostPort, ref, ref1, relayHost, relayPort, server;
    if (opts == null) {
      opts = {};
    }
    net = require('net');
    _.defaults(opts, {
      host: '0.0.0.0:9970',
      relayHost: '127.0.0.1:9971',
      hostTo: '127.0.0.1:8080',
      onSocketError: function(err) {
        return kit.logs(err);
      },
      onRelayError: function(err) {
        return kit.logs(err);
      }
    });
    ref = opts.host.split(':'), hostHost = ref[0], hostPort = ref[1];
    ref1 = opts.relayHost.split(':'), relayHost = ref1[0], relayPort = ref1[1];
    server = net.createServer(function(sock) {
      var relay;
      relay = net.connect(relayPort, relayHost, function() {
        relay.write('CONNECT / HTTP/1.1\r\n' + 'Connection: close\r\n' + ("Host-To: " + opts.hostTo + "\r\n\r\n"));
        sock.pipe(relay);
        return relay.pipe(sock);
      });
      sock.on('error', opts.onSocketError);
      return relay.on('error', opts.onRelayError);
    });
    return kit.promisify(server.listen, server)(hostPort, hostHost).then(function() {
      return server;
    });
  },

  /**
   * Create a static file middleware for `proxy.flow`.
   * @param  {String | Object} opts Same as the [send](https://github.com/pillarjs/send)'s.
   * It has an extra option `{ onFile: (path, stats, ctx) -> }`.
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
  "static": function(opts) {
    var send;
    send = kit.requireOptional('send', __dirname, '^0.13.0');
    if (_.isString(opts)) {
      opts = {
        root: opts
      };
    }
    return function(ctx) {
      return new Promise(function(resolve, reject) {
        var path, query, s, url;
        url = _.isString(ctx.url) ? ctx.url : ctx.req.url;
        query = url.indexOf('?');
        path = query < 0 ? url : url.slice(0, query);
        s = send(ctx.req, path, opts);
        if (opts.onFile) {
          s.on('file', function(path, stats) {
            return opts.onFile(path, stats, ctx);
          });
        }
        return s.on('error', function(err) {
          if (err.status === 404) {
            return ctx.next().then(resolve, reject);
          } else {
            err.statusCode = err.status;
            return reject(err);
          }
        }).pipe(ctx.res);
      });
    };
  },

  /**
   * Send any size of package as you with a socket.
   * Add a `writeFrame` method and a `frame` event to `net.Socket` object.
   * The `writeFrame`'s signature is the same with the `net.Socket.write`,
   * the max package size is 4GB. The `frame` event is the same with the native
   * `data` event.
   * @param {net.Socket} socket The nodejs native `net.Socket`.
   * @param {Object} opts Defaults
   * ```js
   * {
   *     // The extra first chunk to be used as part of a frame
   *     head: Buffer
   * }
   * ```
   */
  tcpFrame: tcpFrame,

  /**
   * Use it to proxy one url to another.
   * @param {Object | String} opts Other options, if it is a string, it will
   * be converted to `{ url: opts }`. Default:
   * ```js
   * {
   *  // The target url forced to. Optional.
   *  // Such as proxy 'http://test.com/a' to 'http://test.com/b',
   *  // proxy 'http://test.com/a' to 'http://other.com/a',
   *  // proxy 'http://test.com' to 'other.com'.
   *  // It can also be an url object. Such as
   *  // `{ protocol: 'http:', host: 'test.com:8123', pathname: '/a/b', query: 's=1' }`.
   *  url: null,
   *
   *  agent: customHttpAgent,
   *
   *  // Force the header's host same as the url's.
   *  isForceHeaderHost: false,
   *
   *  // The request data to use. The return value should be stream, buffer or string.
   *  handleReqData: (req) -> req.body || req
   *
   *  // You can hack the headers before the proxy send it.
   *  handleReqHeaders: (headers, req) => headers
   *  handleResHeaders: (headers, req, proxyRes) => headers,
   *
   *  // Same option as the `kit.request`'s `handleResPipe`.
   *  handleResPipe: (res, stream) => stream,
   *
   *  // Manipulate the response body content of the response here,
   *  // such as inject script into it. Its return type is same as the `ctx.body`.
   *  handleResBody: (body, req, proxyRes) => body,
   *
   *  // It will log some basic error info.
   *  error: (e, req) => {}
   * }
   * ```
   * @return {Function} `(req, res) => Promise` A middleware.
   * @example
   * ```js
   * let kit = require('nokit');
   * let proxy = kit.require('proxy');
   * let http = require('http');
   *
   * http.createServer(proxy.flow [
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
   *         { url: /\/$/, method: 'GET' },
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
   * ]).listen(8123);
   * ```
   */
  url: function(opts) {
    var br, normalizeStream, normalizeUrl;
    kit.require('url');
    br = kit.require('brush');
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
      agent: proxy.agent,
      isForceHeaderHost: false,
      handleReqData: function(req) {
        return req.body || req;
      },
      handleReqHeaders: function(headers) {
        return headers;
      },
      handleResHeaders: function(headers) {
        return headers;
      },
      handleUrl: function(url) {
        return url;
      },
      error: function(e, req) {
        return kit.logs(e.toString(), '->', br.red(req.url));
      }
    });
    if (opts.handleResBody && !opts.handleResPipe) {
      opts.handleResPipe = function(res, resPipe) {
        return null;
      };
    }
    normalizeUrl = function(req, url) {
      var sepIndex;
      if (!url) {
        url = req.url;
      }
      return opts.handleUrl((function() {
        if (_.isString(url)) {
          sepIndex = url.indexOf('/');
          switch (sepIndex) {
            case 0:
              return {
                protocol: 'http:',
                host: req.headers.host,
                path: url
              };
            case -1:
              return {
                protocol: 'http:',
                host: url,
                path: kit.url.parse(req.url).path
              };
            default:
              return kit.url.parse(url);
          }
        } else {
          return url;
        }
      })());
    };
    normalizeStream = function(res) {
      var bps, sockNum, throttle;
      if (_.isNumber(opts.bps)) {
        if (opts.globalBps) {
          sockNum = _.keys(opts.agent.sockets).length;
          bps = opts.bps / (sockNum + 1);
        } else {
          bps = opts.bps;
        }
        throttle = new kit.requireOptional('throttle', __dirname)(bps);
        throttle.pipe(res);
        return throttle;
      } else {
        return res;
      }
    };
    return function(ctx) {
      var headers, p, req, res, url;
      req = ctx.req, res = ctx.res;
      url = normalizeUrl(req, opts.url);
      headers = opts.handleReqHeaders(req.headers, req);
      if (opts.isForceHeaderHost && opts.url) {
        headers['Host'] = url.host;
      }
      p = kit.request({
        method: req.method,
        url: url,
        headers: headers,
        resPipe: normalizeStream(res),
        reqData: opts.handleReqData(req),
        autoTE: false,
        handleResPipe: opts.handleResPipe,
        autoUnzip: false,
        agent: opts.agent,
        body: false,
        resPipeError: function() {
          res.statusCode = 502;
          return res.end('Proxy Error: ' + http.STATUS_CODES[502]);
        }
      });
      if (opts.handleResBody) {
        p = p.then(function(proxyRes) {
          var hs, k, v;
          if (_.isUndefined(proxyRes.body)) {
            return;
          }
          ctx.body = opts.handleResBody(proxyRes.body, req, proxyRes);
          hs = opts.handleResHeaders(proxyRes.headers, req, proxyRes);
          for (k in hs) {
            v = hs[k];
            res.setHeader(k, v);
          }
          return res.statusCode = proxyRes.statusCode;
        });
      } else {
        p.req.on('response', function(proxyRes) {
          return res.writeHead(proxyRes.statusCode, opts.handleResHeaders(proxyRes.headers, req, proxyRes));
        });
      }
      p["catch"](function(e) {
        return opts.error(e, req);
      });
      return p;
    };
  }
};

module.exports = proxy;
