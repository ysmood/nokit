#!/usr/bin/env node

// Run program automatically

var kit = require('../lib/kit');
kit.requireOptional.autoInstall = true;

var br = kit.require('brush');
var cmder = kit.requireOptional('commander', __dirname, '^2.9.0');

var argv = process.argv;
var sepIndex = argv.indexOf('--');
var childArgs;
var watchList;

if (sepIndex > 0) {
    childArgs = argv.slice(sepIndex + 1);
    argv = argv.slice(0, sepIndex);
} else {
    childArgs = [];
}

cmder
    .description('a dev tool to run / watch / reload program automatically')
    .usage('[options] [args...] [-- [child process options]...]')
    .option('-w, --watch <pattern>', 'watch file pattern list [target file]', function (p) {
        if (!watchList) watchList = [];
        watchList.push(p);
    })
    .option('--root <str>', 'watch directory, treat -w as pattern under the root path', null)
    .option('-p, --prefix <str>', 'stdout and stderr prefix, such as `web:green`, `web:blue`', null)
    .option('-b, --bin <name>', 'bin to execute, default is', 'node')
    .option('-r, --retry <time | auto>', 'auto restart program after it ends after some milliseconds', function (v) {
        return v === 'auto' ? v : +v;
    }, Infinity)
    .option('--least <time>', 'the least milliseconds for the program to run to trigger a full restart', parseInt, 5000)
    .option('--maxTry <count>', 'the max retry before the monitor stops retry', parseInt, Infinity)
    .option('-n, --noNodeDeps', 'disable parse & watch node dependencies automatically')
    .on('--help', function () {
        console.log(
            '  Examples:\n\n' +
            '    noe app.js\n' +
            '    noe -b babel-node -- test.coffee -b args\n' +
            '    noe -w \'lib/*.js\' -w \'src/*.js\' test.js\n'
        );
    })
.parse(argv);

function genRetry () {
    var retryTmr, attempt = 0;

    function runRetry (start) {
        if (attempt < cmder.maxTry)
            attempt++;
        else
            return process.exit(attempt);

        start();
        kit.logs(br.yellow('Retry'), attempt);

        retryTmr = setTimeout(function () {
            attempt = 0;
        }, cmder.least);
    }

    if (cmder.retry === 'auto') {
        return function (start) {
            var r = Math.random() * Math.pow(2, attempt) * 500;
            var t = Math.min(r, 1000 * 60 * 5);

            clearTimeout(retryTmr);

            return setTimeout(runRetry, t, start);
       };
    } else if (cmder.retry !== Infinity) {
        return function (start) {
            clearTimeout(retryTmr);

            return setTimeout(runRetry, cmder.retry, start);
       };
    }
}

kit.monitorApp({
    bin: cmder.bin,
    retry: genRetry(),
    opts: {
        prefix: cmder.prefix,
    },
    args: cmder.args.concat(childArgs),
    watchList: watchList,
    watchRoot: cmder.root,
    isNodeDeps: !cmder.noNodeDeps
});
