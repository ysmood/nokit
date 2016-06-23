
kit = require("../lib/kit");
proxy = kit.require("proxy");
flow = proxy.flow;
app = flow();
async = kit.async;

path = '/Users/ys/cradle/nokit/test/test.js';

app.push ($) ->
    kit.logs($.req.url)
    $.next()

app.push(proxy.debugJs({
    url: /\/index.min.3qtAdh.js/,
    file: path
}))

app.server.on("connect", proxy.connect());

app.listen(8081);