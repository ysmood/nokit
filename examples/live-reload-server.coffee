kit = require '../lib/kit'
{ flow, select, match, statics } = kit.require 'proxy'

serverHelper = kit.serverHelper()

root = 'test/fixtures/site'

app = proxy.flow()

app.push(
    serverHelper

    select match '/', (ctx) ->
        path = root + '/index.html'

        # Watch the `index.html`
        serverHelper.watch path

        ctx.body = kit.readFile path
            .then (buf) ->
                # Inject live reload browser helper to the page.
                buf + kit.browserHelper()

    select '/st', statics {
        root
        onFile: (path, stats, ctx) ->
            # Watch any static file.
            serverHelper.watch path, ctx.req.originalUrl
    }
)

app.listen 8123
