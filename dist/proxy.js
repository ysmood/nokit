
/**
 * For test, page injection development.
 * A cross-platform programmable Fiddler alternative.
 * You can even replace express.js with it's `mid` function.
 */
var Overview, Promise, _, http, kit, proxy;

Overview = 'proxy';

kit = require('./kit');

_ = kit._, Promise = kit.Promise;

http = require('http');

proxy = {
  agent: new http.Agent,

  /**
  	 * Http CONNECT method tunneling proxy helper.
  	 * Most times used with https proxing.
  	 * @param {http.IncomingMessage} req
  	 * @param {net.Socket} sock
  	 * @param {Buffer} head
  	 * @param {String} host The host force to. It's optional.
  	 * @param {Int} port The port force to. It's optional.
  	 * @param {Function} err Custom error handler.
  	 * @example
  	 * ```coffee
  	 * kit = require 'nokit'
  	 * kit.require 'proxy'
  	 * http = require 'http'
  	 *
  	 * server = http.createServer()
  	 *
  	 * # Directly connect to the original site.
  	 * server.on 'connect', kit.proxy.connect
  	 *
  	 * server.listen 8123
  	 * ```
   */
  connect: function(req, sock, head, host, port, err) {
    var error, h, net, p, psock;
    net = kit.require('net', __dirname);
    h = host || req.headers.host;
    p = port || req.url.match(/:(\d+)$/)[1] || 443;
    psock = new net.Socket;
    psock.connect(p, h, function() {
      psock.write(head);
      return sock.write("HTTP/" + req.httpVersion + " 200 Connection established\r\n\r\n");
    });
    sock.pipe(psock);
    psock.pipe(sock);
    error = err || function(err, socket) {
      var cs;
      cs = kit.require('colors/safe');
      kit.log(err.toString() + ' -> ' + cs.red(req.url));
      return socket.end();
    };
    sock.on('error', function(err) {
      return error(err, sock);
    });
    return psock.on('error', function(err) {
      return error(err, psock);
    });
  },

  /**
  	 * A promise based middlewares proxy.
  	 * @param  {Array} middlewares Each item is a function `(ctx) -> Promise`,
  	 * or an object:
  	 * ```coffee
  	 * {
  	 * 	url: String | Regex | Function
  	 * 	method: String | Regex | Function
  	 * 	handler: ({ body, req, res, next, url, method }) -> Promise
  	 *
  	 * 	# When this, it will be assigned to ctx.body
  	 * 	handler: String | Object | Array
  	 *
  	 * 	error: (ctx, err) -> Promise
  	 * }
  	 * ```
  	 * <h4>selector</h4>
  	 * The `url` and `method` are act as selectors. If current
  	 * request matches the selector, the `handler` will be called with the
  	 * captured result. If the selector is a function, it should return a
  	 * truthy value when matches, it will be assigned to the `ctx`.
  	 * When the `url` is a string, if `req.url` starts with the `url`, the rest
  	 * of the string will be captured.
  	 * <h4>handler</h4>
  	 * If the handler has async operation inside, it should return a promise.
  	 * <h4>error</h4>
  	 * If any previous middleware rejects, current error handler will be called.
  	 * <h4>body</h4>
  	 * The `body` can be a `String`, `Buffer`, `Stream`, `Object` or `Promise`.
  	 * If `body == next`, the proxy won't end the request automatically, which means
  	 * you can handle the `res.end()` yourself.
  	 * <h4>next</h4>
  	 * The `next = -> next` function is a function that returns itself. If a handler
  	 * resolves the value `next`, middleware next to it will be called.
  	 * @param {opts} opts Defaults:
  	 * ```coffee
  	 * {
  	 * 	# If it returns true, the http will end with 304.
  	 * 	etag: (ctx, data, isStr) -> Boolean
  	 * }
  	 * ```
  	 * @return {Function} `(req, res) -> Promise` The http request listener.
  	 * @example
  	 * ```coffee
  	 * proxy = kit.require 'proxy'
  	 * http = require 'http'
  	 *
  	 * middlewares = [
  	 * 	(ctx) ->
  	 * 		kit.log 'access: ' + ctx.req.url
  	 * 		# We need the other handlers to handle the response.
  	 * 		kit.sleep(300).then -> ctx.next
  	 * 	{
  	 * 		url: /\/items\/(\d+)$/
  	 * 		handler: (ctx) ->
  	 * 			ctx.body = kit.sleep(300).then -> { id: ctx.url[1] }
  	 * 	}
  	 * 	{
  	 * 		url: '/api'
  	 * 		handler: { fake: 'api' }
  	 * 	}
  	 * 	{
  	 * 		error: (ctx, err) ->
  	 			ctx.statusCode = 500
  	 * 			ctx.body = err
  	 * 	}
  	 * ]
  	 *
  	 * http.createServer proxy.mid(middlewares).listen 8123
  	 * ```
  	 * @example
  	 * Use with normal thrid middlewares. This example will map
  	 * `http://127.0.0.1:8123/st` to the `static` folder.
  	 * ```coffee
  	 * proxy = kit.require 'proxy'
  	 * http = require 'http'
  	 * send = require 'send'
  	 *
  	 * middlewares = [
  	 * 	{
  	 * 		url: '/st'
  	 * 		handler: (ctx) ->
  	 * 			ctx.body = send(ctx.req, ctx.url, { root: 'static' })
  	 * 	}
  	 * ]
  	 *
  	 * http.createServer proxy.mid(middlewares).listen 8123
  	 * ```
  	 * @example
  	 * Express like path to named capture.
  	 * ```coffee
  	 * proxy = kit.require 'proxy'
  	 * http = require 'http'
  	 *
  	 * middlewares = [
  	 * 	{
  	 * 		url: proxy.match '/items/:id'
  	 * 		handler: (ctx) ->
  	 * 			ctx.body = ctx.url.id
  	 * 	}
  	 * ]
  	 *
  	 * http.createServer proxy.mid(middlewares).listen 8123
  	 * ```
   */
  mid: function(middlewares, opts) {
    var Stream, endCtx, endRes, etag, jhash, match, next, tryMid;
    if (opts == null) {
      opts = {};
    }
    Stream = require('stream');
    jhash = new (kit.require('jhash').constructor);
    _.defaults(opts, {
      etag: function(ctx, data, isStr) {
        var hash;
        hash = isStr ? jhash.hashStr(data) : jhash.hashArr(data);
        if (+ctx.req.headers['if-none-match'] === hash) {
          ctx.res.statusCode = 304;
          ctx.res.end();
          return true;
        }
        ctx.res.setHeader('ETag', hash);
        return false;
      }
    });
    etag = opts.etag;
    match = function(ctx, obj, key, pattern) {
      var ret;
      if (pattern === void 0) {
        return true;
      }
      ret = _.isString(pattern) ? key === 'url' && _.startsWith(obj[key], pattern) ? obj[key].slice(pattern.length) : obj[key] === pattern ? obj[key] : void 0 : _.isRegExp(pattern) ? obj[key].match(pattern) : _.isFunction(pattern) ? pattern(obj[key]) : void 0;
      if (ret !== void 0) {
        return ctx[key] = ret;
      }
    };
    next = function() {
      return next;
    };
    endRes = function(ctx, data, isStr) {
      var buf;
      if (etag(ctx, data, isStr)) {
        return;
      }
      if (isStr) {
        buf = new Buffer(data);
      }
      ctx.res.setHeader('Content-Length', buf.length);
      ctx.res.end(buf);
    };
    endCtx = function(ctx) {
      var body, res;
      body = ctx.body;
      res = ctx.res;
      if (body === next) {
        return;
      }
      switch (typeof body) {
        case 'string':
          endRes(ctx, body, true);
          break;
        case 'object':
          if (body === null) {
            res.end();
          } else if (body instanceof Stream) {
            body.pipe(res);
          } else if (body instanceof Buffer) {
            endRes(ctx, body);
          } else if (_.isFunction(body.then)) {
            body.then(function(body) {
              return endBody(ctx);
            });
          } else {
            res.setHeader('Content-type', 'application/json');
            endRes(ctx, JSON.stringify(body), true);
          }
          break;
        case 'undefined':
          res.end();
          break;
        default:
          endRes(ctx, body.toString(), true);
      }
    };
    tryMid = function(fn, ctx, err) {
      var e;
      try {
        return fn(ctx, err);
      } catch (_error) {
        e = _error;
        return Promise.reject(e);
      }
    };
    return function(req, res) {
      var ctx, errIter, index, iter;
      index = 0;
      ctx = {
        req: req,
        res: res,
        body: null,
        next: next
      };
      iter = function(flag) {
        var m, ret;
        if (flag !== next) {
          return endCtx(ctx);
        }
        m = middlewares[index++];
        if (!m) {
          res.statusCode = 404;
          ctx.body = http.STATUS_CODES[404];
          return endCtx(ctx);
        }
        ret = _.isFunction(m) ? tryMid(m, ctx) : match(ctx, req, 'method', m.method) && match(ctx, req, 'url', m.url) ? _.isFunction(m.handler) ? tryMid(m.handler, ctx) : m.handler ? ctx.body = m.handler : next : next;
        if (kit.isPromise(ret)) {
          ret.then(iter, errIter);
        } else {
          iter(ret);
        }
      };
      errIter = function(err) {
        var m, ret;
        m = middlewares[index++];
        if (!m) {
          ctx.res.statusCode = 500;
          ctx.body = kit.isDevelopment() ? "<pre>" + (err instanceof Error ? err.stack : err) + "</pre>" : void 0;
          endCtx(ctx);
          return;
        }
        if (m && m.error) {
          ret = tryMid(m.error, ctx, err);
        } else {
          errIter(err);
          return;
        }
        if (kit.isPromise(ret)) {
          ret.then(iter, errIter);
        } else {
          iter(ret);
        }
      };
      iter(next);
    };
  },

  /**
  	 * Generate an express like unix path selector. See the example of `proxy.mid`.
  	 * @param {String} pattern
  	 * @param {Object} opts Same as the [path-to-regexp](https://github.com/pillarjs/path-to-regexp)'s
  	 * options.
  	 * @return {Function} `(String) -> Object`.
  	 * @example
  	 * ```coffee
  	 * proxy = kit.require 'proxy'
  	 * match = proxy.match '/items/:id'
  	 * kit.log match '/items/10' # output => { id: '10' }
  	 * ```
   */
  match: function(pattern, opts) {
    var keys, parse, reg;
    parse = kit.requireOptional('path-to-regexp', __dirname, '^1.2.0');
    keys = [];
    reg = parse(pattern, keys, opts);
    return function(url) {
      var ms;
      ms = url.match(reg);
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
  	 * Create a static file middleware for `proxy.mid`.
  	 * @param  {String | Regex | Function} url Same as the url in `proxy.mid`.
  	 * @param  {String | Object} opts Same as the [send](https://github.com/pillarjs/send)'s.
  	 * @return {Object} The middleware of `porxy.mid`.
  	 * ```coffee
  	 * proxy = kit.require 'proxy'
  	 * http = require 'http'
  	 *
  	 * middlewares = [proxy.static('/st', 'static')]
  	 *
  	 * http.createServer proxy.mid(middlewares).listen 8123
  	 * ```
   */
  "static": function(url, opts) {
    var send;
    send = kit.requireOptional('send', __dirname, '^0.13.0');
    if (_.isString(opts)) {
      opts = {
        root: opts
      };
    }
    return {
      url: url,
      method: 'GET',
      handler: function(ctx) {
        var path, query;
        query = ctx.url.indexOf('?');
        path = query < 0 ? ctx.url : ctx.url.slice(0, query);
        return ctx.body = send(ctx.req, path, opts);
      }
    };
  },

  /**
  	 * Use it to proxy one url to another.
  	 * @param {http.IncomingMessage} req Also supports Express.js.
  	 * @param {http.ServerResponse} res Also supports Express.js.
  	 * @param {String | Object} url The target url forced to. Optional.
  	 * Such as force 'http://test.com/a' to 'http://test.com/b',
  	 * force 'http://test.com/a' to 'http://other.com/a',
  	 * force 'http://test.com' to 'other.com'.
  	 * It can also be an url object. Such as
  	 * `{ protocol: 'http:', host: 'test.com:8123', pathname: '/a/b', query: 's=1' }`.
  	 * @param {Object} opts Other options. Default:
  	 * ```coffee
  	 * {
  	 * 	# Limit the bandwidth byte per second.
  	 * 	bps: null
  	 *
  	 * 	# if the bps is the global bps.
  	 * 	globalBps: false
  	 *
  	 * 	agent: customHttpAgent
  	 *
  	 * 	# You can hack the headers before the proxy send it.
  	 * 	handleReqHeaders: (headers) -> headers
  	 * 	handleResHeaders: (headers) -> headers
  	 * }
  	 * ```
  	 * @param {Function} err Custom error handler.
  	 * @return {Promise}
  	 * @example
  	 * ```coffee
  	 * kit = require 'nokit'
  	 * kit.require 'proxy'
  	 * kit.require 'url'
  	 * http = require 'http'
  	 *
  	 * server = http.createServer (req, res) ->
  	 * 	url = kit.url.parse req.url
  	 * 	switch url.path
  	 * 		when '/a'
  	 * 			kit.proxy.url req, res, 'a.com', (err) ->
  	 * 				kit.log err
  	 * 		when '/b'
  	 * 			kit.proxy.url req, res, '/c'
  	 * 		when '/c'
  	 * 			kit.proxy.url req, res, 'http://b.com/c.js'
  	 * 		else
  	 * 			# Transparent proxy.
  	 * 			service.use kit.proxy.url
  	 *
  	 * server.listen 8123
  	 * ```
   */
  url: function(req, res, url, opts, err) {
    var bps, error, headers, k, nk, p, path, ref, sepIndex, sockNum, stream, throttle, v;
    if (opts == null) {
      opts = {};
    }
    kit.require('url');
    _.defaults(opts, {
      bps: null,
      globalBps: false,
      agent: proxy.agent,
      handleReqHeaders: function(headers) {
        return headers;
      },
      handleResHeaders: function(headers) {
        return headers;
      }
    });
    if (!url) {
      url = req.url;
    }
    if (_.isObject(url)) {
      url = kit.url.format(url);
    } else {
      sepIndex = url.indexOf('/');
      switch (sepIndex) {
        case 0:
          url = 'http://' + req.headers.host + url;
          break;
        case -1:
          path = kit.url.parse(req.url).path;
          url = 'http://' + url + path;
      }
    }
    error = err || function(e) {
      var cs;
      cs = kit.require('colors/safe');
      return kit.log(e.toString() + ' -> ' + cs.red(req.url));
    };
    headers = {};
    ref = req.headers;
    for (k in ref) {
      v = ref[k];
      nk = k.replace(/(\w)(\w*)/g, function(m, p1, p2) {
        return p1.toUpperCase() + p2;
      });
      headers[nk] = v;
    }
    headers = opts.handleReqHeaders(headers);
    stream = opts.bps === null ? res : (opts.globalBps ? (sockNum = _.keys(opts.agent.sockets).length, bps = opts.bps / (sockNum + 1)) : bps = opts.bps, throttle = new kit.requireOptional('throttle', __dirname)(bps), throttle.pipe(res), throttle);
    p = kit.request({
      method: req.method,
      url: url,
      headers: headers,
      reqPipe: req,
      resPipe: stream,
      autoUnzip: false,
      agent: opts.agent
    });
    p.req.on('response', function(proxyRes) {
      return res.writeHead(proxyRes.statusCode, opts.handleResHeaders(proxyRes.headers));
    });
    return p["catch"](error);
  }
};

module.exports = proxy;
