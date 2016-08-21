#!/usr/bin/env node

var kit = require('../dist/kit');
kit.requireOptional.autoInstall = true;

var br = kit.require('brush');
var _ = kit._;
var Promise = kit.Promise;
var cmder = kit.requireOptional('commander', __dirname, '^2.9.0');
var net = require('net');
var events = require('events');
var tcpFrame = require('../dist/tcpFrame');
var msgpack = kit.requireOptional('msgpack5', __dirname, '^3.4.0')();
var encode = msgpack.encode;
var decode = msgpack.decode;

cmder
    .description('a cross platform remote tty tool')
    .usage('[options] [args_to_bin...]')
    .option('-o, --host <host>', 'the host [127.0.0.1]', '127.0.0.1')
    .option('-p, --port <port>', 'the port [8080]', 8080)
    .option('-s, --server', 'start as tunnel server')
    .option('-b, --bin <cmd>', 'the init cmd to run')
    .option('-y, --noPty', 'run server without pty mode')
    .option('-t, --tunnel', 'run as not tunnel mode')
    .option('-n, --name <str>', 'name for the not tunnel mode')
    .option('-k, --key <str>', 'key for the not tunnel mode')
.parse(process.argv);

function spawnTerm (cmd) {
    var term;

    if (cmder.noPty) {
        var ps = kit.spawn(cmd.bin, cmd.args, {
            stdio: 'pipe'
        }).process;
        var treeKill = kit.require('treeKill');
        term = new events();

        ps.stdout.on('data', function (data) {
            term.emit('data', data);
        });
        ps.stderr.on('data', function (data) {
            term.emit('data', data);
        });
        ps.on('exit', function () {
            term.emit('exit');
        });
        ps.on('close', function () {
            term.emit('close');
        });
        ps.on('error', function () {
            term.emit('error');
        });

        term.write = function (data) {
            ps.stdin.write(data);
        };

        term.kill = function () {
            treeKill(ps.pid);
        };

        term.resize = _.noop;
    } else {
        var pty = kit.requireOptional('ptyw.js', __dirname, '^0.4.0');

        term = pty.spawn(cmd.bin, cmd.args, cmd.options);
    }

    return term;
}

function runServer () {
    var server = net.createServer(function (sock) {
        tcpFrame(sock);

        var term;

        sock.writeFrame(encode({
            type: 'init',
            noPty: cmder.noPty,
            platform: process.platform,
            node: process.version,
            env: process.env
        }));

        sock.on('frame', function (cmd) {
            cmd = decode(cmd);

            switch (cmd.type) {
            case 'init':
                kit.logs('client init');

                term = spawnTerm(cmd);

                term.on('data', function (data) {
                    sock.writeFrame(encode({
                        type: 'data',
                        data: data
                    }));
                });

                term.on('exit', function () {
                    kit.logs('task exit');
                    sock.end();
                });

                sock.on('close', function () {
                    term.kill();
                    kit.logs('client closed');
                });

                sock.on('error', function () {
                    term.kill();
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
        kit.logs('listening on:', cmder.host + ':' + server.address().port);
    });
}

function runClient () {
    var sock = net.connect(cmder.port, cmder.host, function () {
        kit.logs('remote connected');

        tcpFrame(sock);

        sock.on('frame', function (cmd) {
            cmd = decode(cmd);

            switch (cmd.type) {
            case 'init':
                kit.logs('remote init');

                if (cmd.noPty) {
                    kit.logs('no pty');
                    var bin = cmd.platform === 'win32' ? 'tasklist' : 'ps';
                } else {
                    process.stdin.setRawMode(true);

                    var bin = cmd.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
                }

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
        });

    });

    sock.on('error', function (err) {
        if (err.code === 'ECONNREFUSED')
            setTimeout(runClient, 300);
        else
            throw err;
    });
}

kit.logs('pid:', process.pid);

if (cmder.server) {
    if (cmder.tunnel) {
        var tunnel = kit.spawn('node', [
            kit.path.join(__dirname, 'not'),
            '--name', cmder.name,
            '--key', cmder.key,
            '--xport', cmder.port,
            '--host', cmder.host
        ]).process;

        process.on('exit', function () {
            kit.treeKill(tunnel.pid);
        });

        tunnel.on('exit', function (code) {
            process.exit(code);
        });

        cmder.host = '127.0.0.1'
    }

    runServer();
} else {
    if (cmder.tunnel) {
        var tunnel = kit.spawn('node', [
            kit.path.join(__dirname, 'not'),
            '--targetName', cmder.name,
            '--key', cmder.key,
            '--port', cmder.port,
            '--host', cmder.host
        ]).process;

        process.on('exit', function () {
            tunnel.kill();
        });

        tunnel.on('exit', function (code) {
            process.exit(code);
        });

        cmder.host = '127.0.0.1';
    }

    runClient();

}
