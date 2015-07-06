kit = require '../lib/kit'
proxy = kit.require 'proxy'
http = require 'http'

process.env.NODE_ENV = 'development'

serverHelper = kit.serverHelper()

root = 'test/fixtures/site'

routes = [
    serverHelper

    {
        url: proxy.match '/'
        handler: (ctx) ->
            path = root + '/index.html'
            serverHelper.watch path
            ctx.body = kit.readFile path
                .then (buf) -> buf + kit.browserHelper()
    }

    {
        url: '/st'
        handler: proxy.static {
            root
            onFile: (path, stats, ctx) ->
                serverHelper.watch path, ctx.req.originalUrl
        }
    }
]

http.createServer proxy.mid(routes)

.listen 8123
