#!/usr/bin/env node

var kit = require('../dist/kit');
var br = kit.require('brush');
var Promise = kit.Promise;
var cmder = require('commander');
var net = require('net');
var msgpack = kit.requireOptional('msgpack5', __dirname, '^3.4.0')();

cmder
    .description('a remote node repl tool')
    .usage('[options]')
    .option('--host <host>', 'the host [0.0.0.0]', '0.0.0.0')
    .option('-p, --port <port>', 'the port [8080]', 8080)
    .option('-s, --server', 'start as tunnel server')
.parse(process.argv);


function runServer () {
    var repl = require('repl')
    var net = require('net')

    net.createServer(function (socket) {
        var r = repl.start({
            prompt: br.green('> '),
            input: socket,
            output: socket,
            terminal: true,
            useGlobal: false
        })

        r.on('exit', function () {
            socket.end()
        })

        r.context.socket = socket
    }).listen(cmder.port, cmder.host)
}

function runClient () {
    var net = require('net')

    var sock = net.connect(cmder.port, cmder.host)

    process.stdin.pipe(sock)
    sock.pipe(process.stdout)

    sock.on('connect', function () {
        process.stdin.resume();
        process.stdin.setRawMode(true)
    })

    sock.on('close', function done () {
        if (process.stdin.readable) {
            process.stdin.setRawMode(false)
            process.stdin.pause()
        }
        sock.removeListener('close', done)
    })

    process.stdin.on('end', function () {
        sock.destroy()
        console.log()
    })

    process.stdin.on('data', function (b) {
        if (b.length === 1 && b[0] === 4) {
            process.stdin.emit('end')
        }
    })
}

if (cmder.server) {
    runServer();
} else {
    runClient();
}
