var kit = require('./kit');

var br = kit.require('brush');
var _ = kit._;
var Promise = kit.Promise;
var tcpFrame = require('./tcpFrame');
var net = require('net');
var crypto = require('crypto');
var os = require('os');

var msgpack = kit.requireOptional('msgpack5', __dirname, '^3.4.0')();

var supportedAlgorithms = [
    'rc4',
    'aes-128-cfb',
    'aes-192-cfb',
    'aes-256-cfb'
]

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
function runServer (opts) {
    var clientList = {};

    function addClient (sock) {
        tcpFrame(sock);

        sock.setKeepAlive(true, 10 * 1000);

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
                if (!cmd.name || clientList[cmd.name]) {
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

    var defer = kit.Deferred();

    server.listen(opts.hostPort, opts.host, function () {
        defer.resolve({
            server: server
        });

        kit.logs('listening on', opts.host + ':' + server.address().port);
    });

    return defer.promise;
}

var isStarting = true;
function runClient (opts) {
    var conList = {};

    var defer = kit.Deferred();
    var deferServer = kit.Deferred();

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
                setTimeout(runClient, 3000, opts);
            });
        } else {
            setTimeout(runClient, 3000, opts);
        }
    }

    var client = net.connect(opts.hostPort, opts.host, function () {
        function addCon (cmd) {
            var nameFrom = cmd.nameFrom;
            var conId = cmd.conId;

            var toCon = net.connect(opts.xport, function () {
                client.writeFrame(encode({
                    type: 'to',
                    name: nameFrom,
                    action: 'started',
                    conId: conId
                }));
            });

            toCon.cipher = crypto.createCipher(opts.algorithm, new Buffer(opts.key));
            toCon.decipher = crypto.createDecipher(opts.algorithm, new Buffer(opts.key));

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
            name: opts.name
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
                if (opts.xport === null) {
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
                deferServer.promise.then(function () {
                    defer.resolve({
                        client: client,
                        server: server
                    });
                });

                kit.logs('connected to server');
                break;

            case 'nameExists':
                kit.errs('name exists');
                client.end();
                defer.reject(new Error('name exists'));
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

    client.setKeepAlive(true, 10 * 1000);

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
        con.cipher = crypto.createCipher(opts.algorithm, new Buffer(opts.key));
        con.decipher = crypto.createDecipher(opts.algorithm, new Buffer(opts.key));

        var conId = getId();

        conList[conId] = con;

        con.nameFrom = opts.targetName;

        con.pause();

        client.writeFrame(encode({
            type: 'to',
            name: opts.targetName,
            conId: conId,
            action: 'start'
        }));

        con.on('data', function (data) {
            client.writeFrame(encode({
                type: 'to',
                name: opts.targetName,
                action: 'data',
                conId: conId,
                data: con.cipher.update(data)
            }));
        });

        con.on('end', function () {
            client.writeFrame(encode({
                type: 'to',
                name: opts.targetName,
                conId: conId,
                action: 'end'
            }));
        });

        con.on('close', function () {
            client.writeFrame(encode({
                type: 'to',
                name: opts.targetName,
                conId: conId,
                action: 'close'
            }));
        });

        con.on('error', function () {
            client.writeFrame(encode({
                type: 'to',
                name: opts.targetName,
                conId: conId,
                action: 'error'
            }));
        });
    });

    kit.logs('name:', opts.name);

    if (opts.xport)
        kit.logs('expose port:', opts.xport);

    if (opts.targetName) {
        server.listen(opts.port, opts.phost, function () {
            deferServer.resolve();

            kit.logs('listening on', opts.phost + ':' + server.address().port);
        });
    } else {
        deferServer.resolve();
    }

    return defer.promise;
}

module.exports = function (opts) {
    _.defaults(opts, {
        xport: null,
        name: opts.xport ? os.hostname() : getId(8),
        port: 7000,
        phost: '127.0.0.1',
        host: '0.0.0.0',
        hostPort: 8091,
        key: '3.141592',
        algorithm: 'aes-128-cfb'
    })

    if (supportedAlgorithms.indexOf(opts.algorithm) < 0) {
        console.error(br.red('algorithm must be one of:'), supportedAlgorithms);
        return Promise.reject(new Error('algorithm not supported'));
    }

    if (opts.server) {
        return runServer(opts);
    } else {
        return runClient(opts);
    }
};
