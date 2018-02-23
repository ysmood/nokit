
const kit = require("../lib/kit");
const https = require('https');
const proxy = kit.require("proxy");
const net = require('net');
const stream = require('stream');
const crypto = require('crypto');
const zlib = require('zlib');
const { execSync } = require('child_process');
const { flow } = proxy;
const { async } = kit;
const { _ } = kit;

const app = flow();

app.push(proxy.url({
    handleResBody(body) {
        return body;
    }
})
);


// app.push (ctx) ->
//     {req, res} = ctx

//     p = kit.request {
//         method: req.method
//         url: req.url
//         headers: req.headers
//         # resPipe: res
//         # autoUnzip: true
//         body: false
//     }
//     .then (s) ->
//         kit.logs 'out:', s.body, s.headers, s.statusCode

    // p = p.then (proxyRes) ->
    //     kit.logs proxyRes
    //     res.statusCode = proxyRes.statusCode

    //     encoding = proxyRes.headers['content-encoding']

    //     for k, v of proxyRes.headers
    //         res.setHeader k, v

    //     if proxyRes.body
    //         if true && regGzipDeflat.test(encoding)
    //             res.removeHeader('content-encoding')
    //             res.removeHeader('Content-Encoding')
    //             res.removeHeader('content-length')
    //             res.removeHeader('Content-Length')
    //             res.setHeader('transfer-encoding', 'chunked')

    //         ctx.body = proxyRes.body
    //     else
    //         ctx.body = ''

    //     return

    // p

app.server.on('connect', proxy.connect());

app.listen(8345, function() {});
    // kit.spawn 'curl', [
    //     'http://static.hdslb.com/tag/css/tag-index2.0.css'
    //     '-H'
    //     'Accept-Encoding: gzip, deflate, sdch'
    //     '-H'
    //     'Accept-Language: en-US,en;q=0.8,zh-CN;q=0.6,zh;q=0.4,ja;q=0.2,zh-TW;q=0.2,ko;q=0.2'
    //     '-H'
    //     'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.98 Safari/537.36'
    //     '-H'
    //     'Accept: text/css,*/*;q=0.1'
    //     '-H'
    //     'Cache-Control: max-age=0'
    //     '-H'
    //     'Referer: http://www.bilibili.com/video/av6450428/'
    //     '-H'
    //     'Proxy-Connection: keep-alive'
    //     '--compressed'
    //     '-x'
    //     'localhost:8345'
    //     '-v'
    // ]

// f = kit.createWriteStream('f')

// kit.request({
//     url: 'http://static.hdslb.com/images/jquery-ui/custom/jquery-ui.css',
//     headers: {
//         host: 'static.hdslb.com',
//         'accept-encoding': 'gzip, deflate, sdch',
//         'accept-language': 'en-US,en;q=0.8,zh-CN;q=0.6,zh;q=0.4,ja;q=0.2,zh-TW;q=0.2,ko;q=0.2',
//         'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.98 Safari/537.36',
//         accept: 'text/css,*/*;q=0.1',
//         'cache-control': 'max-age=0',
//         referer: 'http://www.bilibili.com/video/av6450428/',
//     }
//     autoUnzip: true
// }).then (res) ->
