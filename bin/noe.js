#!/usr/bin/env node

// Run program automatically

var kit = require('../dist/kit');
var _ = kit._;
var whichSync = kit.require('whichSync');
var cmder = require('commander');

var argv = process.argv;
var sepIndex = argv.indexOf('--');
var childArgs;
var watchList;
var babelInstalled;

if (sepIndex > 0) {
    childArgs = argv.slice(sepIndex + 1);
    argv = argv.slice(0, sepIndex);
} else {
    childArgs = [];
}

cmder
    .description('a dev tool to run / watch / reload program automatically')
    .usage('[options] [file] [-- [child process options]]...')
    .option('-w <pattern>', 'watch file pattern list', function (p) {
        if (!watchList) watchList = [];
        watchList.push(p);
    })
    .option('-b <name>', 'bin to execute, default is babel-node or node', null)
    .option('-n', 'disable parse & watch node dependencies automatically')
    .on('--help', function () {
        console.log(
            '  Examples:\n\n' +
            '    noe es7.js\n' +
            '    noe -b coffee test.coffee\n' +
            '    noe -w \'lib/*.js\' -w \'src/*.js\' test.js\n'
        );
    })
.parse(argv);

if (cmder.B === null) {
    cmder.B = 'node';
    try {
        require.resolve('babel');
        cmder.B = 'babel-node';
    } catch (err) {}

    try {
        whichSync('babel-node');
        cmder.B = 'babel-node';
    } catch (err) {}
}

kit.monitorApp({
    bin: cmder.B,
    args: cmder.args.concat(childArgs),
    watchList: watchList,
    isNodeDeps: !cmder.N
});
