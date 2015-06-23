kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
# require '../lib/proxy'
http = require 'http'

routes = [
	->
		# Record the time of the whole request
		start = new Date
		this.next => kit.sleep(300).then =>
			this.res.setHeader 'x-response-time', new Date - start
	->
		kit.log 'access: ' + this.req.url
		# We need the other handlers to handle the response.
		kit.sleep(300).then => this.next
	{
		url: /\/items\/(\d+)/
		handler: -> kit.sleep(300).then =>
			this.body = { id: this.url[1] }
	}
]

http.createServer proxy.mid(routes)

.listen 8123, ->
	kit.log 'listen ' + 8123

	kit.spawn 'http', ['127.0.0.1:8123/items/10?a=10&b=我们']
