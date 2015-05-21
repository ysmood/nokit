kit = require '../lib/kit'
{ _ } = kit

handler = kit.serverHelper()

http = require 'http'

http.createServer (req, res) ->
	handler req, res, ->
		res.end kit.browserHelper()

.listen 8123, ->
	kit.log 'listen ' + 8123

	setInterval ->
		handler.sse.emit('fileModified', 'ok')
	, 3000
