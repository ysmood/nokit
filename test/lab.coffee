kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
# require '../lib/proxy'

sHelper = proxy.serverHelper()

routes = [{
	url: '/'
	handler: (ctx) ->
		ctx.body = kit.readFile '.gitignore'
}]

http.createServer proxy.mid(routes)

.listen 8123, ->
	kit.log 'listen ' + 8123

	kit.spawn 'http', ['-v', '127.0.0.1:8123/']
