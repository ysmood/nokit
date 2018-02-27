#!/usr/bin/env node

var kit = require('../lib/kit');
kit.requireOptional.autoInstall = true;

var cmder = kit.requireOptional('commander', __dirname, '^2.14.1');


cmder
    .description('a cross platform remote shell')
    .option('-o, --host <host>', 'the host', '127.0.0.1')
    .option('-p, --port <port>', 'the port', 8930)
    .option('-s, --shell <str>', 'the shell name', process.env.SHELL)
    .option('-c, --client', 'client mode')
    .option('-k, --key <str>', 'password to login the shell')
.parse(process.argv);

const nor = require('../lib/nor')

if (cmder.client) {
    nor.client(cmder)
} else {
    nor.server(cmder)
}
