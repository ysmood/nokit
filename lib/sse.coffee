###*
 * A Server-Sent Event Manager.
 * For more info see [Using server-sent events](https://developer.mozilla.org/en-US/docs/Server-sentEvents/UsingServer-sentEvents).
 * It is used to implement the live-reload of web assets.
 * @type {SSE}
 * @property {Array} sessions The sessions of connected clients.
 * @property {Integer} retry The reconnection time to use when attempting to send the event, unit is ms.
 * Default is 1000ms.
 * A session object is something like:
 * ```coffee
 * {
 * 	req  # The http req object.
 *  res  # The http res object.
 * }
 * ```
 * @example
 * Your server side code may look like this:
 * ```coffee
 * http = require 'http'
 * kit = require 'nokit'
 * sse = kit.require 'sse'
 * sseHandler = sse()
 * http.createServer (req, res) ->
 * 	if req.url == '/sse'
 *  	sseHandler req, res
 *  else
 *  	res.end()
 * .listen 8080, ->
 * 	setTimeout ->
 * 		sseHandler.emit 'test', { test: 'ok' }
 * ```
 *
 * You browser code should be something like this:
 * ```coffee
 * es = new EventSource('/sse')
 * es.addEventListener('test', (e) ->
 * 	msg = JSON.parse(e.data)
 *  console.log(msg) # => { test: 'ok' }
 * ```
###
sse = (opts = {}) ->

	###*
	 * The sse middleware for http handler.
	 * @param {http.IncomingMessage} req Also supports Express.js.
	 * @param {http.ServerResponse} res Also supports Express.js.
	###
	self = (req, res) ->
		session = self.create req, res
		self.sessions.push session

	opts.retry ?= 1000

	self.sessions = []

	###*
	 * Broadcast a event to all clients.
	 * @param {String} event The event name.
	 * @param {Object | String} msg The data you want to emit to session.
	 * @param {String} [path] The namespace of target sessions. If not set,
	 * broadcast to all clients.
	###
	self.emit = (event, msg, path = '') ->
		for el in self.sessions
			if not path
				el.emit event, msg
			else if el.req.path == path
				el.emit event, msg

	###*
	 * Create a sse session.
	 * @param {http.IncomingMessage} req Also supports Express.js.
	 * @param {http.ServerResponse} res Also supports Express.js.
	 * @return {SSESession}
	###
	self.create = (req, res) ->
		session = { req, res }

		req.socket.setTimeout 0
		res.writeHead 200, {
			'Content-Type': 'text/event-stream'
			'Cache-Control': 'no-cache'
			'Connection': 'keep-alive'
		}

		###*
		 * Emit message to client.
		 * @param  {String} event The event name.
		 * @param  {Object | String} msg The message to send to the client.
		###
		session.emit = (event, msg = '') ->
			msg = JSON.stringify msg
			res.write """
			id: #{Date.now()}
			event: #{event}
			retry: #{opts.retry}
			data: #{msg}\n\n
			"""

		req.on 'close', ->
			self.sessions.splice (self.sessions.indexOf session), 1

		session.emit 'connect', 'ok'
		session


	self

module.exports = sse
