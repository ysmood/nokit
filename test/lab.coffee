kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
# require '../lib/proxy'

run = ->
	routes = [{
		url: '/site'
		handler: (ctx) ->
			ctx.body = 'site'
	}, {
		url: /\/proxy$/
		handler: proxy.url {
			url: '/site'
			bps: 1024 * 10
			handleReqHeaders: (headers) ->
				headers['proxy'] = 'proxy'
				headers
			handleResHeaders: (headers) ->
				headers['x'] = 'ok'
				headers

			handleResPipe: (res, resPipe) ->
				kit.logs 'content-length', res.headers['content-length']
				if res.headers['content-length'] == '10'
					resPipe
			handleResBody: (body) ->
				body + '-body'
		}
	}]

	http.createServer proxy.flow(routes)

	.listen 8123, ->
		# kit.log 'listen ' + 8123

		kit.spawn 'http', ['http://127.0.0.1:8123/proxy', 'a=10']

run()
