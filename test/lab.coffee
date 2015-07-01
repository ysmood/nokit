kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'

routes = [
	(ctx) ->
		kit.log 'access: ' + ctx.req.url
		ctx.next

	proxy.static '/st', 'test/fixtures'

	{
		error: (ctx, err) ->
			kit.log 'error'
			ctx.body = 'asdf'
	}

	{
		url: '/items'
		handler: kit.readFile('.gitignore')
	}
]

http.createServer proxy.mid(routes)

.listen 8123, ->
	kit.log 'listen ' + 8123

	kit.spawn 'http', ['127.0.0.1:8123/items']
