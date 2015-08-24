
/**
 * For test, page injection development.
 * A cross-platform programmable Fiddler alternative.
 * You can even replace express.js with it's `flow` function.
 */
var Overview, Promise, _, http, kit, proxy;

Overview = 'proxy';

kit = require('./kit');

_ = kit._, Promise = kit.Promise;

http = require('http');

proxy = {
  agent: new http.Agent,

  /**
  	 * A simple request body middleware.
  	 * @return {Function} `(ctx) -> Promise`
   */
  body: function(opts) {
    return function(ctx) {
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
          }
          return ctx.next().then(resolve, reject);
        });
      });
    };
  },

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
      var br;
      br = kit.require('brush');
      kit.log(err.toString() + ' -> ' + br.red(req.url));
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
          console.log('*****');
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
  	 * A promise based middlewares proxy.
  	 * @param  {Array} middlewares Each item is a function `(ctx) -> Promise | Any`,
  	 * or an object with the same type with `body`.
  	 * If the middleware has async operation inside, it should return a promise.
  	 * The promise can reject an error with a http `statusCode` property.
  	 * The members of `ctx`:
  	 * ```coffee
  	 * {
  	 * 	# It can be a `String`, `Buffer`, `Stream`, `Object` or a `Promise` contains previous types.
  	 * 	body: Any
  	 *
  	 * 	req: http.IncomingMessage
  	 *
  	 * 	res: http.IncomingMessage
  	 *
  	 * 	# It returns a promise which settles after all the next middlewares are setttled.
  	 * 	next: -> Promise
  	 * }
  	 * ```
  	 * @return {Function} `(req, res) -> Promise | Any` or `(ctx) -> Promise`.
  	 * The http request listener or middleware.
  	 * @example
  	 * ```coffee
  	 * proxy = kit.require 'proxy'
  	 * http = require 'http'
  	 *
  	 * middlewares = [
  	 * 	(ctx) ->
  	 * 		start = new Date
  	 * 		ctx.next().then ->
  	 * 			console.log ctx.req.url, new Date - start
  	 * 		, (err) ->
  	 * 			console.error err
  	 *
  	 * 	proxy.select { url: '/api' }, (ctx) ->
  	 * 		ctx.body = kit.sleep(300).then -> 'Hello World'
  	 *
  	 * 	proxy.select { url: /\/items\/(\d+)$/ }, { fake: 'api' }
  	 * ]
  	 *
  	 * http.createServer(proxy.flow middlewares).listen 8123
  	 * ```
  	 * @example
  	 * Express like path to named capture.
  	 * ```coffee
  	 * proxy = kit.require 'proxy'
  	 * http = require 'http'
  	 *
  	 * middlewares = [
  	 * 	proxy.select { url: proxy.match '/items/:id' }, (ctx) ->
  	 * 		ctx.body = ctx.url.id
  	 * ]
  	 *
  	 * http.createServer(proxy.flow middlewares).listen 8123
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
  	 * 	# Express middleware
  	 * 	proxy.midToFlow bodyParser.json()
  	 *
  	 * 	proxy.select { url: '/st' }, (ctx) ->
  	 * 		ctx.body = send(ctx.req, ctx.url, { root: 'static' })
  	 *
  	 * 	# sub-route
  	 * 	proxy.select { url: '/sub' }, proxy.flow([{
  	 * 		proxy.select { url: '/home' }, (ctx) ->
  	 * 			ctx.body = 'hello world'
  	 * 	}])
  	 * ]
  	 *
  	 * http.createServer(proxy.flow middlewares).listen 8123
  	 * ```
   */
  flow: function(middlewares) {
    var $err, Stream, endCtx, endRes, error, error404, tryMid;
    Stream = require('stream');
    endRes = function(ctx, data, isStr) {
      var buf;
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
            return body.then(function(data) {
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
    $err = {};
    tryMid = function(fn, ctx) {
      var e;
      try {
        return fn(ctx);
      } catch (_error) {
        e = _error;
        $err.e = e;
        return $err;
      }
    };
    error = function(err, ctx) {
      if (ctx.res.statusCode === 200) {
        ctx.res.statusCode = 500;
      }
      ctx.body = err ? "<pre>\n" + (err instanceof Error ? err.stack : err) + "\n</pre>" : ctx.body = http.STATUS_CODES[ctx.res.statusCode];
      return endCtx(ctx);
    };
    error404 = function(ctx) {
      ctx.res.statusCode = 404;
      ctx.body = http.STATUS_CODES[404];
      return Promise.resolve();
    };
    return function(req, res) {
      var ctx, index, originalUrl, parentNext;
      if (res) {
        ctx = {
          req: req,
          res: res,
          body: null
        };
      } else {
        ctx = req;
        parentNext = req.next;
        req = ctx.req, res = ctx.res;
        originalUrl = req.originalUrl;
        req.originalUrl = null;
      }
      index = 0;
      ctx.next = function() {
        var m, ret;
        if (_.isString(req.originalUrl)) {
          req.url = req.originalUrl;
        }
        m = middlewares[index++];
        if (m === void 0) {
          if (parentNext) {
            ctx.next = parentNext;
            req.originalUrl = originalUrl;
            return ctx.next();
          } else {
            return error404(ctx);
          }
        }
        ret = _.isFunction(m) ? tryMid(m, ctx) : ctx.body = m;
        if (ret === $err) {
          return Promise.reject($err.e);
        }
        return Promise.resolve(ret);
      };
      if (parentNext) {
        return ctx.next();
      } else {
        return ctx.next().then(function() {
          return endCtx(ctx);
        }, function(err) {
          return error(err, ctx);
        });
      }
    };
  },

  /**
  	 * Generate an express like unix path selector. See the example of `proxy.flow`.
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
  	 * Convert a Express-like middleware to `proxy.flow` middleware.
  	 * @param  {Function} h `(req, res, next) ->`
  	 * @return {Function}   `(ctx) -> Promise`
  	 * ```coffee
  	 * proxy = kit.require 'proxy'
  	 * http = require 'http'
  	 * bodyParser = require('body-parser')
  	 *
  	 * middlewares = [
  	 * 	proxy.midToFlow bodyParser.json()
  	 *
  	 * 	(ctx) -> ctx.body = ctx.req.body
  	 * ]
  	 *
  	 * http.createServer(proxy.flow middlewares).listen 8123
  	 * ```
   */
  midToFlow: function(h) {
    return function(ctx) {
      return new Promise(function(resolve, reject) {
        return h(ctx.req, ctx.res, function(err) {
          if (err) {
            reject(err);
          } else {
            ctx.next().then(resolve);
          }
        });
      });
    };
  },

  /**
  	 * Create a conditional middleware that only works when the pattern matches.
  	 * @param  {Object} sel The selector. Members:
  	 * ```coffee
  	 * {
  	 * 	url: String | Regex | Function
  	 * 	method: String | Regex | Function
  	 * 	headers: Object
  	 * }
  	 * ```
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
    matchKey = function(ctx, obj, key, pattern) {
      var ret, str;
      if (pattern === void 0) {
        return true;
      }
      str = obj[key];
      if (!_.isString(str)) {
        return false;
      }
      ret = _.isString(pattern) ? key === 'url' && _.startsWith(str, pattern) ? (ctx.req.originalUrl = ctx.req.url, ctx.req.url = str.slice(pattern.length)) : str === pattern ? str : void 0 : _.isRegExp(pattern) ? str.match(pattern) : _.isFunction(pattern) ? pattern(str) : void 0;
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
  	 * ```coffee
  	 * {
  	 * 	sse: kit.sse
  	 * 	watch: (filePath, reqUrl) ->
  	 * }
  	 * ```
  	 * @example
  	 * Visit 'http://127.0.0.1:80123', every 3 sec, the page will be reloaded.
  	 * If the `./static/default.css` is modified, the page will also be reloaded.
  	 * ```coffee
  	 * kit = require 'nokit'
  	 * http = require 'http'
  	 * proxy = kit.require 'proxy'
  	 * handler = kit.browserHelper()
  	 *
  	 * http.createServer proxy.flow [handler]
  	 * .listen 8123, ->
  	 * 	kit.log 'listen ' + 8123
  	 *
  	 * 	handler.watch './static/default.css', '/st/default.css'
  	 *
  	 * 	setInterval ->
  	 * 		handler.sse.emit 'fileModified', 'changed-file-path.js'
  	 * 	, 3000
  	 * ```
  	 * You can also use the `nokit.log` on the browser to log to the remote server.
  	 * ```coffee
  	 * nokit.log { any: 'thing' }
  	 * ```
   */
  serverHelper: function(opts) {
    var br, handler, watchList;
    br = kit.require('brush');
    handler = function(ctx) {
      var data, req, res;
      req = ctx.req, res = ctx.res;
      switch (req.url) {
        case '/nokit-sse':
          handler.sse(req, res);
          return new Promise(function() {});
        case '/nokit-log':
          data = '';
          req.on('data', function(chunk) {
            return data += chunk;
          });
          req.on('end', function() {
            var e;
            try {
              kit.log(br.cyan('client') + br.grey(' | ') + (data ? kit.xinspect(JSON.parse(data)) : data));
              return res.end();
            } catch (_error) {
              e = _error;
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
      if (_.contains(watchList, path)) {
        return;
      }
      return kit.fileExists(path).then(function(exists) {
        if (!exists) {
          return;
        }
        kit.logs(br.cyan('watch:'), path, br.magenta('|'), url);
        watchList.push(path);
        return kit.watchPath(path, {
          handler: function() {
            kit.logs(br.cyan('changed:'), url);
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
  	 * It has an extra option `{ onFile: (path, stats, ctx) -> }`.
  	 * @return {Function} The middleware handler of `porxy.flow`.
  	 * ```coffee
  	 * proxy = kit.require 'proxy'
  	 * http = require 'http'
  	 *
  	 * middlewares = [proxy.select { url: '/st' } proxy.static('static')]
  	 *
  	 * http.createServer(proxy.flow middlewares).listen 8123
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
  	 * Use it to proxy one url to another.
  	 * @param {Object | String} opts Other options, if it is a string, it will
  	 * be converted to `{ url: opts }`. Default:
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
  	 * 	# Same option as the `kit.request`'s `handleResPipe`.
  	 * 	handleResPipe: (res, stream) -> stream
  	 *
  	 * 	# Manipulate the response body content of the response here,
  	 * 	# such as inject script into it. Its return type is same as the `ctx.body`.
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
  	 * http.createServer(proxy.flow [
  	 * 	# Transparent proxy
  	 * 	proxy.select { url: '/a' }, proxy.url()
  	 *
  	 * 	# Porxy to `a.com`
  	 * 	proxy.select { url: '/b' }, proxy.url { url: 'a.com' }
  	 *
  	 *  # Porxy to a file
  	 * 	proxy.select { url: '/c' }, proxy.url { url: 'c.com/s.js' }
  	 *
  	 * 	proxy.select(
  	 * 		{ url: /\/$/, method: 'GET' }
  	 * 		proxy.url {
  	 * 			url: 'd.com'
  	 * 			# Inject script to html page.
  	 * 			handleResBody: (body, req, res) ->
  	 * 				if res.headers['content-type'].indexOf('text/html') > -1
  	 * 					body + '<script>alert("test")</script>'
  	 * 				else
  	 * 					body
  	 * 		}
  	 * 	)
  	 * ]).listen 8123
  	 * ```
   */
  url: function(opts) {
    var br, normalizeStream, normalizeUrl, uppperCase;
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
        return kit.logs(e.toString(), '->', br.red(req.url));
      }
    });
    if (opts.handleResBody && !opts.handleResPipe) {
      opts.handleResPipe = function(res, resPipe) {
        return null;
      };
    }
    uppperCase = function(m, p1, p2) {
      return p1.toUpperCase() + p2;
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
      var headers, p, req, res, stream, url;
      req = ctx.req, res = ctx.res;
      url = normalizeUrl(req, opts.url);
      headers = opts.handleReqHeaders(req.headers, req);
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
