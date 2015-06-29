
/**
 * For test, page injection development.
 * A cross-platform programmable Fiddler alternative.
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
  	 * 	headers: String | Regex | Function
  	 * 	method: String | Regex | Function
  	 * 	handler: ({ body, req, res, next, url, headers, method }) -> Promise
  	 * }
  	 * ```
  	 * The `url`, `headers` and `method` are act as selectors. If current
  	 * request matches the selectors, the `handler` will be called with the
  	 * matched regex result. If the handler has async operation inside, it should
  	 * return a promise.
  	 * <h4>body</h4>
  	 * The `body` can be a `String`, `Buffer`, `Stream`, `Object` or `Promise`.
  	 * If `body == next`, the proxy won't end the request automatically, which means
  	 * you can handle the `res.end()` yourself.
  	 * <h4>`next`</h4>
  	 * The `next = (fn) -> next` function is a function that returns itself. Any handler that
  	 * resolves the `next` will be treated as a middleware. The functions passed to
  	 * `next` will be executed before the whole http request ends.
  	 * @return {Function} `(req, res) -> Promise` The http request listener.
  	 * @example
  	 * ```coffee
  	 * proxy = kit.require 'proxy'
  	 * http = require 'http'
  	 *
  	 * middlewares = [
  	 * 	(ctx) ->
  	 * 		# Record the time of the whole request
  	 * 		start = new Date
  	 * 		ctx.next => kit.sleep(300).then =>
  	 * 			ctx.res.setHeader 'x-response-time', new Date - start
  	 * 	(ctx) ->
  	 * 		kit.log 'access: ' + ctx.req.url
  	 * 		# We need the other handlers to handle the response.
  	 * 		kit.sleep(300).then -> ctx.next
  	 * 	{
  	 * 		url: /\/items\/(\d+)/
  	 * 		handler: (ctx) ->
  	 * 			ctx.body = kit.sleep(300).then -> { id: ctx.url[1] }
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
   */
  mid: function(middlewares) {
    var Stream, endRes, match, matchObj, next;
    Stream = require('stream');
    match = function(ctx, obj, key, pattern) {
      var ret;
      if (pattern === void 0) {
        return true;
      }
      ret = _.isString(pattern) && _.startsWith(obj[key], pattern) ? key === 'url' ? obj[key].slice(pattern.length) : obj[key] : _.isRegExp(pattern) ? obj[key].match(pattern) : _.isFunction(pattern) ? pattern(obj[key]) : void 0;
      if (ret !== void 0) {
        return ctx[key] = ret;
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
    next = function(fn) {
      if (!fn) {
        return next;
      }
      if (this.nextFns == null) {
        this.nextFns = [];
      }
      this.nextFns.push(fn);
      return next;
    };
    endRes = function(res, body) {
      if (body === next) {
        return;
      }
      switch (typeof body) {
        case 'string':
          res.end(body);
          break;
        case 'object':
          if (body === null) {
            res.end();
          } else if (body instanceof Stream) {
            body.pipe(res);
          } else if (body instanceof Buffer) {
            res.end(body);
          } else if (_.isFunction(body.then)) {
            body.then(function(body) {
              return endRes(res, body);
            });
          } else {
            res.setHeader('Content-type', 'application/json');
            res.end(JSON.stringify(body));
          }
          break;
        case 'undefined':
          res.end();
          break;
        default:
          res.end(body.toString());
      }
    };
    return function(req, res) {
      var ctx, end, index, iter;
      index = 0;
      ctx = {
        req: req,
        res: res,
        body: null,
        next: next
      };
      end = function() {
        var fn, i, len, p, ref;
        if (ctx.nextFns) {
          p = Promise.resolve();
          ref = ctx.nextFns;
          for (i = 0, len = ref.length; i < len; i++) {
            fn = ref[i];
            p = p.then(fn);
          }
          p.then(function() {
            return endRes(res, ctx.body);
          });
        } else {
          endRes(res, ctx.body);
        }
      };
      iter = function(flag) {
        var m, ret;
        if (flag !== next) {
          return end();
        }
        m = middlewares[index++];
        if (!m) {
          res.statusCode = 404;
          ctx.body = http.STATUS_CODES[404];
          return end();
        }
        ret = _.isFunction(m) ? m(ctx) : match(ctx, req, 'method', m.method) && match(ctx, req, 'url', m.url) && matchObj(ctx, req, 'headers', m.headers) ? m.handler(ctx) : next;
        if (ret && _.isFunction(ret.then)) {
          ret.then(iter);
        } else {
          iter(ret);
        }
      };
      iter(next);
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
