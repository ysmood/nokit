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
	 * 	headers: String | Regex | Function
	 * 	method: String | Regex | Function
	 * 	handler: ({ body, req, res, next, url, headers, method }) -> Promise
	 * }
	 * ```
	 * <h4>selector</h4>
	 * The `url`, `headers` and `method` are act as selectors. If current
	 * request matches the selector, the `handler` will be called with the
	 * captured result. If the selector is a function, it should return a
	 * truthy value when matches, it will be assigned to the `ctx`.
	 * When the `url` is a string, if `req.url` starts with the `url`, the rest
	 * of the string will be captured.
	 * <h4>handler</h4>
	 * If the handler has async operation inside, it should return a promise.
	 * <h4>body</h4>
	 * The `body` can be a `String`, `Buffer`, `Stream`, `Object` or `Promise`.
	 * If `body == next`, the proxy won't end the request automatically, which means
	 * you can handle the `res.end()` yourself.
	 * <h4>next</h4>
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
	 * @example
	 * Express like path to named capture.
	 * ```coffee
	 * proxy = kit.require 'proxy'
	 * http = require 'http'
	 *
	 * middlewares = [
	 * 	{
	 * 		url: proxy.matchPath '/items/:id'
	 * 		handler: (ctx) ->
	 * 			ctx.body = ctx.url.id
	 * 	}
	 * ]
	 *
	 * http.createServer proxy.mid(middlewares).listen 8123
	 * ```
	###
	mid: (middlewares) ->
		Stream = require 'stream'

		match = (ctx, obj, key, pattern) ->
			return true if pattern == undefined

			ret = if _.isString(pattern)
				if key == 'url' and _.startsWith(obj[key], pattern)
					obj[key].slice pattern.length
				else if obj[key] == pattern
					obj[key]
			else if _.isRegExp pattern
				obj[key].match pattern
			else if _.isFunction pattern
				pattern obj[key]

			if ret != undefined
				ctx[key] = ret

		matchObj = (ctx, obj, key, target) ->
			return true if target == undefined

			ret = {}

			for k, v of target
				return false if not match ret, obj[key], k, v

			ctx[key] = ret
			return true

		next = (fn) ->
			return next if not fn
			@nextFns ?= []
			@nextFns.push fn
			return next

		endResStr = (res, str) ->
			buf = new Buffer str
			res.setHeader 'Content-Length', buf.length
			res.end buf

		endRes = (res, body) ->
			return if body == next

			switch typeof body
				when 'string'
					endResStr res, body
				when 'object'
					if body == null
						res.end()
					else if body instanceof Stream
						body.pipe res
					else if body instanceof Buffer
						res.end body
					else if _.isFunction body.then
						body.then (body) -> endRes res, body
					else
						res.setHeader 'Content-type', 'application/json'
						endResStr res, JSON.stringify body
				when 'undefined'
					res.end()
				else
					endResStr res, body.toString()

			return

		(req, res) ->
			index = 0

			ctx = { req, res, body: null, next }

			end = ->
				if ctx.nextFns
					p = Promise.resolve()
					for fn in ctx.nextFns
						p = p.then fn
					p.then ->
						endRes res, ctx.body
				else
					endRes res, ctx.body

				return

			iter = (flag) ->
				if flag != next
					return end()

				m = middlewares[index++]

				if not m
					res.statusCode = 404
					ctx.body = http.STATUS_CODES[404]
					return end()

				ret = if _.isFunction m
					m ctx
				else if match(ctx, req, 'method', m.method) and
				match(ctx, req, 'url', m.url) and
				matchObj(ctx, req, 'headers', m.headers)
					m.handler ctx
				else
					next

				if ret and _.isFunction(ret.then)
					ret.then iter
				else
					iter ret

				return

			iter next

			return

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
	###
	static: (url, opts) ->
		send = kit.requireOptional 'send', __dirname, '^0.13.0'

		if _.isString opts
			opts = { root: opts }

		{
			url: url
			method: 'GET'
			handler: (ctx) ->
				query = ctx.url.indexOf('?')
				path = if query < 0 then ctx.url else ctx.url.slice 0, query
				ctx.body = send ctx.req, (path), opts
		}

	###*
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
	###
	url: (req, res, url, opts = {}, err) ->
		kit.require 'url'

		_.defaults opts, {
			bps: null
			globalBps: false
			agent: proxy.agent
			handleReqHeaders: (headers) -> headers
			handleResHeaders: (headers) -> headers
		}

		if not url
			url = req.url

		if _.isObject url
			url = kit.url.format url
		else
			sepIndex = url.indexOf('/')
			switch sepIndex
				# such as url is '/get/page'
				when 0
					url = 'http://' + req.headers.host + url
				# such as url is 'test.com'
				when -1
					{ path } = kit.url.parse(req.url)

					url = 'http://' + url + path

		error = err or (e) ->
			cs = kit.require 'colors/safe'
			kit.log e.toString() + ' -> ' + cs.red req.url

		# Normalize the headers
		headers = {}
		for k, v of req.headers
			nk = k.replace(/(\w)(\w*)/g, (m, p1, p2) -> p1.toUpperCase() + p2)
			headers[nk] = v

		headers = opts.handleReqHeaders headers

		stream = if opts.bps == null
			res
		else
			if opts.globalBps
				sockNum = _.keys(opts.agent.sockets).length
				bps = opts.bps / (sockNum + 1)
			else
				bps = opts.bps

			throttle = new kit.requireOptional('throttle', __dirname)(bps)

			throttle.pipe res
			throttle

		p = kit.request {
			method: req.method
			url
			headers
			reqPipe: req
			resPipe: stream
			autoUnzip: false
			agent: opts.agent
		}

		p.req.on 'response', (proxyRes) ->
			res.writeHead(
				proxyRes.statusCode
				opts.handleResHeaders proxyRes.headers
			)

		p.catch error

module.exports = proxy
