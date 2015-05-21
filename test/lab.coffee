kit = require '../lib/kit'
{ _ } = kit

sse = kit.require 'sse'

sseHandler = sse()

http = require 'http'

s = http.createServer (req, res) ->
	if req.url == '/sse'
		sseHandler req, res
	else
		res.end """
			<script>
				var es = new EventSource('/sse')
				es.addEventListener('eventName', function (e) {
					console.log(e)
				})

			</script>
		"""

s.listen 8123, ->
	kit.log 'listen ' + 8123

	setInterval ->
		sseHandler.emit('eventName', 'ok')
	, 1000
