
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
  	 *  # You can also use express-like middlewares.
  	 * 	handler: (req, res, next) ->
  	 *
  	 * 	# When this, it will be assigned to ctx.body
  	 * 	handler: String | Object | Promise | Stream
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
  	 * If the handler has async operation inside, it should return a promise,
  	 * the promise can reject with a http `statusCode` property.
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
  	 * @example
  	 * Use with normal thrid middlewares. This example will map
  	 * `http://127.0.0.1:8123/st` to the `static` folder.
  	 * ```coffee
  	 * proxy = kit.require 'proxy'
  	 * http = require 'http'
  	 * send = require 'send'
  	 * bodyParser = require('body-parser')
  	 *
  	 * middlewares = [
  	 * 	bodyParser.json() # Express middleware
  	 * 	{
  	 * 		url: '/st'
  	 * 		handler: (ctx) ->
  	 * 			ctx.body = send(ctx.req, ctx.url, { root: 'static' })
  	 * 	}
  	 *
  	 * 	# sub-route
  	 * 	{
  	 * 		url: '/sub'
  	 * 		handler: proxy.mid([{
  	 * 			url: '/home'
  	 * 			handler: (ctx) ->
  	 * 				ctx.body = 'hello world'
  	 * 		}])
  	 * 	}
  	 * ]
  	 *
  	 * http.createServer proxy.mid(middlewares).listen 8123
  	 * ```
   */
  mid: function(middlewares, opts) {
    var Stream, endCtx, endRes, etag, jhash, match, matchObj, next, normalizeHandler, tryMid;
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
      ret = _.isString(pattern) ? key === 'url' && _.startsWith(obj[key], pattern) ? (ctx.req.originalUrl = ctx.req.url, ctx.req.url = obj[key].slice(pattern.length)) : obj[key] === pattern ? obj[key] : void 0 : _.isRegExp(pattern) ? obj[key].match(pattern) : _.isFunction(pattern) ? pattern(obj[key]) : void 0;
      if (ret !== void 0 && ret !== null) {
        ctx[key] = ret;
        return true;
      }
    };
    matchObj = function(ctx, obj, key, target) {
      var k, ret, v;
      if (target === void 0) {
        return true;
      }
      ret = {};
      for (k in target) {
        v = target[k];
        if (!match(ret, obj[key], k, v)) {
          return false;
        }
      }
      ctx[key] = ret;
      return true;
    };
    next = function() {
      return next;
    };
    endRes = function(ctx, data, isStr) {
      var buf;
      if (etag(ctx, data, isStr)) {
        return;
      }
      buf = isStr ? new Buffer(data) : data;
      if (!ctx.res.headersSent) {
        ctx.res.setHeader('Content-Length', buf.length);
      }
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
            body.then(function(data) {
              ctx.body = data;
              return endCtx(ctx);
            });
          } else {
            if (!ctx.res.headersSent) {
              res.setHeader('Content-Type', 'application/json');
            }
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
    normalizeHandler = function(h) {
      if (h.length < 2) {
        return h;
      }
      return function(ctx) {
        return new Promise(function(resolve, reject) {
          ctx.body = ctx.next;
          return h(ctx.req, ctx.res, function(err) {
            ctx.body = null;
            if (err) {
              reject(err);
            } else {
              resolve(ctx.next);
            }
          });
        });
      };
    };
    return function(req, res, _next) {
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
          if (_.isFunction(_next)) {
            return _next();
          }
          res.statusCode = 404;
          ctx.body = http.STATUS_CODES[404];
          return endCtx(ctx);
        }
        ret = _.isFunction(m) ? tryMid(normalizeHandler(m), ctx) : match(ctx, req, 'method', m.method) && matchObj(ctx, req, 'headers', m.headers) && match(ctx, req, 'url', m.url) ? _.isFunction(m.handler) ? tryMid(normalizeHandler(m.handler), ctx) : m.handler === void 0 ? next : ctx.body = m.handler : next;
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
          if (_.isFunction(_next)) {
            return _next(err);
          }
          ctx.res.statusCode = err.statusCode || 500;
          ctx.body = kit.isDevelopment() ? "<pre>" + (err instanceof Error ? err.stack : err) + "</pre>" : http.STATUS_CODES[ctx.res.statusCode];
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
  	 * @param  {String | Object} opts Same as the [send](https://github.com/pillarjs/send)'s.
  	 * It has an extra option `{ onFile: (path, stats, ctx) -> }`.
  	 * @return {Function} The middleware handler of `porxy.mid`.
  	 * ```coffee
  	 * proxy = kit.require 'proxy'
  	 * http = require 'http'
  	 *
  	 * middlewares = [{
  	 * 	url: '/st'
  	 * 	handler: proxy.static('static')
  	 * }]
  	 *
  	 * http.createServer proxy.mid(middlewares).listen 8123
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
        var path, query, s;
        query = ctx.url.indexOf('?');
        path = query < 0 ? ctx.url : ctx.url.slice(0, query);
        s = send(ctx.req, path, opts);
        if (opts.onFile) {
          s.on('file', function(path, stats) {
            return opts.onFile(path, stats, ctx);
          });
        }
        return s.on('error', function(err) {
          kit.log(err.status);
          if (err.status === 404) {
            return resolve(ctx.next);
          } else {
            err.statusCode = err.status;
            return reject(err);
          }
        }).pipe(ctx.res);
      });
    };
  },

  /**
  	 * Use it to proxy one url to another.
  	 * @param {Object} opts Other options. Default:
  	 * ```coffee
  	 * {
  	 * 	# The target url forced to. Optional.
  	 * 	# Such as proxy 'http://test.com/a' to 'http://test.com/b',
  	 * 	# proxy 'http://test.com/a' to 'http://other.com/a',
  	 * 	# proxy 'http://test.com' to 'other.com'.
  	 * 	# It can also be an url object. Such as
  	 * 	# `{ protocol: 'http:', host: 'test.com:8123', pathname: '/a/b', query: 's=1' }`.
  	 * 	url: null
  	 *
  	 * 	# Limit the bandwidth byte per second.
  	 * 	bps: Integer
  	 *
  	 * 	# if the bps is the global bps.
  	 * 	globalBps: false
  	 *
  	 * 	agent: customHttpAgent
  	 *
  	 * 	# Force the header's host same as the url's.
  	 * 	isForceHeaderHost: true
  	 *
  	 * 	# You can hack the headers before the proxy send it.
  	 * 	handleReqHeaders: (headers, req) -> headers
  	 * 	handleResHeaders: (headers, req, proxyRes) -> headers
  	 *
  	 * 	# Manipulate the response body content of the response here,
  	 * 	# such as inject script into it.
  	 * 	handleResBody: (body, req, proxyRes) -> body
  	 *
  	 * 	# It will log some basic error info.
  	 * 	error: (e, req) ->
  	 * }
  	 * ```
  	 * @return {Function} `(req, res) -> Promise` A middleware.
  	 * @example
  	 * ```coffee
  	 * kit = require 'nokit'
  	 * proxy = kit.require 'proxy'
  	 * http = require 'http'
  	 *
  	 * http.createServer proxy.mid [{
  	 * 	url: '/a'
  	 * 	handler: proxy.url() # Transparent proxy
  	 * }, {
  	 * 	url: '/b'
  	 * 	handler proxy.url { url: 'a.com' } # Porxy to `a.com`
  	 * }, {
  	 * 	url: '/c'
  	 * 	handler proxy.url { url: 'c.com/s.js' } # Porxy to a file
  	 * }, {
  	 * 	url: /\/$/ # match path that ends with '/'
  	 * 	method: 'GET'
  	 * 	handler proxy.url {
  	 * 		url: 'd.com'
  	 * 		# Inject script to html page.
  	 * 		handleResBody: (body, req, res) ->
  	 * 			if res.headers['content-type'].indexOf('text/html') > -1
  	 * 				body + '<script>alert("test")</script>'
  	 * 			else
  	 * 				body
  	 * 	}
  	 * }]
  	 * .listen 8123
  	 * ```
   */
  url: function(opts) {
    var cs, headerUpReg, normalizeHeaders, normalizeStream, normalizeUrl, uppperCase;
    if (opts == null) {
      opts = {};
    }
    kit.require('url');
    cs = kit.require('colors/safe');
    _.defaults(opts, {
      globalBps: false,
      agent: proxy.agent,
      isForceHeaderHost: true,
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
        return kit.logs(e.toString(), '->', cs.red(req.url));
      }
    });
    uppperCase = function(m, p1, p2) {
      return p1.toUpperCase() + p2;
    };
    headerUpReg = /(\w)(\w*)/g;
    normalizeHeaders = function(headers, req) {
      var k, nheaders, nk, v;
      nheaders = {};
      for (k in headers) {
        v = headers[k];
        nk = k.replace(headerUpReg, uppperCase);
        nheaders[nk] = v;
      }
      return opts.handleReqHeaders(nheaders, req);
    };
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
      if (opts.handleResBody) {
        return;
      }
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
    return function(req, res) {
      var headers, p, stream, url;
      url = normalizeUrl(req, opts.url);
      headers = normalizeHeaders(req.headers, req);
      stream = normalizeStream(res);
      if (opts.isForceHeaderHost && opts.url) {
        headers['Host'] = url.host;
      }
      p = kit.request({
        method: req.method,
        url: url,
        headers: headers,
        reqPipe: req,
        resPipe: stream,
        autoUnzip: false,
        agent: opts.agent,
        body: !opts.handleResBody,
        resPipeError: function() {
          res.statusCode = 502;
          return res.end('Proxy Error: ' + http.STATUS_CODES[502]);
        }
      });
      if (opts.handleResBody) {
        p.then(function(proxyRes) {
          var body, hs;
          body = opts.handleResBody(proxyRes.body, req, proxyRes);
          if (!body instanceof Buffer) {
            body = new Buffer(body);
          }
          hs = opts.handleResHeaders(proxyRes.headers, req, proxyRes);
          hs['Content-Length'] = body.length;
          res.writeHead(proxyRes.statusCode, hs);
          return res.end(body);
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
