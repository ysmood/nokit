kit = require '../lib/kit'
proxy = kit.require 'proxy'
http = require 'http'

routes = [{
	url: '/'
	handler: proxy.url {
		url: 'baidu.com'
		handleResPipe: (res, stream) ->
			if res.headers['content-type'].indexOf('text/html') == 0
				# In this case the `handleResBody` will be called.
				null
			else
				stream
		handleResBody: (body) ->
			# Only inject html.
			body + '<script>alert("OK")</script>'
	}
}]

http.createServer proxy.flow(routes)
.listen 8123
