#!/usr/bin/env node

var kit = require('../dist/kit');
var br = kit.require('brush');
var Promise = kit.Promise;
var _ = kit._;
var cmder = require('commander');

cmder
    .description('a tool for static server a folder')
    .usage('[options] [path]')
    .option('-p, --port <num>', 'port of the service [8080]', 8080)
    .option('--host <str>', 'host of the service [0.0.0.0]', '0.0.0.0')

    .option('--production', 'start as production mode, default is development mode')
.parse(process.argv);


var serveIndex, serveStatic;

Promise.resolve().then(function () {
    serveIndex = require('serve-index');
    serveStatic = require('serve-static');
}).catch(function () {
    return kit.spawn('npm', ['i', 'serve-index', 'serve-static']).then(function () {
        serveIndex = require('serve-index');
        serveStatic = require('serve-static');
    });
}).then(function () {
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
    var url = 'http://' + cmder.host + ':' + cmder.port;
    kit.logs('Serve: ' + br.cyan(url));

    return kit.xopen(url);
}).catch(kit.throw);

