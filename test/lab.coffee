kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
{ Promise } = kit

proxy = kit.require 'proxy'

app = proxy.flow()

new Promise (resolve) ->
	app.server.on 'connect', proxy.connectServant({
		onConnect: (req, w) ->
			setInterval ->
				w(new Buffer(10001))
			, 1000
	})

	app.listen(0).then ->
		proxy.connectClient {
			port: app.server.address().port
			host: '127.0.0.1'
			data: (c) -> console.log(c.length)
		}
