
kit = require("../lib/kit");
https = require('https');
proxy = kit.require("proxy");
flow = proxy.flow;
async = kit.async;

opts = {
    key: kit.readFileSync('ca/server/key.pem', 'utf8')
    cert: kit.readFileSync('ca/server/cert.pem', 'utf8')
}

routes = [
    ($) ->
        return $.body = 'ok';

        kit.logs("https://#{$.req.headers.host}#{$.req.url}")
        kit.request({
            url: "https://#{$.req.headers.host}#{$.req.url}"
            headers: $.req.headers
            reqData: $.req
            resPipe: $.res
        })
        kit.never()
    proxy.url({
        protocol: 'https:'
    })
]

https.createServer(opts, flow(routes)).listen(8123);


app = flow();

app.push(proxy.url())

app.server.on('connect', kit.proxy.connect({
    host: '127.0.0.1',
    port: 8123
}));

app.listen(8081);
