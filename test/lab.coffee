kit = require '../lib/kit'
{ _ } = kit
proxy = kit.require 'proxy'
http = require 'http'

routes = [
	({ req }) -> kit.log 'access: ' + req.url
	{
		url: '/test'
		handler: ({ url, res }) ->
			kit.log url
			res.end 'ok'
	}
	({ res }) -> res.end '404'
]

http.createServer proxy.mid(routes)

.listen 8123, ->
	kit.log 'listen ' + 8123

	kit.request {
		url: '127.0.0.1:8123/test?a=10'
	}
	.then kit.log
