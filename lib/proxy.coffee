###*
 * For test, page injection development.
 * A cross-platform programmable Fiddler alternative.
 * You can even replace express.js with it's `flow` function.
###
Overview = 'proxy'

kit = require './kit'
{ _, Promise } = kit
http = require 'http'
https = require 'https'
{ default: flow } = require 'noflow'
tcpFrame = require './tcpFrame'
net = kit.require 'net', __dirname
{ Socket } = net

regConnectHost = /([^:]+)(?::(\d+))?/
regTunnelBegin = /^\w+\:\/\//

proxy =

    agent: new http.Agent

    httpsAgent: new https.Agent

    ###*
     * A simple request body middleware.
     * It will append a property `reqBody` to `ctx`.
     * It will append a property `body` to `ctx.req`.
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
    ###
    body: () ->
        (ctx) ->
            if (!ctx.req.readable)
                return ctx.next()

            new Promise (resolve, reject) ->
                buf = new Buffer 0
                ctx.req.on 'data', (chunk) ->
                    buf = Buffer.concat [buf, chunk]
                ctx.req.on 'error', reject
                ctx.req.on 'end', ->
                    if buf.length > 0
                        ctx.reqBody = buf
                        ctx.req.body = buf
                    ctx.next().then resolve, reject

    ###*
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
    ###
    connect: (opts = {}) ->
        _.defaults opts, {
            filter: -> true
            handleReqHeaders: (h) -> h
            host: null
            port: null
            onError: (err, req, socket) ->
                br = kit.require 'brush'
                kit.log err.toString() + ' -> ' + br.red req.url
                socket.end()
        }

        if opts.host
            if opts.host.indexOf(':') > -1
                [host, port] = opts.host.split ':'
            else
                { host, port } = opts

        (req, sock, head) ->
            return if not opts.filter req

            isTransparentProxy = req.headers['proxy-connection']
            ms = if isTransparentProxy
                req.url.match regConnectHost
            else
                req.headers.host.match regConnectHost

            psock = new Socket
            psock.connect port or ms[2] or 80, host or ms[1], ->
                if isTransparentProxy
                    sock.write "
                        HTTP/#{req.httpVersion} 200 Connection established\r\n\r\n
                    "
                else # https or websocket
                    rawHeaders = "#{req.method} #{req.url} HTTP/#{req.httpVersion}\r\n"
                    headers = opts.handleReqHeaders(req.headers)
                    for k, v of headers
                        rawHeaders += "#{k}: #{v}\r\n"

                    rawHeaders += '\r\n'

                    psock.write rawHeaders

                if head.length > 0
                    psock.write head

                sock.pipe psock
                psock.pipe sock

            sock.on 'error', (err) ->
                opts.onError err, req, sock
            psock.on 'error', (err) ->
                opts.onError err, req, psock

    ###*
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
     * app.use(proxy.debugJs({
     *     url: /main.js$/,
     *     file: './main.js'
     * }));
     *
     * app.listen(8123);
     * ```
    ###
    debugJs: (opts = {}) ->
        opts.useJs = true;

        handler = proxy.serverHelper(opts)

        if opts.file then handler.watch opts.file

        flow(
            handler
            proxy.select(opts.url, ($) ->
                kit.readFile(opts.file).then (js) ->
                    $.body = handler.browserHelper + js
            )
            proxy.url()
        )

    ###*
     * Create a etag middleware.
     * @return {Function}
    ###
    etag: ->
        Stream = require 'stream'
        jhash = new (kit.require('jhash').constructor)

        (ctx) -> ctx.next().then ->
            Promise.resolve(ctx.body).then (data) ->
                return if data instanceof Stream

                hash = jhash.hash data

                if +ctx.req.headers['if-none-match'] == hash
                    ctx.res.statusCode = 304
                    ctx.res.end()
                    return kit.end()

                if not ctx.res.headersSent
                    ctx.res.setHeader 'ETag', hash

    ###*
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
    ###
    file: (opts = {}) ->
        crypto = require 'crypto';

        _.defaults opts, {
            password: 'nokit'
            algorithm: 'aes128'
            rootAllowed: '/',
            actionKey: 'file-action'
            typeKey: 'file-type'
        }

        absRoot = kit.path.normalize(kit.path.resolve(opts.rootAllowed));

        genCipher = -> crypto.createCipher opts.algorithm, opts.password
        genDecipher = -> crypto.createDecipher opts.algorithm, opts.password

        encrypt = (val, isBase64) ->
            if (isBase64)
                (kit.encrypt val, opts.password, opts.algorithm).toString 'base64'
            else
                kit.encrypt val, opts.password, opts.algorithm

        decrypt = (val, isBase64) ->
            if isBase64
                (kit.decrypt new Buffer(val, 'base64'), opts.password, opts.algorithm) + ''
            else
                kit.decrypt val, opts.password, opts.algorithm

        ($) ->
            error = (status, msg) ->
                $.res.statusCode = status
                $.body = encrypt msg

            try
                data = decrypt $.req.headers[opts.actionKey], true
            catch err
                return error 400, 'password wrong'

            try
                action = JSON.parse data + ''
            catch err
                return error 400, 'action is not a valid json'

            absPath = kit.path.normalize(kit.path.resolve(action.path));
            if absPath.indexOf(absRoot) != 0
                return error 400, 'the root of this path is not allow'

            switch action.type
                when 'read'
                    kit.stat(action.path).then (stats) ->
                        if stats.isDirectory()
                            kit.readdir(action.path).then (list) ->
                                $.res.setHeader opts.typeKey, encrypt(
                                    'directory', true
                                )
                                $.body = encrypt JSON.stringify(list)
                            , ->
                                error 500, 'read directory error: ' + action.path
                        else
                            $.res.setHeader opts.typeKey, encrypt(
                                'file', true
                            )
                            file = kit.createReadStream action.path
                            file.pipe(genCipher()).pipe($.res);
                            return new Promise (resolve) ->
                                $.res.on 'close', resolve
                                $.res.on 'error', ->
                                    resolve()
                                    error 500, 'read file error: ' + action.path

                when 'write'
                    return kit.mkdirs(kit.path.dirname(action.path)).then ->
                        file = kit.createWriteStream action.path, {
                            mode: action.mode
                        }
                        $.req.pipe(genDecipher()).pipe(file)

                        new Promise (resolve) ->
                            file.on 'close', resolve
                            file.on 'error', ->
                                error 500, 'write error: ' + action.path
                                resolve()
                    , ->
                        error 500, 'write error: ' + action.path

                when 'chmod'
                    return kit.chmod(action.path, action.mode).then ->
                        $.body = encrypt http.STATUS_CODES[200]
                    , ->
                        error 500, 'chmod error: ' + action.path

                when 'remove'
                    return kit.remove(action.path).then ->
                        $.body = encrypt http.STATUS_CODES[200]
                    , ->
                        error 500, 'remove error: ' + action.path

                else
                    error 400, 'action.type is unknown'

    ###*
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
    ###
    fileRequest: (opts = {}) ->
        crypto = require 'crypto';

        _.defaults opts, {
            action: 'read'
            url: '127.0.0.1'
            password: 'nokit'
            algorithm: 'aes128'
            actionKey: 'file-action'
            typeKey: 'file-type'
        }

        if 'path' not of opts
            throw new Error('path option is not defined')

        genCipher = -> crypto.createCipher opts.algorithm, opts.password
        genDecipher = -> crypto.createDecipher opts.algorithm, opts.password

        encrypt = (val, isBase64) ->
            if (isBase64)
                (kit.encrypt val, opts.password, opts.algorithm).toString 'base64'
            else
                kit.encrypt val, opts.password, opts.algorithm

        decrypt = (val, isBase64) ->
            if isBase64
                (kit.decrypt new Buffer(val, 'base64'), opts.password, opts.algorithm) + ''
            else
                kit.decrypt val, opts.password, opts.algorithm

        if opts.data
            if _.isFunction(opts.data.pipe)
                data = opts.data.pipe genCipher()
            else
                data = encrypt opts.data

        kit.request({
            url: opts.url
            body: false
            resEncoding: null
            headers: {
                "#{opts.actionKey}": encrypt JSON.stringify({
                    type: opts.type
                    mode: opts.mode
                    path: opts.path
                }), true
            }
            reqData: data
        }).then (res) ->
            body = res.body and res.body.length && decrypt(res.body)

            if res.statusCode >= 300
                return Promise.reject new Error(res.statusCode + ':' + body)

            type = res.headers[opts.typeKey]
            type = type && decrypt(type, true)

            {
                type: type
                data: if type == 'directory'
                    JSON.parse(body)
                else
                    body
            }

    ###*
     * A minimal middleware composer for the future.
     * https://github.com/ysmood/noflow
    ###
    flow: flow

    ###*
     * Convert noflow middleware express middleware.
     * @param  {Function} fn noflow middleware
     * @return {FUnction} express middleware
    ###
    flowToMid: (fn) ->
        (req, res, next) ->
            flow(
                fn
                () -> next()
            )(req, res).catch(next)

    ###*
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
    ###
    match: (pattern, opts) ->
        parse = kit.requireOptional 'path-to-regexp', __dirname, '^1.2.0'
        keys = []
        reg = parse pattern, keys, opts

        (url) ->
            qsIndex = url.indexOf "?"

            ms = if qsIndex > -1
                url.slice(0, qsIndex).match reg
            else
                ms = url.match reg

            return if ms == null
            ms.reduce (ret, elem, i) ->
                return {} if i == 0
                ret[keys[i - 1].name] = elem
                ret
            , null

    ###*
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
    ###
    midToFlow: (h) ->
        (ctx) ->
            new Promise (resolve, reject) ->
                h ctx.req, ctx.res, (err) ->
                    if err
                        reject err
                    else
                        ctx.next().then resolve, reject

                    return

    ###*
     * A simple url parser middleware.
     * It will append a `url` object to `ctx`
     * @return {[type]} [description]
     * @example
     * ```
     * let kit = require('nokit');
     * let proxy = kit.require('proxy');
     *
     * let app = proxy.flow();
     *
     * app.push(proxy.parseUrl());
     *
     * app.push(($) => {
     *     kit.logs($.url.path);
     * });
     *
     * app.listen(8123);
     * ```
    ###
    parseUrl: (parseQueryString, slashesDenoteHost) ->
        kit.require 'url'

        ($) ->
            $.url = kit.url.parse url, parseQueryString, slashesDenoteHost
            $.next();

    ###*
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
    ###
    relayConnect: (opts = {}) ->
        _.defaults opts, {
            allowedHosts: []
            onSocketError: (err) ->
                kit.logs err
            onRelayError: (err) ->
                kit.logs err
        }

        (req, relay, head) ->
            hostTo = req.headers['host-to']
            if hostTo
                if opts.allowedHosts.indexOf(hostTo) > -1
                    [host, port] = hostTo.split ':'
                    relay.setTimeout 0
                    sock = net.connect port, host, ->
                        sock.write head
                        sock.pipe relay
                        relay.pipe sock
                    sock.on 'error', opts.onSocketError
                    relay.on 'error', opts.onRelayError

                else
                    relay.end('host not allowed')

    ###*
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
    ###
    relayClient: (opts = {}) ->
        net = require 'net'

        _.defaults opts, {
            host: '0.0.0.0:9970'
            relayHost: '127.0.0.1:9971'
            hostTo: '127.0.0.1:8080'
            onSocketError: (err) ->
                kit.logs err
            onRelayError: (err) ->
                kit.logs err
        }

        [hostHost, hostPort] = opts.host.split ':'
        [relayHost, relayPort] = opts.relayHost.split ':'

        server = net.createServer (sock) ->
            relay = net.connect relayPort, relayHost, ->
                relay.write(
                    'CONNECT / HTTP/1.1\r\n' +
                    'Connection: close\r\n' +
                    "Host-To: #{opts.hostTo}\r\n\r\n"
                )

                sock.pipe(relay);
                relay.pipe(sock);

            sock.on 'error', opts.onSocketError
            relay.on 'error', opts.onRelayError

        kit.promisify(server.listen, server)(hostPort, hostHost)
        .then -> server

    ###*
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
    ###
    select: (sel, middleware) ->
        sel = { url: sel } if not _.isPlainObject(sel)

        matchKey = (ctx, obj, key, pattern) ->
            return true if pattern == undefined

            str = obj[key]

            return false if not _.isString str

            ret = if _.isString(pattern)
                if key == 'url' and _.startsWith(str, pattern)
                    str = str.slice pattern.length
                    str = '/' if str == ''
                    str
                else if str == pattern
                    str
            else if _.isRegExp pattern
                str.match pattern
            else if _.isFunction pattern
                pattern str

            if ret?
                ctx[key] = ret
                true

        matchHeaders = (ctx, headers) ->
            headers = headers
            return true if headers == undefined

            ret = {}

            for k, v of headers
                if not matchKey(ret, ctx.req.headers, k, v)
                    return false

            ctx.headers = ret
            return true

        (ctx) ->
            if matchKey(ctx, ctx.req, 'method', sel.method) and
            matchHeaders(ctx, sel.headers) and
            matchKey(ctx, ctx.req, 'url', sel.url)
                if _.isFunction middleware
                    middleware ctx
                else
                    ctx.body = middleware
            else
                ctx.next()

    ###*
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
     * app.use(handler);
     *
     * app.use(proxy.select(/a\.html$/, proxy.url({
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
    ###
    serverHelper: (opts = {}) ->
        br = kit.require 'brush'
        kit.require('url');

        opts = _.defaults opts, {
            ssePrefix: '/nokit-sse'
            logPrefix: '/nokit-log'
        }

        handler = (ctx) ->
            { req, res, url } = ctx

            url ?= kit.url.parse(req.url);

            switch url.path
                when opts.ssePrefix
                    kit.logs br.cyan('sse connected: ') + req.url
                    handler.sse req, res
                    new Promise(->)
                when opts.logPrefix
                    data = ''

                    req.on 'data', (chunk) ->
                        data += chunk

                    req.on 'end', ->
                        try
                            kit.log br.cyan('client') + br.grey(' | ') +
                            if data
                                kit.xinspect JSON.parse(data)
                            else
                                data
                            res.end()
                        catch e
                            res.statusCode = 500
                            res.end(e.stack)
                    new Promise(->)
                else
                    ctx.next()

        handler.sse = kit.require('sse')(opts)

        handler.browserHelper = kit.browserHelper(opts);

        watchList = []
        handler.watch = (path, url) ->
            return if _.includes watchList, path

            kit.fileExists(path).then (exists) ->
                return if not exists

                kit.logs br.cyan('watch:'), path
                watchList.push path
                kit.watchPath path, {
                    handler: ->
                        kit.logs br.cyan('changed:'), path
                        handler.sse.emit 'fileModified', url
                }

        handler

    ###*
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
    ###
    static: (opts) ->
        if _.isString opts
            opts = { root: opts }

        send = kit.requireOptional 'send', __dirname, '^0.14.0'

        (ctx) -> new Promise (resolve, reject) ->
            url = if _.isString ctx.url
                ctx.url
            else
                ctx.req.url

            query = url.indexOf '?'
            path = if query < 0 then url else url.slice 0, query

            s = send ctx.req, path, opts

            if opts.onFile
                s.on 'file', (path, stats) ->
                    opts.onFile path, stats, ctx

            s.on 'error', (err) ->
                if err.status == 404
                    ctx.next().then resolve, reject
                else
                    err.statusCode = err.status
                    reject err
            .pipe ctx.res

    ###*
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
    ###
    tcpFrame: tcpFrame

    ###*
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
    ###
    url: (opts) ->
        kit.require 'url'
        br = kit.require 'brush'

        if _.isString opts
            opts = { url: opts }

        opts ?= {}

        _.defaults opts, {
            globalBps: false
            # agent: if opts.protocol == 'https:' then proxy.httpsAgent else proxy.agent
            protocol: 'http:'
            isForceHeaderHost: false
            handleReqData: (req) -> req.body || req
            handleReqHeaders: (headers) -> headers
            handleResHeaders: (headers) -> headers
            handleUrl: (url) -> url
            error: (e, req) ->
                kit.logs e.toString(), '->', br.red(req.url)
        }

        if opts.handleResBody and not opts.handleResPipe
            opts.handleResPipe = (res, resPipe) -> null

        normalizeUrl = (req, url) ->
            if not url
                url = req.url

            opts.handleUrl if _.isString url
                sepIndex = url.indexOf('/')

                switch sepIndex
                    # such as url is '/get/page'
                    when 0
                        {
                            protocol: opts.protocol
                            host: req.headers.host
                            path: url
                        }

                    # such as url is 'test.com'
                    when -1
                        {
                            protocol: opts.protocol
                            host: url
                            path: kit.url.parse(req.url).path
                        }

                    # such as url is 'http://a.com/test'
                    else
                        kit.url.parse url
            else
                url

        normalizeStream = (res) ->
            if _.isNumber opts.bps
                if opts.globalBps
                    sockNum = _.keys(opts.agent.sockets).length
                    bps = opts.bps / (sockNum + 1)
                else
                    bps = opts.bps

                throttle = new kit.requireOptional('throttle', __dirname)(bps)

                throttle.pipe res
                throttle
            else
                res

        (ctx) ->
            { req, res } = ctx
            url = normalizeUrl req, opts.url
            headers = opts.handleReqHeaders req.headers, req

            if opts.isForceHeaderHost and opts.url
                headers['Host'] = url.host

            p = kit.request {
                method: req.method
                url
                headers
                resPipe: normalizeStream(res)
                reqData: opts.handleReqData(req)
                autoTE: false
                handleResPipe: opts.handleResPipe
                autoUnzip: false
                agent: opts.agent
                body: false
                resPipeError: ->
                    res.statusCode = 502
                    res.end 'Proxy Error: ' + http.STATUS_CODES[502]
            }

            if opts.handleResBody
                p = p.then (proxyRes) ->
                    return if _.isUndefined proxyRes.body

                    ctx.body = opts.handleResBody proxyRes.body, req, proxyRes
                    hs = opts.handleResHeaders proxyRes.headers, req, proxyRes
                    kit.logs(ctx.body)
                    for k, v of hs
                        res.setHeader k, v
                    res.statusCode = proxyRes.statusCode
            else
                p.req.on 'response', (proxyRes) ->
                    res.writeHead(
                        proxyRes.statusCode
                        opts.handleResHeaders proxyRes.headers, req, proxyRes
                    )

            p.catch (e) -> opts.error e, req

            p

    ###*
     * Add a `van` method to flow context object. It's a helper to set
     * and get the context body.
     * @param  {FlowContext} ctx
    ###
    van: (ctx) ->
        ctx.van = ->
            if arguments.length == 0
                ctx.req.body
            else
                ctx.body = arguments[0]
        ctx.next()

module.exports = proxy
