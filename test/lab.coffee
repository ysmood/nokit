
kit = require("../lib/kit");
https = require('https');
proxy = kit.require("proxy");
net = require('net');
stream = require('stream')
flow = proxy.flow;
async = kit.async;
_ = kit._


trans = new stream.Duplex({
    read: (size) ->
        this.push('hey')

    write: (chunk, encoding, cb) ->
        console.log 'write', chunk.length
        cb(null, chunk)
})

server = net.createServer (sock) ->
    sock.write 'ok'

server.listen 0, ->
    sock = net.connect server.address().port, '127.0.0.1', ->
        trans.pipe sock
        sock.pipe trans

        trans.on 'data', (data) ->
            kit.logs 'data', data.length
