
/**
 * For test, page injection development.
 * A cross-platform programmable Fiddler alternative.
 */
var Overview, _, http, kit, proxy;

Overview = 'proxy';

kit = require('./kit');

_ = kit._;

http = require('http');

proxy = {
  agent: new http.Agent,

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
  }
};

module.exports = proxy;
