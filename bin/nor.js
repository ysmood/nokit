#!/usr/bin/env node

var kit = require('../lib/kit');
kit.requireOptional.autoInstall = true;

var cmder = kit.requireOptional('commander', __dirname, '^2.14.1');


cmder
    .description('a cross platform remote shell')
    .option('-o, --host <host>', 'the host', '127.0.0.1')
    .option('-p, --port <port>', 'the port', 8930)
.parse(process.argv);

require('../lib/nor')(cmder);
