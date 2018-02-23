#!/usr/bin/env node

var kit = require('../lib/kit');
kit.requireOptional.autoInstall = true;

var br = kit.require('brush');
var _ = kit._;
var Promise = kit.Promise;
var cmder = kit.requireOptional('commander', __dirname, '^2.9.0');
var net = require('net');
var events = require('events');
var tcpFrame = require('../lib/tcpFrame');
var not = require('../lib/not');
var msgpack = kit.requireOptional('msgpack5', __dirname, '^3.4.0')();
var encode = msgpack.encode;
var decode = msgpack.decode;

cmder
    .description('a cross platform remote tty tool')
    .usage('[options] [args_to_bin...]')
    .option('-o, --host <host>', 'the host [127.0.0.1]', '127.0.0.1')
    .option('-p, --port <port>', 'the port [8080]')
    .option('-s, --server', 'start as tunnel server')
    .option('-b, --bin <cmd>', 'the init cmd to run')
    .option('-y, --pty', 'run server in pty mode')
    .option('-t, --tunnel', 'run as not tunnel mode')
    .option('-n, --name <str>', 'name for the not tunnel mode')
    .option('-k, --key <str>', 'key for the not tunnel mode')
.parse(process.argv);

if (_.isFunction(cmder.name)) {
    cmder.name = undefined;
}

function spawnTerm (cmd) {
    var term;

    if (cmder.pty) {
        var pty = kit.requireOptional('ptyw.js', __dirname, '^0.4.0');

        term = pty.spawn(cmd.bin, cmd.args, cmd.options);
    } else {
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
    }

    return term;
}

function runServer () {
    var defer = kit.Deferred();

    var server = net.createServer(function (sock) {
        tcpFrame(sock);

        var term;

        sock.writeFrame(encode({
            type: 'init',
            pty: cmder.pty,
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

                sock.on('error', function (err) {
                    term.kill();
                    kit.logs('client socket error:', err)
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
        defer.resolve({
            server: server
        });

        kit.logs('listening on:', cmder.host + ':' + server.address().port);
    });

    return defer.promise;
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

                var defaultBin = cmd.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
                var defaultArgs = cmd.platform === 'win32' ? [] : ['-i'];

                if (cmd.pty) {
                    kit.logs('pty mode');

                    process.stdin.setRawMode(true);
                } else {
                    process.stdin.on('data', function () {
                        exitFlag = true;
                    });

                    var exitFlag = true;
                    process.on('SIGINT', function () {
                        if (exitFlag) {
                            console.log(br.yellow('\nTo exit, press ^C again'));
                            exitFlag = false;
                        } else {
                            sock.end();
                        }
                    });
                }

                sock.writeFrame(encode({
                    type: 'init',
                    bin: cmder.bin || defaultBin,
                    args: cmder.args.length === 0 ? defaultArgs : cmder.args,
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


var notHost = cmder.host;
var notHostPort = cmder.port;

_.defaults(cmder, {
    port: 8080
})

if (cmder.server) {
    if (cmder.tunnel) {
        cmder.host = '127.0.0.1';
        cmder.port = 0;
        runServer().then(function (ctx) {
            return not({
                name: cmder.name,
                key: cmder.key,
                xport: ctx.server.address().port,
                host: notHost,
                hostPort: notHostPort
            })
        }).catch(kit.throw);
    } else {
        runServer();
    }

} else {
    if (cmder.tunnel) {
        if (!cmder.name)
            throw new Error('name is required');

        not({
            targetName: cmder.name,
            key: cmder.key,
            port: 0,
            host: notHost,
            hostPort: notHostPort
        }).then(function (ctx) {
            cmder.host = '127.0.0.1';
            cmder.port = ctx.server.address().port;

            runClient();
        }, kit.throw);
    } else {
        runClient();
    }
}
