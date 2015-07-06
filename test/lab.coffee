kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
# require '../lib/proxy'

run = ->
	sHelper = proxy.serverHelper()

	routes = [(ctx) ->
		kit.log 'access'
		ctx.next ->
			kit.log 'done'
	, {
		url: '/'
		handler: (ctx) ->
			kit.log 'read'
			throw 123
			ctx.body = kit.readFile '.gitignore'
	}]

	http.createServer proxy.mid(routes)

	.listen 8123, ->
		kit.log 'listen ' + 8123

		kit.spawn 'http', ['127.0.0.1:8123/']

run()
