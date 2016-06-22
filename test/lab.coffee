
kit = require("../lib/kit");
proxy = kit.require("proxy");
flow = proxy.flow;
app = flow();
async = kit.async;

mobilePath = '/Users/ys/cradle/nokit/test/test.js';

app.push(proxy.debugJs({
    url: /\/mobile.js?/,
    file: mobilePath
}))

app.server.on("connect", proxy.connect());

app.listen(8081);