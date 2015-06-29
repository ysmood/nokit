kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
# require '../lib/proxy'
http = require 'http'
send = require 'send'

routes = [
	{
		url: '/st'
		handler: (ctx) ->
			console.log ctx.url
			ctx.body = send(ctx.req, ctx.url, { root: 'test' })
	}

	(ctx) ->
		# Record the time of the whole request
		start = new Date
		ctx.next -> kit.sleep(300).then ->
			ctx.res.setHeader 'x-response-time', new Date - start
	(ctx) ->
		kit.log 'access: ' + ctx.req.url
		# We need the other handlers to handle the response.
		kit.sleep(300).then ctx.next
	{
		url: /\/items\/(\d+)/
		handler: (ctx) ->
			ctx.body = kit.sleep(300).then -> { id: ctx.url[1] }
	}
]

http.createServer proxy.mid(routes)

.listen 8123, ->
	kit.log 'listen ' + 8123

	kit.spawn 'http', ['127.0.0.1:8123/st/lab.coffee']
