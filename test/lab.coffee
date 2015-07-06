kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
# require '../lib/proxy'

sHelper = kit.serverHelper()

routes = [sHelper, {
	url: proxy.match '/'
	handler: (ctx) ->
		sHelper.watch 'test/index.html'
		ctx.body = kit.readFile 'test/index.html'
			.then (buf) ->
				buf + kit.browserHelper()
}, {
	url: '/st'
	handler: proxy.static {
		root: 'test'
		onFile: (path, stats, ctx) ->
			sHelper.watch path, ctx.req.url
	}
}]

http.createServer proxy.mid(routes)

.listen 8123, ->
	kit.log 'listen ' + 8123

	# kit.spawn 'http', ['-v', '127.0.0.1:8123/st/lab.coffee']
