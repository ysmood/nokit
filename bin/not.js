#!/usr/bin/env node

var kit = require('../dist/kit');
var br = kit.require('brush');
var Promise = kit.Promise;
var cmder = require('commander');
var tcpFrame = require('../dist/tcpFrame');
var net = require('net');
var crypto = require('crypto');

var msgpack = kit.requireOptional('msgpack5', __dirname, '^3.4.0')();

cmder
    .description('a tcp tunnel tool')
    .usage('[options]')
    .option('-x, --xport <port>', 'the port to expose [8080]', 8080)
    .option('-t, --token <token>', 'the token of current client')
    .option('-o, --targetToken <token>', 'the token of target client')
    .option('-p, --port <port>', 'the port to listen to and the port to forward to [7000]', 7000)
    .option('-s, --server', 'start as tunnel server')
    .option('--host <host>', 'the host of the tunnel server [0.0.0.0]', '0.0.0.0')
    .option('--hostPort <port>', 'the port of the tunnel server [8091]', 8091)
    .option('--key <str>', 'the key to secure the transport layer [3.141592]', '3.141592')
    .option('--algorithm <name>', 'the algorithm to secure the transport layer [rc4]', 'rc4')
.parse(process.argv);

// TODO: fix
// Because of the crypto padding issue, only rc4 is supported
cmder.algorithm = 'rc4';

function encode (obj) {
    return msgpack.encode(obj);
}

function decode (obj) {
    return msgpack.decode(obj);
}

function getId (size) {
    return crypto.randomBytes(size || 4).toString('hex');
}

function runServer () {
    var clientList = {};

    function addClient (sock) {
        tcpFrame(sock, {
            cipher: crypto.createCipher(cmder.algorithm, new Buffer(cmder.key)),
            decipher: crypto.createDecipher(cmder.algorithm, new Buffer(cmder.key))
        });

        var token;

        sock.on('frame', function (cmd) {
            cmd = decode(cmd);

            switch (cmd.type) {

            case 'token':
                if (clientList[cmd.token]) {
                    sock.writeFrame(encode({
                        action: 'tokenExists'
                    }));
                    sock.end();
                    break;
                }

                token = cmd.token;

                kit.logs('client connected:', token);
                clientList[token] = sock;

                sock.writeFrame(encode({
                    action: 'tokenGot'
                }));
                break;

            // {
            //  type: "to",
            //  token: "...",
            //  action: "data" | "end",
            //  conId: String,
            //  data: Buffer
            // }
            case 'to':
                targetClient = clientList[cmd.token];

                // not equal to itself
                if (targetClient && targetClient !== sock) {
                    targetClient.writeFrame(encode({
                        tokenFrom: token,
                        action: cmd.action,
                        conId: cmd.conId,
                        data: cmd.data
                    }));
                } else {
                    kit.logs('no such client with the token');
                }
                break;

            default:
                kit.logs('unknown cmd type', cmd);
            }
        });

        sock.on('error', function () {
            if (token === undefined) return;

            kit.logs('client error:', token);

            rmClient(token);
        });

        sock.on('close', function () {
            if (token === undefined) return;

            kit.logs('client disconnected:', token);

            rmClient(token);
        });
    }

    function rmClient (token) {
        delete clientList[token];
    }

    var server = net.createServer(addClient);

    server.listen(cmder.hostPort, cmder.host, function () {
        kit.logs('listen at', cmder.host + ':' + cmder.hostPort);
    });
}

function runClient () {
    var conList = {};

    // keep track of the relation of conId and remote client id.
    var remoteList = {};

    function endCon (id) {
        if (id in conList) {
            var con = conList[id];
            delete conList[id];
            con.end();
        }
    }

    function restart () {
        kit.logs('restart client...');
        setTimeout(function () {
            if (server) {
                server.close(function () {
                    runClient();
                })
            } else {
                runClient();
            }
        }, 3000);
    }

    var client = net.connect(cmder.hostPort, cmder.host, function () {

        function addCon (cmd) {
            var data = cmd.data;
            var tokenFrom = cmd.tokenFrom;
            var conId = cmd.conId;

            var toCon = net.connect(cmder.xport, function () {
                toCon.write(data);
            });

            toCon.on('data', function (data) {
                client.writeFrame(encode({
                    type: 'to',
                    token: tokenFrom,
                    action: 'data',
                    conId: conId,
                    data: data
                }));
            });

            toCon.on('end', function () {
                client.writeFrame(encode({
                    type: 'to',
                    token: tokenFrom,
                    conId: conId,
                    action: 'end'
                }));
                endCon(cmd.conId);
            });

            toCon.on('close', function (had_error) {
                client.writeFrame(encode({
                    type: 'to',
                    token: tokenFrom,
                    conId: conId,
                    action: 'close',
                    hadError: had_error
                }));
                endCon(cmd.conId);
            });

            toCon.on('error', function () {
                client.writeFrame(encode({
                    type: 'to',
                    token: tokenFrom,
                    conId: conId,
                    action: 'error'
                }));
            })

            conList[cmd.conId] = toCon;
        }

        client.writeFrame(encode({
            type: 'token',
            token: cmder.token || getId(8)
        }));

        client.on('frame', function (cmd) {
            cmd = decode(cmd);

            switch (cmd.action) {
            case 'tokenGot':
                kit.logs('connected to server');
                break;

            case 'tokenExists':
                kit.errs('token exists');
                client.end();
                break;

            case 'data':
                var targetCon = conList[cmd.conId];

                if (targetCon) {
                    targetCon.write(cmd.data);
                } else {
                    addCon(cmd);
                }
                break;

            case 'end':
                endCon(cmd.conId);
                break;

            case 'close':
                endCon(cmd.conId);

                if (cmd.hadError)
                    kit.errs('client socket error: ' + cmd.conId);
                break;

            case 'error':
                endCon(cmd.conId);
                kit.errs('client socket error: ' + cmd.conId);
                break;

            default:
                kit.logs('unknown client cmd type', cmd);
            }
        });
    });

    tcpFrame(client, {
        cipher: crypto.createCipher(cmder.algorithm, new Buffer(cmder.key)),
        decipher: crypto.createDecipher(cmder.algorithm, new Buffer(cmder.key))
    });

    client.on('end', function () {
        kit.logs('server end');
        restart();
    })

    client.on('error', function (err) {
        kit.errs(err);
        restart();
    });

    var server = net.createServer(function (con) {
        var conId = getId();

        conList[conId] = con;

        con.on('data', function (data) {
            client.writeFrame(encode({
                type: 'to',
                token: cmder.targetToken,
                action: 'data',
                conId: conId,
                data: data
            }));
        });

        con.on('end', function () {
            client.writeFrame(encode({
                type: 'to',
                token: cmder.targetToken,
                conId: conId,
                action: 'end'
            }));
        });

        con.on('close', function () {
            client.writeFrame(encode({
                type: 'to',
                token: cmder.targetToken,
                conId: conId,
                action: 'close'
            }));
        });

        con.on('error', function () {
            client.writeFrame(encode({
                type: 'to',
                token: cmder.targetToken,
                conId: conId,
                action: 'error'
            }));
        });
    });

    kit.logs('expose port:', cmder.xport);

    if (cmder.targetToken) {
        server.listen(cmder.port, function () {
            kit.logs('listen to port:', cmder.port);
        });
    }
}

if (cmder.server) {
    runServer();
} else {
    runClient();
}
