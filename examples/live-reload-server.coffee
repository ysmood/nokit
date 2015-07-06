kit = require '../lib/kit'
proxy = kit.require 'proxy'
http = require 'http'

serverHelper = kit.serverHelper()

root = 'test/fixtures/site'

routes = [
    serverHelper

    {
        url: proxy.match '/'
        handler: (ctx) ->
            path = root + '/index.html'

            # Watch the `index.html`
            serverHelper.watch path

            ctx.body = kit.readFile path
                .then (buf) ->
                    # Inject live reload browser helper to the page.
                    buf + kit.browserHelper()
    }

    {
        url: '/st'
        handler: proxy.static {
            root
            onFile: (path, stats, ctx) ->
                # Watch any static file.
                serverHelper.watch path, ctx.req.originalUrl
        }
    }
]

http.createServer proxy.mid(routes)

.listen 8123
