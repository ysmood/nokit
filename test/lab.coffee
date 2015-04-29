kit = require '../lib/kit'
{ _ } = kit

http = require 'http'
proxy = kit.require 'proxy'

s = http.createServer (req, res) ->
	kit.log req.url
	proxy.url req, res

s.on 'connect', proxy.connect

s.listen 8123, ->
	kit.log 'listen ' + 8123
