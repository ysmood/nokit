#!/usr/bin/env node

var kit = require('../dist/kit');
kit.requireOptional.autoInstall = true;

var br = kit.require('brush');
var _ = kit._;
var Promise = kit.Promise;
var cmder = kit.requireOptional('commander', __dirname, '^2.9.0');
var tcpFrame = require('../dist/tcpFrame');
var net = require('net');
var crypto = require('crypto');

var msgpack = kit.requireOptional('msgpack5', __dirname, '^3.4.0')();

cmder
    .description('a tcp tunnel tool')
    .usage('[options]')
    .option('-x, --xport <port>', 'the port to export', null)
    .option('-n, --name <name>', 'the name of current client', null)
    .option('-t, --targetName <name>', 'the name of target client')
    .option('-p, --port <port>', 'the port to listen to [7000]', 7000)
    .option('--phost <host>', 'the host to listen to [127.0.0.1]', '127.0.0.1')
    .option('-s, --server', 'start as tunnel server')
    .option('-o, --host <host>', 'the host of the tunnel server [0.0.0.0]', '0.0.0.0')
    .option('-r, --hostPort <port>', 'the port of the tunnel server [8091]', 8091)
    .option('-k, --key <str>', 'the key to secure the transport layer [3.141592]', '3.141592')
    .option('-a, --algorithm <name>', 'the algorithm to secure the transport layer [aes-128-cfb]', 'aes-128-cfb')
.parse(process.argv);

if (cmder.name === null) {
    cmder.name = getId(8);
}

var supportedAlgorithms = [
    'rc4',
    'aes-128-cfb',
    'aes-192-cfb',
    'aes-256-cfb'
]

if (supportedAlgorithms.indexOf(cmder.algorithm) < 0) {
    console.error(br.red('algorithm must be one of:'), supportedAlgorithms);
    process.exit(1);
}

function encode (obj) {
    obj.ver = 0;
    return msgpack.encode(obj);
}

function decode (obj) {
    return msgpack.decode(obj);
}

function getId (size) {
    return crypto.randomBytes(size || 4).toString('hex');
}

/**
 * We should keep the server as minimal as possible. So I inscrease the
 * protocol complexity to decrease the code base of the server.
 */
function runServer () {
    var clientList = {};

    function addClient (sock) {
        tcpFrame(sock);

        sock.clientNames = {};

        var name;

        sock.on('frame', function (cmd) {
            cmd = decode(cmd);

            if (!cmd) {
                kit.logs('unknown cmd type', cmd);
                sock.end();
                return;
            }

            switch (cmd.type) {

            case 'name':
                if (clientList[cmd.name]) {
                    sock.writeFrame(encode({
                        action: 'nameExists'
                    }));
                    sock.end();
                    break;
                }

                name = cmd.name;

                kit.logs('client connected:', name);
                clientList[name] = sock;

                sock.writeFrame(encode({
                    action: 'nameGot'
                }));
                break;

            // {
            //  type: "to",
            //  name: "...",
            //  action: "data" | "end",
            //  conId: String,
            //  data: Buffer
            // }
            case 'to':
                targetClient = clientList[cmd.name];

                // not equal to itself
                if (targetClient && targetClient !== sock) {
                    targetClient.clientNames[name] = true;

                    targetClient.writeFrame(encode({
                        nameFrom: name,
                        action: cmd.action,
                        conId: cmd.conId,
                        data: cmd.data
                    }));
                } else {
                    kit.logs('no such client with the name', cmd.name, cmd.action);
                }
                break;

            default:
                kit.logs('unknown cmd type', cmd);
                sock.end();
            }
        });

        sock.on('error', function () {
            if (name === undefined) return;

            kit.errs('client error:', name);

            rmClient(name);
        });

        sock.on('close', function () {
            if (name === undefined) return;

            kit.logs('client closed:', name);

            for (var n in sock.clientNames) {
                if (clientList[n]) {
                    clientList[n].writeFrame(encode({
                        action: 'clientClosed',
                        name: name
                    }));
                }
            }

            rmClient(name);
        });
    }

    function rmClient (name) {
        delete clientList[name];
    }

    var server = net.createServer(addClient);

    server.listen(cmder.hostPort, cmder.host, function () {
        kit.logs('listening on', cmder.host + ':' + server.address().port);
    });
}

var isStarting = true;
function runClient () {
    var conList = {};

    isStarting = false;

    function endCon (id) {
        if (id in conList) {
            conList[id].end();
            delete conList[id];
        }
    }

    function restart () {
        kit.logs('restart client...');

        if (isStarting) return;

        isStarting = true;

        // clean all connections
        for (var k in conList) {
            conList[k].destroy();
            delete conList[k];
        }

        if (server) {
            server.close(function () {
                setTimeout(runClient, 3000);
            });
        } else {
            setTimeout(runClient, 3000);
        }
    }

    var client = net.connect(cmder.hostPort, cmder.host, function () {
        function addCon (cmd) {
            var nameFrom = cmd.nameFrom;
            var conId = cmd.conId;

            var toCon = net.connect(cmder.xport, function () {
                client.writeFrame(encode({
                    type: 'to',
                    name: nameFrom,
                    action: 'started',
                    conId: conId
                }));
            });

            toCon.cipher = crypto.createCipher(cmder.algorithm, new Buffer(cmder.key));
            toCon.decipher = crypto.createDecipher(cmder.algorithm, new Buffer(cmder.key));

            toCon.nameFrom = nameFrom;

            toCon.on('data', function (data) {
                client.writeFrame(encode({
                    type: 'to',
                    name: nameFrom,
                    action: 'data',
                    conId: conId,
                    data: toCon.cipher.update(data)
                }));
            });

            toCon.on('end', function () {
                client.writeFrame(encode({
                    type: 'to',
                    name: nameFrom,
                    conId: conId,
                    action: 'end'
                }));
                endCon(cmd.conId);
            });

            toCon.on('close', function (had_error) {
                client.writeFrame(encode({
                    type: 'to',
                    name: nameFrom,
                    conId: conId,
                    action: 'close',
                    hadError: had_error
                }));
                endCon(cmd.conId);
            });

            toCon.on('error', function (err) {
                kit.errs('to socket error:', err)

                client.writeFrame(encode({
                    type: 'to',
                    name: nameFrom,
                    conId: conId,
                    action: 'error'
                }));
            });

            conList[cmd.conId] = toCon;
        }

        client.writeFrame(encode({
            type: 'name',
            name: cmder.name
        }));

        client.on('frame', function (cmd) {
            cmd = decode(cmd);

            if (!cmd) {
                kit.logs('unknown client cmd type', cmd);
                client.end();
                return;
            }

            switch (cmd.action) {
            case 'start':
                if (cmder.xport === null) {
                    client.writeFrame(encode({
                        type: 'to',
                        name: cmd.nameFrom,
                        action: 'noPortExported',
                        conId: cmd.conId
                    }));
                    break;
                }

                kit.logs('start connection:', cmd.conId);

                addCon(cmd);
                break;

            case 'noPortExported':
                kit.logs('no port exported, connection ended:', cmd.conId);
                endCon(cmd.conId);
                break;

            case 'started':
                kit.logs('connection started:', cmd.conId);

                conList[cmd.conId].resume();
                break;

            case 'nameGot':
                kit.logs('connected to server');
                break;

            case 'nameExists':
                kit.errs('name exists');
                client.end();
                process.exit();
                break;

            case 'data':
                var targetCon = conList[cmd.conId];

                if (targetCon) {
                    targetCon.write(targetCon.decipher.update(cmd.data));
                }
                break;

            case 'end':
                kit.logs('connection ended:', cmd.conId);

                endCon(cmd.conId);
                break;

            case 'close':
                kit.logs('connection closed:', cmd.conId);

                endCon(cmd.conId);

                if (cmd.hadError)
                    kit.errs('client socket error: ' + cmd.conId);
                break;

            case 'error':
                endCon(cmd.conId);
                kit.errs('client socket error: ' + cmd.conId);
                break;

            case 'clientClosed':
                kit.logs('client closed:', cmd.name);

                // clean up the connections left
                for (var k in conList) {
                    if (conList[k].nameFrom === cmd.name) {
                        conList[k].end();
                        delete conList[k];
                    }
                }
                break;

            default:
                kit.logs('unknown client cmd type', cmd);
                client.end();
            }
        });
    });

    tcpFrame(client);

    client.on('end', function () {
        kit.logs('client server end');
        restart();
    })

    client.on('error', function (err) {
        kit.errs('client error:', err);
        restart();
    });

    var server = net.createServer(function (con) {
        con.cipher = crypto.createCipher(cmder.algorithm, new Buffer(cmder.key));
        con.decipher = crypto.createDecipher(cmder.algorithm, new Buffer(cmder.key));

        var conId = getId();

        conList[conId] = con;

        con.nameFrom = cmder.targetName;

        con.pause();

        client.writeFrame(encode({
            type: 'to',
            name: cmder.targetName,
            conId: conId,
            action: 'start'
        }));

        con.on('data', function (data) {
            client.writeFrame(encode({
                type: 'to',
                name: cmder.targetName,
                action: 'data',
                conId: conId,
                data: con.cipher.update(data)
            }));
        });

        con.on('end', function () {
            client.writeFrame(encode({
                type: 'to',
                name: cmder.targetName,
                conId: conId,
                action: 'end'
            }));
        });

        con.on('close', function () {
            client.writeFrame(encode({
                type: 'to',
                name: cmder.targetName,
                conId: conId,
                action: 'close'
            }));
        });

        con.on('error', function () {
            client.writeFrame(encode({
                type: 'to',
                name: cmder.targetName,
                conId: conId,
                action: 'error'
            }));
        });
    });

    kit.logs('name:', cmder.name);

    if (cmder.xport)
        kit.logs('expose port:', cmder.xport);

    if (cmder.targetName) {
        server.listen(cmder.port, cmder.phost, function () {
            kit.logs('listening on', cmder.phost + ':' + server.address().port);
        });
    }
}

if (cmder.server) {
    runServer();
} else {
    runClient();
}
