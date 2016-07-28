#!/usr/bin/env node

var kit = require('../dist/kit');
var br = kit.require('brush');
var Promise = kit.Promise;
var _ = kit._;
var cmder = require('commander');

cmder
    .description('a tool to statically serve a folder')
    .usage('[options] [path]')
    .option('-p, --port <num>', 'port of the service [8080]', 8080)
    .option('--host <str>', 'host of the service [0.0.0.0]', '0.0.0.0')

    .option('--production', 'start as production mode, default is development mode')
.parse(process.argv);

Promise.resolve().then(function () {
    var serveIndex = kit.require('serve-index', __dirname);
    var serveStatic = kit.require('serve-static', __dirname);
    var proxy = kit.require('proxy');

    var app = proxy.flow();

    var dir = cmder.args[0] || '.';
    var staticOpts, indexOpts;

    if (!cmder.production) {
        staticOpts = {
            dotfiles: 'allow'
        };

        indexOpts = {
            hidden: true,
            icons: true,
            view: 'details'
        };
    }

    app.push(
        proxy.midToFlow(serveStatic(dir, staticOpts)),
        proxy.midToFlow(serveIndex(dir, indexOpts))
    )

    return app.listen(cmder.port, cmder.host);
}).then(function () {
    var url = 'http://127.0.0.1:' + cmder.port;
    kit.logs('Serve: ' + br.cyan(url));

    return kit.xopen(url);
}).catch(kit.throw);

