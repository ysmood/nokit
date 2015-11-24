###*
 * For test, page injection development.
 * A cross-platform programmable Fiddler alternative.
 * You can even replace express.js with it's `flow` function.
###
Overview = 'proxy'

kit = require './kit'
{ _, Promise } = kit
http = require 'http'
flow = require 'noflow'
{ Socket } = kit.require 'net', __dirname

regConnectHost = /([^:]+)(?::(\d+))?/
regTunnelBegin = /^\w+\:\/\//

proxy =

	agent: new http.Agent

	###*
	 * A simple request body middleware.
	 * @return {Function} `(ctx) -> Promise`
	###
	body: (opts) ->
		(ctx) -> new Promise (resolve, reject) ->
			buf = new Buffer 0
			ctx.req.on 'data', (chunk) ->
				buf = Buffer.concat [buf, chunk]
			ctx.req.on 'error', reject
			ctx.req.on 'end', ->
				ctx.reqBody = buf if buf.length > 0
				ctx.next().then resolve, reject

	###*
	 * Add a `van` method to flow context object. It's a helper to set
	 * and get the context body.
	 * @param  {FlowContext} ctx
	###
	van: (ctx) ->
		ctx.van = ->
			if arguments.length == 0
				ctx.body
			else
				ctx.body = arguments[0]
		ctx.next()

	###*
	 * Http CONNECT method tunneling proxy helper.
	 * Most times it is used to proxy https and websocket.
	 * @param {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	filter: (req) -> true # if it returns false, the proxy will be ignored
	 * 	host: null # Optional. The target host force to.
	 * 	port: null # Optional. The target port force to.
	 * 	onError: (err, socket) ->
	 * }
	 * ```
	 * @return {Function} The connect request handler.
	 * @example
	 * ```coffee
	 * kit = require 'nokit'
	 * proxy = kit.require 'proxy'
	 *
	 * app = proxy.flow()
	 *
	 * # Directly connect to the original site.
	 * app.server.on 'connect', kit.proxy.connect()
	 *
	 * app.listen 8123
	 * ```
	###
	connect: (opts = {}) ->
		_.defaults opts, {
			filter: (req) -> true
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

			isProxy = req.headers['proxy-connection']
			ms = if isProxy
				req.url.match regConnectHost
			else
				req.headers.host.match regConnectHost

			psock = new Socket
			psock.connect port or ms[2] or 80, host or ms[1], ->
				if isProxy
					sock.write "
						HTTP/#{req.httpVersion} 200 Connection established\r\n\r\n
					"
				else
					rawHeaders = "#{req.method} #{req.url} HTTP/#{req.httpVersion}\r\n"
					for h, i in req.rawHeaders
						rawHeaders += h + (if i % 2 == 0 then ': ' else '\r\n')

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
	 * A minimal middleware composer for the future.
	 * https://github.com/ysmood/noflow
	###
	flow: flow

	###*
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
	###
	midToFlow: (h) ->
		(ctx) ->
			new Promise (resolve, reject) ->
				h ctx.req, ctx.res, (err) ->
					if err
						reject err
					else
						ctx.next().then resolve

					return

	###*
	 * Create a conditional middleware that only works when the pattern matches.
	 * @param  {Object} sel The selector. Members:
	 * ```coffee
	 * {
	 * 	url: String | Regex | Function
	 * 	method: String | Regex | Function
	 * 	headers: Object
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
	 * ```coffee
	 * {
	 * 	ssePrefix: '/nokit-sse'
	 * 	logPrefix: '/nokit-log'
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
	###
	serverHelper: (opts) ->
		br = kit.require 'brush'

		handler = (ctx) ->
			{ req, res } = ctx
			switch req.url
				when opts.ssePrefix
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

		watchList = []
		handler.watch = (path, url) ->
			return if _.contains watchList, path

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
	 * It has an extra option `{ onFile: (path, stats, ctx) -> }`.
	 * @return {Function} The middleware handler of `porxy.flow`.
	 * ```coffee
	 * proxy = kit.require 'proxy'
	 * http = require 'http'
	 *
	 * middlewares = [proxy.select { url: '/st' }, proxy.static('static')]
	 *
	 * http.createServer(proxy.flow middlewares).listen 8123
	 * ```
	###
	static: (opts) ->
		send = kit.requireOptional 'send', __dirname, '^0.13.0'

		if _.isString opts
			opts = { root: opts }

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
	###
	url: (opts) ->
		kit.require 'url'
		br = kit.require 'brush'

		if _.isString opts
			opts = { url: opts }

		opts ?= {}

		_.defaults opts, {
			globalBps: false
			agent: proxy.agent
			isForceHeaderHost: true
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
