kit = require '../lib/kit'
{ _ } = kit

handler = kit.serverHelper()

http = require 'http'

http.createServer (req, res) ->
	handler req, res, ->
		res.end """
        <html>
            <link rel="stylesheet" href="a.css"></link>
            <body>
            </body>
        </html>
        """ + kit.browserHelper()

.listen 8123, ->
	kit.log 'listen ' + 8123

	setTimeout ->
		handler.sse.emit('fileModified', 'a.css')
	, 3000
