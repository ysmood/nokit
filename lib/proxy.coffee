###*
 * For test, page injection development.
 * A cross-platform programmable Fiddler alternative.
 * You can even replace express.js with it's `mid` function.
###
Overview = 'proxy'

kit = require './kit'
{ _, Promise } = kit
http = require 'http'

proxy =

	agent: new http.Agent

	###*
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
	###
	connect: (req, sock, head, host, port, err) ->
		net = kit.require 'net', __dirname
		h = host or req.headers.host
		p = port or req.url.match(/:(\d+)$/)[1] or 443

		psock = new net.Socket
		psock.connect p, h, ->
			psock.write head
			sock.write "
				HTTP/#{req.httpVersion} 200 Connection established\r\n\r\n
			"

		sock.pipe psock
		psock.pipe sock

		error = err or (err, socket) ->
			cs = kit.require 'colors/safe'
			kit.log err.toString() + ' -> ' + cs.red req.url
			socket.end()

		sock.on 'error', (err) ->
			error err, sock
		psock.on 'error', (err) ->
			error err, psock

	###*
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
	 * the promise can reject an error with a http `statusCode` property.
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
	 * @return {Function} `(req, res) -> Promise | Any` The http request listener.
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
	 * 	# Express middleware
	 * 	proxy.normalizeMid bodyParser.json()
	 *
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
	###
	mid: (middlewares, opts = {}) ->
		Stream = require 'stream'
		jhash = new (kit.require('jhash').constructor)

		_.defaults opts, {
			etag: (ctx, data, isStr) ->
				hash = if isStr
					jhash.hashStr data
				else
					jhash.hashArr data

				if +ctx.req.headers['if-none-match'] == hash
					ctx.res.statusCode = 304
					ctx.res.end()
					return true

				ctx.res.setHeader 'ETag', hash

				return false
		}

		etag = opts.etag

		match = (ctx, obj, key, pattern) ->
			return true if pattern == undefined

			ret = if _.isString(pattern)
				if key == 'url' and _.startsWith(obj[key], pattern)
					ctx.req.originalUrl = ctx.req.url
					ctx.req.url = obj[key].slice pattern.length
				else if obj[key] == pattern
					obj[key]
			else if _.isRegExp pattern
				obj[key].match pattern
			else if _.isFunction pattern
				pattern obj[key]

			if ret != undefined and ret != null
				ctx[key] = ret
				true

		matchObj = (ctx, obj, key, target) ->
			return true if target == undefined

			ret = {}

			for k, v of target
				return false if not match ret, obj[key], k, v

			ctx[key] = ret
			return true

		endRes = (ctx, data, isStr) ->
			return if etag ctx, data, isStr

			buf = if isStr then new Buffer data else data
			if not ctx.res.headersSent
				ctx.res.setHeader 'Content-Length', buf.length
			ctx.res.end buf

			return

		endCtx = (ctx) ->
			body = ctx.body
			res = ctx.res

			return if body == ctx

			switch typeof body
				when 'string'
					endRes ctx, body, true
				when 'object'
					if body == null
						res.end()
					else if body instanceof Stream
						body.pipe res
					else if body instanceof Buffer
						endRes ctx, body
					else if _.isFunction body.then
						return body.then (data) ->
							ctx.body = data
							endCtx ctx
					else
						if not ctx.res.headersSent
							res.setHeader 'Content-Type', 'application/json'
						endRes ctx, JSON.stringify(body), true
				when 'undefined'
					res.end()
				else
					endRes ctx, body.toString(), true

			return

		$err = {}
		tryMid = (fn, ctx, err) ->
			try
				fn ctx, err
			catch e
				$err.e = e
				$err

		(req, res) ->
			if not res
				parentCtx = req
				{ req, res } = parentCtx

			ctx = { req, res, body: null }

			index = 0
			ctx.next = ->
				m = middlewares[index++]
				if not m
					return parentCtx.next() if parentCtx
					res.statusCode = 404
					return Promise.reject()

				ret = if _.isFunction m
					tryMid m, ctx
				else if match(ctx, req, 'method', m.method) and
				matchObj(ctx, req, 'headers', m.headers) and
				match(ctx, req, 'url', m.url)
					if _.isFunction m.handler
						tryMid m.handler, ctx
					else if m.handler != undefined
						ctx.body = m.handler

				if ret == $err
					return Promise.reject $err.e

				Promise.resolve ret

			ctx.next().then ->
				endCtx ctx
			, (err) ->
				if res.statusCode != 404
					res.statusCode = 500

				ctx.body = if err
					"""<pre>
					#{if err instanceof Error then err.stack else err}
					</pre>"""
				else
					ctx.body = http.STATUS_CODES[res.statusCode]

				endCtx ctx

	###*
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
	###
	match: (pattern, opts) ->
		parse = kit.requireOptional 'path-to-regexp', __dirname, '^1.2.0'
		keys = []
		reg = parse pattern, keys, opts

		(url) ->
			ms = url.match reg
			return if ms == null
			ms.reduce (ret, elem, i) ->
				return {} if i == 0
				ret[keys[i - 1].name] = elem
				ret
			, null

	###*
	 * Convert a Express-like middleware to `proxy.mid` middleware.
	 * @param  {Function} h `(req, res, next) ->`
	 * @return {Function}   `(ctx) -> Promise`
	###
	normalizeMid: (h) ->
		return h if h.length < 2

		(ctx) ->
			new Promise (resolve, reject) ->
				ctx.body = ctx.next
				h ctx.req, ctx.res, (err) ->
					ctx.body = null
					if err
						reject err
					else
						resolve ctx.next

					return

	###*
	 * Create a http request handler middleware.
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
	 * http = require 'http'
	 * handler = kit.serverHelper()
	 *
	 * http.createServer (req, res) ->
	 * 	handler req, res, ->
	 * 		res.end kit.browserHelper()
	 *
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
	###
	serverHelper: (opts) ->
		cs = kit.require 'colors/safe'

		handler = (ctx) ->
			{ req, res } = ctx
			switch req.url
				when '/nokit-sse'
					handler.sse req, res
					ctx.body = ctx.next
				when '/nokit-log'
					data = ''

					req.on 'data', (chunk) ->
						data += chunk

					req.on 'end', ->
						try
							kit.log cs.cyan('client') + cs.grey(' | ') +
							if data
								kit.xinspect JSON.parse(data)
							else
								data
							res.end()
						catch e
							res.statusCode = 500
							res.end(e.stack)
					ctx.body = ctx.next
				else
					ctx.next

		handler.sse = kit.require('sse')(opts)

		watchList = []
		handler.watch = (path, url) ->
			return if _.contains watchList, path

			kit.fileExists(path).then (exists) ->
				return if not exists

				kit.logs cs.cyan('watch:'), path, cs.magenta('|'), url
				watchList.push path
				kit.watchPath path, {
					handler: ->
						kit.logs cs.cyan('changed:'), url
						handler.sse.emit 'fileModified', url
				}

		handler

	###*
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
	###
	static: (opts) ->
		send = kit.requireOptional 'send', __dirname, '^0.13.0'

		if _.isString opts
			opts = { root: opts }

		(ctx) -> new Promise (resolve, reject) ->
			query = ctx.url.indexOf '?'
			path = if query < 0 then ctx.url else ctx.url.slice 0, query

			s = send ctx.req, path, opts

			if opts.onFile
				s.on 'file', (path, stats) ->
					opts.onFile path, stats, ctx

			s.on 'error', (err) ->
				kit.log err.status
				if err.status == 404
					resolve ctx.next
				else
					err.statusCode = err.status
					reject err
			.pipe ctx.res

	###*
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
	###
	url: (opts = {}) ->
		kit.require 'url'
		cs = kit.require 'colors/safe'

		_.defaults opts, {
			globalBps: false
			agent: proxy.agent
			isForceHeaderHost: true
			handleReqHeaders: (headers) -> headers
			handleResHeaders: (headers) -> headers
			handleUrl: (url) -> url
			error: (e, req) ->
				kit.logs e.toString(), '->', cs.red(req.url)
		}

		uppperCase = (m, p1, p2) -> p1.toUpperCase() + p2

		normalizeUrl = (req, url) ->
			if not url
				url = req.url

			opts.handleUrl if _.isString url
				sepIndex = url.indexOf('/')

				switch sepIndex
					# such as url is '/get/page'
					when 0
						{
							protocol: 'http:'
							host: req.headers.host
							path: url
						}

					# such as url is 'test.com'
					when -1
						{
							protocol: 'http:'
							host: url
							path: kit.url.parse(req.url).path
						}

					# such as url is 'http://a.com/test'
					else
						kit.url.parse url
			else
				url

		normalizeStream = (res) ->
			return if opts.handleResBody

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
			stream = normalizeStream res

			if opts.isForceHeaderHost and opts.url
				headers['Host'] = url.host

			p = kit.request {
				method: req.method
				url
				headers
				reqPipe: req
				resPipe: stream
				autoUnzip: false
				agent: opts.agent
				body: not opts.handleResBody
				resPipeError: ->
					res.statusCode = 502
					res.end 'Proxy Error: ' + http.STATUS_CODES[502]
			}

			if opts.handleResBody
				p.then (proxyRes) ->
					ctx.body = opts.handleResBody proxyRes.body, req, proxyRes
					hs = opts.handleResHeaders proxyRes.headers, req, proxyRes
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

module.exports = proxy
