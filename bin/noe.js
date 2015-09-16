#!/usr/bin/env node

// Run program automatically
// Example:
// ```
// noe app.js # By default, it will try to use babel-node or node to execute the file.
// noe node app.js
// noe coffee app.js
// noe babel-node app.js
// ```

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
    .option('-b <name>', 'bin to execute, default is babel-node or node', 'babel-node')
    .option('-n', 'don\'t watch dependencies as node')
.parse(argv);

if (cmder.B === 'babel-node') {
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
}).childPromise.catch(function () {
    process.exit(1);
});
