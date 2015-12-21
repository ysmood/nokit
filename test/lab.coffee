kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
{ Promise } = kit

app = proxy.flow()


# app.push ($) ->
#     kit.logs $.req.url
#     return kit.never()

# app.listen 8123, ->
#     kit.request {
#         url: '127.0.0.1:8123'
#         reqPipe: kit.createReadStream(__filename)
#     }

http.createServer (req, res) ->
    req.on 'data', (c) ->
        kit.logs c.length
.listen 8123, ->
    req = http.request {
        host: '127.0.0.1'
        port: 8123
    }

    kit.createReadStream(__filename).pipe req
