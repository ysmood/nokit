#!/usr/bin/env node

var kit = require('../lib/kit');
kit.requireOptional.autoInstall = true;

var _ = kit._;
var cmder = kit.requireOptional('commander', __dirname, '^2.9.0');
var not = require('../lib/not');
var os = require('os');
var mapPort

cmder
    .description('a tcp/udp tunnel tool')
    .usage('[options]')
    .option('-x, --xport <port>', 'the port to export')
    .option('--xhost <host>', 'the host to export', '127.0.0.1')
    .option('-n, --name <name>', 'the name of current client', os.hostname())
    .option('-t, --targetName <name>', 'the name of target client')
    .option('-p, --port <port>', 'the port to listen to', 7000)
    .option('--phost <host>', 'the host to listen to', '127.0.0.1')
    .option('-s, --server', 'start as tunnel server')
    .option('-o, --host <host>', 'the host of the tunnel server', '0.0.0.0')
    .option('-r, --hostPort <port>', 'the port of the tunnel server', 8091)
    .option(
        '-m, --mapPort <srcHost:srcPort:destHost:destPort>',
        'map one port to another, if this mode is on, other mode will be off. ' +
        'req -> srcHost:srcPort -> destHost:destPort',
        function (p) {
            if (!mapPort) mapPort = [];
            mapPort.push(p);
        }
    )
    .option('-k, --key <str>', 'the key to secure the transport layer', '3.141592')
    .option('-a, --algorithm <name>', 'the algorithm to secure the transport layer', 'aes-128-cfb')
.parse(process.argv);

if (_.isFunction(cmder.name)) {
    cmder.name = undefined;
}

cmder.mapPort = mapPort

not(cmder).catch(kit.throw);
