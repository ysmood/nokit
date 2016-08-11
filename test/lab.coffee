
kit = require("../lib/kit");
https = require('https');
proxy = kit.require("proxy");
net = require('net');
stream = require('stream')
crypto = require 'crypto'
flow = proxy.flow;
async = kit.async;
_ = kit._

algorithm = 'rc4'

server = net.createServer (c) ->
    cipher = crypto.createCipher(algorithm, '123456')
    decipher = crypto.createDecipher(algorithm, '123456')

    c.pipe(decipher).on 'data', (c) ->
        kit.logs c + ''

    cipher.pipe(c)

server.listen 8080, ->
    client = net.connect 8080, ->
        cipher = crypto.createCipher(algorithm, '123456')
        decipher = crypto.createDecipher(algorithm, '123456')

        cipher.pipe client

        # cipher.pipe client
        cipher.write 'new Buffer(64)asdfkjasldfasldfjsalfjasldfasldfjsalkfjsldfjsldfalsdkfalsdfjsakldf'
