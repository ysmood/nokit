kit = require '../lib/kit'
{ _ } = kit
proxy = kit.require 'proxy'
http = require 'http'

routes = [
	({ req }) -> kit.log 'access: ' + req.url
	{
		url: /\/items\/(\d+)/
		method: 'GET'
		handler: ({ url, res, method }) ->
			kit.log url[1]
			res.end method
	}
	({ res }) -> res.end '404'
]

http.createServer proxy.mid(routes)

.listen 8123, ->
	kit.log 'listen ' + 8123

	kit.request {
		url: '127.0.0.1:8123/items/10?a=10'
	}
	.then kit.log
