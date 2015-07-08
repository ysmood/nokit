kit = require '../lib/kit'
proxy = kit.require 'proxy'
http = require 'http'

routes = [{
	url: '/'
	handler: proxy.url {
		url: 'baidu.com'
		handleResBody: (body, req, res) ->
			if res.headers['content-type'].indexOf('text/html') > -1
				body + '<script>alert("test")</script>'
			else
				body
	}
}]

http.createServer proxy.flow(routes)
.listen 8123
