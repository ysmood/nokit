kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
# require '../lib/proxy'

run = ->
	sHelper = proxy.serverHelper()

	routes = [(ctx) ->
		kit.log ctx.req.url
		ctx.next()
	, {
		url: '/test'
		handler: proxy.body()
	}, {
		url: '/test'
		handler: (ctx) ->
			kit.log ctx.reqBody + ''
			ctx.body = 'site' + ctx.req.headers.proxy
	}]

	http.createServer proxy.flow(routes)

	.listen 8123, ->
		kit.log 'listen ' + 8123

		kit.spawn 'http', ['http://127.0.0.1:8123/test', 'a=10']

run()
