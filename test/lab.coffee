kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
# require '../lib/proxy'

bodyParser = require('body-parser')


sh = kit.serverHelper()

setInterval ->
	sh.sse.emit 'fileModified', '/st/a.css'
, 5000

routes = [
	bodyParser.json()

	sh

	(ctx) ->
		kit.log 'access: ' + ctx.req.url
		ctx.next

	proxy.static '/st', 'test/fixtures'

	# {
	# 	error: (ctx, err) ->
	# 		kit.log 'error'
	# 		ctx.body = 'asdf'
	# }

	{
		url: '/sub'
		handler: proxy.mid([{
			url: '/home'
			handler: (ctx) ->
				kit.log ctx.req.body
				ctx.body = 'hello world'
		}])
	}

	{
		url: '/'
		handler: (ctx) ->
			ctx.body = """
			<html>
				<head>
					<link rel="stylesheet" href="/st/a.css">
				</head>
				<body>
					<div style='height: 3000px'>
					</div>
					alsdkfj
				</body>
			</html>
			""" + kit.browserHelper()
	}
]

http.createServer proxy.mid(routes)

.listen 8123, ->
	kit.log 'listen ' + 8123

	# kit.spawn 'http', ['POST', '127.0.0.1:8123/sub/home', 'a=[10]']
