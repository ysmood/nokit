const kit = require('../lib/kit');
const { flow, select, match, statics } = kit.require('proxy');

const serverHelper = kit.serverHelper();

const root = 'test/fixtures/site';

const app = flow();

app.push(
    serverHelper,

    select(match('/', function(ctx) {
        const path = root + '/index.html';

        // Watch the `index.html`
        serverHelper.watch(path);

        return ctx.body = kit.readFile(path)
            .then(buf =>
                // Inject live reload browser helper to the page.
                buf + kit.browserHelper()
        );
    })
    ),

    select('/st', statics({
        root,
        onFile(path, stats, ctx) {
            // Watch any static file.
            return serverHelper.watch(path, ctx.req.originalUrl);
        }
    }))
);

app.listen(8123);
