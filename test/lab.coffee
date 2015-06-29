kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
# require '../lib/proxy'
http = require 'http'

routes = [
	(self) ->
		# Record the time of the whole request
		start = new Date
		self.next -> kit.sleep(300).then ->
			self.res.setHeader 'x-response-time', new Date - start
	(self) ->
		kit.log 'access: ' + self.req.url
		# We need the other handlers to handle the response.
		kit.sleep(300).then => self.next
	{
		url: /\/items\/(\d+)/
		handler: (self) -> kit.sleep(300).then ->
			self.body = kit.readJSON 'package.json'
	}
]

http.createServer proxy.mid(routes)

.listen 8123, ->
	kit.log 'listen ' + 8123

	kit.spawn 'http', ['127.0.0.1:8123/items/10?a=10&b=我们']
