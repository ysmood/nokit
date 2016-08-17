#!/usr/bin/env node

var kit = require('../dist/kit');
var br = kit.require('brush');
var Promise = kit.Promise;
var cmder = require('commander');
var net = require('net');
var tcpFrame = require('../dist/tcpFrame');
var msgpack = kit.requireOptional('msgpack5', __dirname, '^3.4.0')();
var encode = msgpack.encode;
var decode = msgpack.decode;

cmder
    .description('a cross platform remote tty tool')
    .usage('[options] [args_to_bin...]')
    .option('--host <host>', 'the host [0.0.0.0]', '0.0.0.0')
    .option('-p, --port <port>', 'the port [8080]', 8080)
    .option('-s, --server', 'start as tunnel server')
    .option('-b, --bin <cmd>', 'the init cmd to run')
.parse(process.argv);


function runServer () {
    var pty = kit.requireOptional('pty.js', __dirname, '^0.3.1');

    var server = net.createServer(function (sock) {
        tcpFrame(sock);

        var term;

        sock.writeFrame(encode({
            type: 'init',
            platform: process.platform,
            node: process.version,
            env: process.env
        }));

        sock.on('frame', function (cmd) {
            cmd = decode(cmd);

            switch (cmd.type) {
            case 'init':
                term = pty.spawn(cmd.bin, cmd.args, cmd.options);

                term.on('data', function (data) {
                    sock.writeFrame(encode({
                        type: 'data',
                        data: data
                    }));
                });

                term.on('exit', function () {
                    kit.logs('task exit')
                    sock.end();
                });

                sock.on('close', function () {
                    term.kill('SIGKILL');
                    kit.logs('client closed');
                });

                sock.on('error', function () {
                    term.kill('SIGKILL');
                    kit.logs('client closed')
                });
                break;

            case 'resize':
                term.resize(cmd.cols, cmd.rows);
                break;

            case 'data':
                if (term) term.write(cmd.data);
                break;

            default:
                kit.errs('unknown client cmd type');
                break;
            }
        });
    })

    server.listen(cmder.port, cmder.host, function () {
        kit.logs('listen port:', server.address().port);
    });
}

function runClient () {
    var sock = net.connect(cmder.port, cmder.host, function () {
        kit.logs('remote connected');

        tcpFrame(sock);

        process.stdin.setRawMode(true);

        sock.on('frame', function (cmd) {
            cmd = decode(cmd);

            switch (cmd.type) {
            case 'init':
                var bin = cmd.platform === 'win32' ? 'cmd.exe' : '/bin/sh';

                sock.writeFrame(encode({
                    type: 'init',
                    bin: cmder.bin || bin,
                    args: cmder.args,
                    options: {
                        name: process.env.TERM,
                        rows: process.stdout.rows,
                        cols: process.stdout.columns
                    }
                }));

                process.stdout.on('resize', function () {
                    sock.writeFrame(encode({
                        type: 'resize',
                        rows: process.stdout.rows,
                        cols: process.stdout.columns
                    }));
                });

                process.stdin.on('data', function (data) {
                    sock.writeFrame(encode({
                        type: 'data',
                        data: data
                    }));
                });
                break;

            case 'data':
                process.stdout.write(cmd.data);
                break;

            default:
                kit.errs('unknown server cmd type');
                break;
            }
        });

        sock.on('close', function () {
            kit.logs('remote closed');
            process.exit();
        })
    });
}

kit.logs('pid:', process.pid);

if (cmder.server) {
    runServer();
} else {
    runClient();
}
