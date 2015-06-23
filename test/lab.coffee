kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
# require '../lib/proxy'
http = require 'http'

routes = [
	->
		kit.log 'access: ' + this.req.url

		start = new Date
		this.remains.push =>
			this.res.setHeader 'x-response-time', new Date - start

	{
		url: /\/items\/(\d+)/
		method: 'GET'
		handler: ->
			console.log 'method'
			this.body = this.method
	}

	->
		this.body = '404'
]

http.createServer proxy.mid(routes)

.listen 8123, ->
	kit.log 'listen ' + 8123

	kit.spawn 'http', ['127.0.0.1:8123/items/10?a=10']
