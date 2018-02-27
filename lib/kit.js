'use strict';

const _ = require('lodash');
const fs = require('nofs');
const Promise = require('yaku');
const yutils = require('yaku/lib/utils');
const nodeUrl = require('url');

const kit = {};

/**
 * Nokit extends all the functions of [nofs](https://github.com/ysmood/nofs)
 * and [`yaku/lib/utils`](https://github.com/ysmood/yaku#utils).
 * You can use it as same as nofs. For more info, see the doc:
 *
 * [Offline Documentation](?gotoDoc=nofs/readme.md)
 * @example
 * ```js
 * kit.readFile('test.txt', 'utf8').then((str) =>
 *     console.log(str)
 * );
 *
 * kit.outputFile('a.txt', 'test')
 * .then(() => kit.log('done'));
 *
 * kit.writeJSON('b.json', { a: 10 })
 * .then(() => kit.log('done'))
 *
 * kit.mkdirs('b.json', { a: 10 })
 * .then(() => kit.log('done'));
 * ```
 */
const Overview = 'overview'; // eslint-disable-line

_.extend(kit, fs, yutils, {

    /**
     * The [lodash](https://lodash.com) lib.
     * @type {Object}
     * @example
     * ```js
     * kit._.map([1, 2, 3]);
     * ```
     */
    _,

    requireCache: {},

    /**
     * The browser helper. It helps you to live reload the page and log remotely.
     * @static
     * @param {Object} opts The options of the client, defaults:
     * ```js
     * {
     *  host: '', // The host of the event source.
     *  useJs: false // By default the function will return html string
     * }
     * ```
     * @return {String} The code of client helper.
     * @example
     * When the client code is loaded on the browser, you can use
     * the `nb.log` to log anything to server's terminal.
     * The server will auto-format and log the information to the terminal.
     * It's convinient for mobile development when remote debug is not possible.
     * ```js
     * // The nb is assigned to the "window" object.
     * nb.log({ a: 10 });
     * nb.log(10);
     * nb.es.addEventListener('fileModified', () =>
     *  console.log('file changed')
     * );
     * ```
     */
    browserHelper(opts) {
        if (opts == null) {
            opts = {};
        }
        const helper = kit.browserHelper.cache ||
            kit.require('./browserHelper', __dirname).toString();

        const optsStr = JSON.stringify(_.defaults(opts, {
            host: ''
        }));

        const js = `
            if (!window.nokit) window.nokit = (${helper})(${optsStr});\n\
        `;

        if (opts.useJs) {
            return js;
        } else {
            return `
                \n\n<!-- Nokit Browser Helper -->
                <script type="text/javascript">
                ${js}
                </script>\n\n\
            `;
        }
    },

    /**
     * Generate styled string for terminal.
     * It's disabled when `process.env.NODE_ENV == 'production'`.
     * @example
     * ```js
     * let br = kit.require('brush');
     * kit.log(br.red('error info'));
     *
     * // Disable color globally.
     * br.isEnabled = false;
     *
     * // To see all the available brushes.
     * kit.log(Object.keys(br));
     * ```
     */
    brush: null,

    /**
     * A fast file cache helper. It uses hard link to cache files.
     * @param  {Object} info Not optional.
     * ```js
     * {
     *     // The first item is the key path, others are
     *     // its dependencies.
     *     deps: Array,
     *
     *     // The path of the output file.
     *     // If it's undefined, depsCache will try to get cache.
     *     dests: Array,
     *
     *     cacheDir: '.nokit'
     * }
     * ```
     * @return {Promise} Resolve a info object.
     * ```js
     * {
     *     isNewer: Boolean,
     *
     *     // { path: mtime }
     *     deps: Object,
     *
     *     // { destPath: cachePath }
     *     dests: Object,
     *
     *     cacheError: undefined || Error
     * }
     * ```
     * @example
     * ```js
     * // Set cache
     * kit.depsCache({
     *  dests: ['index.css'],
     *  deps: ['index.less', 'b.less', 'c.less']
     * });
     *
     * // Get cache
     * // You don't have to sepecify 'b.less', 'c.less'.
     * kit.depsCache({ deps: ['index.less'] })
     * .then((cache) => {
     *     if (cache.isNewer) {
     *         kit.log('cache is newer');
     *         kit.log(cache.dests);
     *     }
     * });
     * ```
     */
    depsCache(opts) {
        let info;
        _.defaults(opts, {
            cacheDir: '.nokit'
        });

        if (kit.depsCache.jhash == null) {
            kit.depsCache.jhash = new(kit.require('jhash').constructor);
        }

        const hashPath = function (path) {
            const hash = kit.depsCache.jhash.hash(path, true) + '-' +
                kit.path.basename(path);
            path = kit.path.join(opts.cacheDir, hash);
            return {
                cache: path,
                info: path + '.json'
            };
        };

        const key = hashPath(opts.deps[0]);

        if (opts.dests) {
            info = {
                dests: {},
                deps: {}
            };

            const saveLink = (from, to) =>
                kit.mkdirs(opts.cacheDir).then(() =>
                    kit.link(from, to)
                    .catch(function (err) {
                        if (err.code !== 'EEXIST') {
                            return Promise.reject(err);
                        }
                        return kit.unlink(to).then(() => kit.link(from, to));
                    })
                );

            const saveInfo = infoPath =>
                Promise.all(opts.deps.map(function (path, i) {
                    if (i === 0) {
                        return info.deps[path] = Date.now();
                    }
                    return kit.stat(path).catch(function () {}).then(function (stats) {
                        if (!stats) {
                            return;
                        }
                        return info.deps[path] = stats.mtime.getTime();
                    });
                })).then(() => kit.outputJson(infoPath, info)).then(() =>
                    Promise.all(opts.deps.slice(1).map(dep => saveLink(infoPath, hashPath(dep).info)))
                );

            const saveContents = () =>
                Promise.all(opts.dests.map(function (dest) {
                    const hashed = hashPath(dest);
                    info.dests[dest] = hashed.cache;
                    return saveLink(dest, hashed.cache);
                }));

            return Promise.all([
                saveContents(),
                saveInfo(key.info)
            ]);
        } else {
            info = {};
            return kit.readJson(key.info)
                .then(function (data) {
                    info = data;
                    return Promise.all(_(info.deps).keys().map(path =>
                        kit.stat(path).then(stats =>
                            // cache mtime             file mtime
                            info.deps[path] >= stats.mtime.getTime())
                    ).value());
                }).then(function (latestList) {
                    info.deps = _.keys(info.deps);
                    return info.isNewer = _.every(latestList);
                }).catch(err => info.cacheError = err)
                .then(() => info);
        }
    },

    /**
     * Daemonize a program. Just a shortcut usage of `kit.spawn`.
     * @param  {Object} opts Defaults:
     * ```js
     * {
     *  bin: 'node',
     *  args: ['app.js'],
     *  stdout: 'stdout.log', // Can also be a fd
     *  stderr: 'stderr.log'  // Can also be a fd
     * }
     * ```
     * @return {Porcess} The daemonized process.
     */
    daemonize(opts) {
        let errLog, outLog;
        if (opts == null) {
            opts = {};
        }
        _.defaults(opts, {
            bin: 'node',
            args: ['app.js'],
            stdout: 'stdout.log',
            stderr: 'stderr.log'
        });

        if (_.isString(opts.stdout)) {
            outLog = kit.fs.openSync(opts.stdout, 'a');
        }
        if (_.isString(opts.stderr)) {
            errLog = kit.fs.openSync(opts.stderr, 'a');
        }

        const p = kit.spawn(opts.bin, opts.args, {
            detached: true,
            stdio: ['ignore', outLog, errLog]
        }).process;
        p.unref();
        return p;
    },

    /**
     * A simple decrypt helper. Cross-version of node.
     * @param  {Any} data
     * @param  {String | Buffer} password
     * @param  {String} algorithm Default is 'aes128'.
     * @return {Buffer}
     */
    decrypt(data, password, algorithm) {
        if (algorithm == null) {
            algorithm = 'aes128';
        }
        const crypto = kit.require('crypto', __dirname);
        const decipher = crypto.createDecipher(algorithm, password);

        if (!Buffer.isBuffer(data)) {
            data = new Buffer(data);
        }
        return Buffer.concat([decipher.update(data), decipher.final()]);
    },

    /**
     * The warp drives.
     * You must `kit.require 'drives'` before using it.
     * For more information goto the `Drives` section.
     * @type {Object}
     */
    drives: null,

    /**
     * A simple encrypt helper. Cross-version of node.
     * @param  {Any} data
     * @param  {String | Buffer} password
     * @param  {String} algorithm Default is 'aes128'.
     * @return {Buffer}
     */
    encrypt(data, password, algorithm) {
        if (algorithm == null) {
            algorithm = 'aes128';
        }
        const crypto = kit.require('crypto', __dirname);
        const cipher = crypto.createCipher(algorithm, password);

        if (!Buffer.isBuffer(data)) {
            data = new Buffer(data);
        }
        return Buffer.concat([cipher.update(data), cipher.final()]);
    },

    /**
     * A error log shortcut for `kit.log(msg, 'error', opts)`
     * @param  {Any} msg
     * @param  {Object} opts
     */
    err(msg, opts) {
        if (opts == null) {
            opts = {};
        }
        return kit.log(msg, 'error', opts);
    },

    /**
     * Shortcut for logging multiple error infos.
     * @param  {Any} args...
     * @example
     * ```js
     * kit.errs('test1', 'test2', 'test3');
     * // => [2015-02-07 08:31:49] test1 test2 test3
     * ```
     */
    errs(...args) {
        let out = '';
        const last = args.length - 1;
        for (var i = 0; i < args.length; i++) {
            const arg = args[i];
            kit.log(arg, {
                isShowTime: false,
                log(str) {
                    return out += str + (i === last ? '' : ' ');
                }
            });
        }
        return kit.log(out, 'error');
    },

    /**
     * A better `child_process.exec`. Supports multi-line shell script.
     * For supporting old version of node, it will create 3 temp files,
     * the temp files will be removed after the execution.
     * @param  {String} cmd   Shell commands.
     * @param  {String} shell Shell name. Such as `bash`, `zsh`. Optinal.
     * @return {Promise} Resolves when the process's stdio is drained.
     * The resolve value is like:
     * ```js
     * {
     *     code: 0,
     *     signal: null,
     *     stdout: 'hello world',
     *     stderr: ''
     * }
     * ```
     * @example
     * ```js
     * kit.exec(`
     *     a='hello world'
     *     echo $a
     * `).then(({code, stdout}) => {
     *     kit.log code   // output => 0
     *     kit.log stdout // output => "hello world"
     * });
     *
     * // Bash doesn't support "**" recusive match pattern.
     * let p = kit.exec(`
     *  echo **\/*.css
     * `, 'zsh');
     *
     * // Get the child process object.
     * p.process.then((proc) =>
     *  kit.log(proc.pid)
     * );
     * ```
     */
    exec(cmd, shell) {
        const os = kit.require('os', __dirname);

        if (shell == null) {
            shell = process.env.SHELL ||
                process.env.ComSpec ||
                process.env.COMSPEC;
        }

        const randName = Date.now() + Math.random();

        const paths = ['.in', '.out', '.err']
            .map(type => kit.path.join(os.tmpdir(), `nokit-${randName}${type}`));

        const [stdinPath, stdoutPath, stderrPath] = Array.from(paths);

        let fileHandlers = [];

        const clean = () =>
            Promise.all(fileHandlers.map(f => kit.close(f)))
            .then(() => Promise.all(paths.map(p => kit.remove(p))));

        let proc = null;
        const processPromise = kit.outputFile(stdinPath, cmd + '\n')
            .then(() =>
                Promise.all([
                    kit.fs.open(stdinPath, 'r'),
                    kit.fs.open(stdoutPath, 'w'),
                    kit.fs.open(stderrPath, 'w')
                ]))
            .then(function (stdio) {
                fileHandlers = fileHandlers.concat(stdio);
                const p = kit.spawn(shell, [], {
                    stdio
                });
                ({
                    process: proc
                } = p);
                return p;
            });

        const promise = processPromise.then(msg =>
                kit.readFile(stdoutPath, 'utf8')
                .then(stdout => _.extend(msg, {
                    stdout
                })))
            .catch(msg =>
                kit.readFile(stderrPath, 'utf8')
                .then(function (stderr) {
                    _.extend(msg, {
                        stderr
                    });
                    return Promise.reject(msg);
                })
            );

        promise.process = processPromise.then(() => proc);

        promise.then(clean).catch(clean);

        return promise;
    },

    /**
     * Format the parsed comments array to a markdown string.
     * @param  {Array}  comments
     * @param  {Object} opts Defaults:
     * ```js
     * {
     *     indent: 0,
     *     name: ({ name }) => String,
     *     tag: ({ tagName, name, type }) => String
     * }
     * ```
     * @return {String}
     */
    formatComment(comments, opts) {
        if (opts == null) {
            opts = {};
        }
        _.defaults(opts, {
            indent: 0,
            name({
                name
            }) {
                name = name.replace('self.', '');
                return `- #### ${name}\n\n`;
            },
            tag({
                tagName,
                name,
                type
            }) {
                const tname = name ? ` \`${name}\`` : '';
                const ttype = type ? ` { _${type}_ }` : '';
                return `- **<u>${tagName}</u>**:${tname}${ttype}`;
            }
        });

        let all = '';
        for (let cmt of Array.from(comments)) {
            if (_.some(cmt.tags, {
                    tagName: 'private'
                })) {
                continue;
            }

            const paramList = _(cmt.tags)
                .filter(tag => tag.tagName === 'param').map('name')
                .value();

            if (paramList.length > 0) {
                cmt.name += `(${paramList.join(', ')})`;
            } else if (_.find(cmt.tags, {
                    tagName: 'return'
                })) {
                cmt.name += "()";
            }

            let cmtStr = opts.name(cmt);

            if (cmt.description) {
                cmtStr += kit.indent(cmt.description, 4);
                cmtStr += '\n\n';
            }

            for (let tag of Array.from(cmt.tags)) {
                cmtStr += kit.indent(opts.tag(tag), 4);
                cmtStr += '\n\n';
                if (tag.description) {
                    cmtStr += kit.indent(tag.description, 8);
                    cmtStr += '\n\n';
                }
            }

            all += cmtStr;
        }

        // Remove tailing space
        all = all.replace(/[ \t]+$/mg, '');

        return kit.indent(all, opts.indent);
    },

    /**
     * See my project [nofs](https://github.com/ysmood/nofs).
     *
     * [Offline Documentation](?gotoDoc=nofs/readme.md)
     */
    fs,

    /**
     * Fuzzy search a string list by a key word.
     * @param {String} keys The key word.
     * @param {Array} list The list of string to search.
     * @param {Object} opts Defaults:
     * ```js
     * {
     *     result: (wrappedList) =>
     *         wrappedList.minBy('distance').words,
     *     threshold: (cOffset, keyLen, cIndex) =>
     *         Infinity,
     *     notFound: (cOffset, keyLen, cIndex) =>
     *         Infinity,
     *     span: (cOffset, keyLen, cIndex) =>
     *         cOffset,
     *     found: (cOffset, keyLen, cIndex) =>
     *         (Math.exp(cOffset + 1) - 1) * (keyLen - cIndex),
     *     tail: (cOffset, keyLen, cIndex, tailLen) =>
     *         tailLen
     * }
     * ```
     * @return {String} The best matched one. If not found,
     * return undefined.
     * @example
     * ```js
     * kit.fuzzySearch('hw', ['test', 'hello world', 'hey world'])
     * // output => 'hey world'
     *
     * // To get a sortable weighted list.
     * kit.fuzzySearch('hw', ['test', 'hello world', 'hey world'], {
     *  result: (wrappedList) => wrappedList.value()
     * });
     * // output => [
     * //  { distance: Infinity }
     * //  { words: 'hello world', distance: 1110.069 }
     * //  { words: 'hey world', distance: 159.849 }
     * // ]
     * ```
     */
    fuzzySearch(key, list, opts) {
        if (opts == null) {
            opts = {};
        }
        _.defaults(opts, {
            result(list) {
                return list.minBy('distance').words;
            },
            threshold() {
                return Infinity;
            },
            notFound() {
                return Infinity;
            },
            span(cOffset) {
                return cOffset;
            },
            found(cOffset, keyLen, cIndex) {
                return (Math.exp(cOffset + 1) - 1) * (keyLen - cIndex);
            },
            tail(cOffset, keyLen, cIndex, tailLen) {
                return tailLen;
            }
        });

        const wrappedList = _(list)
            .map(function (words) {
                let cIndex, cOffset;
                let distance = 0;
                const keyLen = key.length;
                for (cIndex = 0; cIndex < key.length; cIndex++) {
                    const c = key[cIndex];
                    cOffset = words.indexOf(c, cOffset + 1);
                    distance = cOffset < 0 ?
                        opts.notFound(cOffset, keyLen, cIndex) :
                        distance + opts.found(cOffset, keyLen, cIndex);

                    distance += opts.span(cOffset, keyLen, cIndex);

                    if (distance >= opts.threshold(cOffset, keyLen, cIndex)) {
                        return {
                            distance: Infinity
                        };
                    }
                }

                distance += opts.tail(cOffset, keyLen,
                    cIndex, words.slice(cOffset).length);

                if (distance >= opts.threshold(cOffset, keyLen, cIndex)) {
                    return {
                        distance: Infinity
                    };
                }

                return {
                    words,
                    distance
                };
            });

        return opts.result(wrappedList);
    },

    /**
     * Generate a list of module paths from a name and a directory.
     * @param  {String} moduleName The module name.
     * @param  {String} dir        The root path. Default is current working dir.
     * @param  {String} modDir     Default is 'node_modules'.
     * @return {Array} Paths
     * @example
     * ```js
     * // Suppose current working directory is '/home/a'
     * kit.genModulePaths('test')
     * // output => ['/home/a/node_modules/test', '/home/node_modules/test', '/node_modules/test']
     * ```
     */
    genModulePaths(moduleName, dir, modDir) {
        if (dir == null) {
            dir = process.cwd();
        }
        if (modDir == null) {
            modDir = 'node_modules';
        }
        const names = [];
        while (true) { // eslint-disable-line
            names.push(kit.path.join(dir, modDir, moduleName));
            const pDir = kit.path.dirname(dir);

            if (dir === pDir) {
                break;
            }
            dir = pDir;
        }
        names.push(moduleName);
        return names;
    },

    /**
     * Indent a text block.
     * @param {String} text
     * @param {Int} num
     * @param {String} char
     * @param {RegExp} reg Default is `/^/mg`.
     * @return {String} The indented text block.
     * @example
     * ```js
     * // Increase
     * kit.indent("one\ntwo", 2)
     * // => "  one\n  two"
     *
     * // Decrease
     * kit.indent("--one\n--two", 0, '', /^--/mg)
     * // => "one\ntwo"
     * ```
     */
    indent(text, num, char, reg) {
        if (num == null) {
            num = 0;
        }
        if (char == null) {
            char = ' ';
        }
        if (reg == null) {
            reg = /^/mg;
        }
        const prefix = _.repeat(char, num);
        return text.replace(reg, prefix);
    },

    /**
     * Nokit use it to check the running mode of the app.
     * Overwrite it if you want to control the check logic.
     * By default it returns the `rocess.env.NODE_ENV == 'development'`.
     * @return {Boolean}
     */
    isDevelopment() {
        return process.env.NODE_ENV === 'development';
    },

    /**
     * Nokit use it to check the running mode of the app.
     * Overwrite it if you want to control the check logic.
     * By default it returns the `rocess.env.NODE_ENV == 'production'`.
     * @return {Boolean}
     */
    isProduction() {
        return process.env.NODE_ENV === 'production';
    },

    /**
     * A fast helper to hash string or binary file.
     * See my [jhash](https://github.com/ysmood/jhash) project.
     * You must `kit.require 'jhash'` before using it.
     *
     * [Offline Documentation](?gotoDoc=jhash/readme.md)
     * @example
     * ```js
     * kit.require('jhash');
     * kit.jhash.hash('test'); // output => '349o'
     *
     * jhash.hash(kit.readFileSync('a.jpg'));
     *
     * // Control the hash char set.
     * kit.jhash.setSymbols('abcdef');
     * kit.jhash.hash('test'); // output => 'decfddfe'
     *
     * // Control the max length of the result hash value. Unit is bit.
     * jhash.setMaskLen(10);
     * jhash.hash('test'); // output => 'ede'
     * ```
     */
    jhash: null,

    /**
     * A better log for debugging, it uses the `kit.xinspect` to log.
     *
     * Use terminal command like `logReg='pattern' node app.js` to
     * filter the log info.
     *
     * Use `logTrace='on' node app.js` to force each log end with a
     * stack trace.
     * @param  {Any} msg Your log message.
     * @param  {String} action 'log', 'error', 'warn'.
     * @param  {Object} opts Default is same with `kit.xinspect`,
     * but with some extra options:
     * ```js
     * {
     *  isShowTime: true,
     *  logReg: process.env.logReg && new RegExp(process.env.logReg),
     *  logTrace: process.env.logTrace === 'on',
     *
     *  // Custom log method
     *  log: (str, action) => console[action](str)
     * }
     * ```
     * @example
     * ```js
     * kit.log('test');
     * // => '[2015-02-07 08:31:49] test'
     *
     * kit.log('test', { isShowTime: false });
     * // => 'test'
     *
     * kit.log('test', { logReg: /a/ });
     * // => ''
     *
     * kit.log('%s %s %d', ['a', 'b', 10]);
     * // => '[2015-02-07 08:31:49] a b 10'
     * ```
     */
    log(...args) {
        let action, formats, opts, time, timeDelta;
        const br = kit.require('brush');

        if (_.isObject(action)) {
            opts = action;
            action = 'log';
        }

        let msg = args[0];
        ({
            action,
            formats,
            opts
        } = kit.defaultArgs(args.slice(1), {
            action: {
                String: 'log'
            },
            formats: {
                Array: null
            },
            opts: {
                Object: {}
            }
        }));

        _.defaults(opts, {
            isShowTime: true,
            logReg: process.env.logReg && new RegExp(process.env.logReg),
            logTrace: process.env.logTrace === 'on',
            log: null
        });

        if (!kit.lastLogTime) {
            kit.lastLogTime = new Date;
            if (opts.logReg) {
                kit.logReg = opts.logReg;
            }
        }

        if (opts.isShowTime) {
            time = new Date();
            timeDelta = br.grey((+time - +kit.lastLogTime) + 'ms');
            kit.lastLogTime = time;
            time = br.grey([
                [
                    [time.getFullYear(), 4, '0'],
                    [time.getMonth() + 1, 2, '0'],
                    [time.getDate(), 2, '0']
                ].map(e => _.padStart.apply(0, e)).join('-'), [
                    [time.getHours(), 2, '0'],
                    [time.getMinutes(), 2, '0'],
                    [time.getSeconds(), 2, '0']
                ].map(e => _.padStart.apply(0, e)).join(':')
            ].join(' '));
        }

        const log = function (str, time) {
            if (opts.isShowTime) {
                str = str + ' ' + time;
            }

            if (kit.logReg && !kit.logReg.test(str)) {
                return;
            }

            if (opts.log) {
                opts.log(str, action);
            } else {
                console[action](str);
            }

            if (opts.logTrace) {
                const err = br.grey((new Error).stack)
                    .replace(/.+\n.+\n.+/, '\nStack trace:');
                return console.log(err);
            }
        };

        if (_.isObject(msg)) {
            if (opts.isShowTime) {
                log(`[${time}] ->\n` + kit.xinspect(msg, opts), timeDelta);
            } else {
                log(kit.xinspect(msg, opts));
            }
        } else {
            if (formats) {
                formats.unshift(msg);
                const util = kit.require('util', __dirname);
                msg = util.format.apply(0, formats);
            }

            if (opts.isShowTime) {
                log(`[${time}] ` + msg, timeDelta);
            } else {
                log(msg, timeDelta);
            }
        }

        if (action === 'error') {
            process.stderr.write("\u0007");
        }

    },

    /**
     * Shortcut for logging multiple infos.
     * @param  {Any} args...
     * @example
     * ```js
     * kit.logs('test1', 'test2', 'test3');
     * // => [2015-02-07 08:31:49] test1 test2 test3
     * ```
     */
    logs(...args) {
        let out = '';
        const last = args.length - 1;
        for (var i = 0; i < args.length; i++) {
            const arg = args[i];
            kit.log(arg, {
                isShowTime: false,
                log(str) {
                    return out += str + (i === last ? '' : ' ');
                }
            });
        }
        return kit.log(out);
    },

    /**
     * Monitor an application and automatically restart it when file changed.
     * Even when the monitored app exit with error, the monitor will still wait
     * for your file change to restart the application. Not only nodejs, but also
     * other programs like ruby or python.
     * It will print useful infomation when it application unexceptedly.
     * @param  {Object} opts Defaults:
     * ```js
     * {
     *  bin: 'node',
     *  args: ['index.js'],
     *  prefix: 'string', // see the `kit.spawn` for details
     *  watchList: [], // By default, the same with the "args".
     *  isNodeDeps: true,
     *  opts: {}, // Same as the opts of 'kit.spawn'.
     *
     *  // The option of `kit.parseDependency`
     *  parseDependency: {},
     *
     *  // A hook for restarting the program, run the function "start" to
     *  // restart.
     *  retry: (start) => {},
     *
     *  onStart: =>
     *      kit.log("Monitor: " + opts.watchList),
     *  onRestart: (path) =>
     *      kit.log("Reload app, modified: " + path),
     *  onWatchFiles: (paths) =>
     *      kit.log('Watching:' + paths.join(', ')),
     *  onNormalExit: ({ code, signal }) =>
     *      kit.log('EXIT' +
     *          ` code: ${code} signal: ${signal}`),
     *  onErrorExit: ({ code, signal }) =>
     *      kit.err('EXIT' +
     *      ` code: ${code} signal: ${signal}\n` +
     *      'Process closed. Edit and save the watched file to restart.'),
     * }
     * ```
     * @return {Object} Properties:
     * ```js
     * {
     *  // Call it to stop monitor.
     *  stop: => {},
     *
     *  // Resolve a list of watch handlers.
     *  watchPromise: Promise
     * }
     * ```
     * @example
     * ```js
     * kit.monitorApp({
     *  bin: 'coffee',
     *  args: ['main.coffee']
     * });
     *
     * kit.monitorApp({
     *  bin: 'ruby'
     *  args: ['app.rb', 'lib\/**\/*.rb']
     *  isNodeDeps: false
     * });
     * ```
     */
    monitorApp(opts) {
        const br = kit.require('brush');
        const treeKill = kit.require('treeKill');

        _.defaults(opts, {
            bin: 'node',
            args: ['index.js'],
            retry() {},
            watchList: null,
            watchRoot: null,
            isNodeDeps: true,
            parseDependency: {},
            opts: {},
            onStart() {
                return kit.logs(br.yellow("Monitor:"), opts.bin, opts.watchList);
            },
            onRestart(path) {
                return kit.log(br.yellow("Reload app, modified: ") + path);
            },
            onWatchFiles(paths) {
                const cwd = process.cwd();
                return kit.log(br.yellow('Watching: ') +
                    paths.map(p => kit.path.relative(cwd, p)).join(', ')
                );
            },
            onNormalExit({
                code,
                signal
            }) {
                kit.log(br.yellow('EXIT') +
                    ` code: ${br.cyan(code)} signal: ${br.cyan(signal)}`
                );
                return console.log('\n');
            },
            onErrorExit({
                code,
                signal
            }) {
                kit.err(br.yellow('EXIT') +
                    ` code: ${br.cyan(code)} ` +
                    `signal: ${br.cyan(signal)}\n` +
                    br.red(`Process closed. Edit and save the watched file to restart.`)
                );
                return console.log('\n');
            }
        });

        if (opts.watchList == null) {
            opts.watchList = opts.args;
        }

        let childPromise = null;
        var start = function () {
            childPromise = kit.spawn(
                opts.bin,
                opts.args,
                opts.opts
            );

            return childPromise.then(msg => opts.onNormalExit(msg)).catch(function (err) {
                if (err.stack) {
                    return Promise.reject(err.stack);
                }
                return opts.onErrorExit(err);
            }).then(() => opts.retry(start));
        };

        let watchedList = [];

        const watcher = _.debounce(function (path) {
            opts.onRestart(path);

            childPromise.catch(function () {}).then(start);
            return treeKill(childPromise.process.pid, 'SIGINT', _.noop);
        }, 50);

        const stop = function (sig) {
            if (sig == null) {
                sig = 'SIGINT';
            }
            treeKill(childPromise.process.pid, sig, _.noop);

            return watchPromise.then(() => Array.from(watchedList).map((w) => kit.unwatchFile(w.path, w.handler)));
        };

        const watch = function (paths) {
            if (_.isString(paths)) {
                paths = [paths];
            }
            paths = _.difference(
                (paths.map(p => kit.path.resolve(p))),
                (watchedList.map(w => kit.path.resolve(w.path)))
            );
            if (paths.length > 0) {
                opts.onWatchFiles(paths);
            }
            return kit.watchFiles(paths, {
                    handler: watcher
                })
                .then(ws => watchedList = watchedList.concat(ws));
        };

        process.on('SIGINT', function () {
            // it will unconditionally terminate Node.js on all platforms
            stop('SIGKILL');
            return process.exit();
        });

        var watchPromise = opts.watchRoot ?
            kit.watchDir(opts.watchRoot, {
                patterns: opts.watchList,
                handler(type, path) {
                    return watcher(path);
                }
            }) :
            opts.isNodeDeps ?
            kit.parseDependency(opts.watchList, opts.parseDependency)
            .then(watch) :
            kit.watchFiles(opts.watchList, {
                handler: watcher
            });

        opts.onStart();

        start();

        return {
            watchPromise,
            stop,
            watch
        };
    },

    /**
     * Node version. Such as `v0.10.23` is `0.1023`, `v0.10.1` is `0.1001`.
     * @return {Float}
     */
    nodeVersion() {
        if (kit.nodeVersion.ver) {
            return kit.nodeVersion.ver;
        }
        const ms = process.versions.node.match(/(\d+)\.(\d+)\.(\d+)/);
        const str = ms[1] + '.' + _.padStart(ms[2], 2, '0') + _.padStart(ms[3], 2, '0');
        return kit.nodeVersion.ver = +str;
    },

    /**
     * A helper for arguments type based function override.
     * @param  {Array | Object} args The arguments to set.
     * @param  {Object} defaults The default argument settings.
     * The key value of the setting is the argument name, the value
     * is an object, and the key is the type of the argument, the
     * value is the default value of the argument.
     * @return {Object}
     * @example
     * ```js
     * let foo = () => {
     *     kit.defaultArgs(arguments, {
     *         name: { String: 'A' },
     *         brush: { Array: [] },
     *         family: { String: null },
     *         isReal: { Boolean: false },
     *         fn: { Function: => 'callback' }
     *     });
     * };
     *
     * kit.log(foo('test', false, ['red'], -> 'nothing'));
     * // Here the logged value will deeply equal:
     * { name: 'test', brush: ['red'], family: null, fn: => 'nothing' }
     * ```
     */
    defaultArgs(args, defaults) {
        const set = _(args).toArray().groupBy(function (e) {
            if (e) {
                if (e.constructor.name === 'AsyncFunction') {
                    return 'Function';
                } else {
                    return e.constructor.name;
                }
            }
        }).value();

        const ret = {};
        for (let name in defaults) {
            var val = defaults[name];
            var [type] = Array.from(_.keys(val));
            ret[name] = (() => {
                if (set[type]) {
                    const [v] = Array.from(set[type].splice(0, 1));
                    if (v) {
                        return v;
                    } else {
                        return val[type];
                    }
                } else {
                    return val[type];
                }
            })();
        }
        return ret;
    },

    /**
     * A comments parser for javascript and coffee-script.
     * Used to generate documentation from source code automatically.
     * It will traverse through all the comments of a coffee file.
     * @param  {String} code Coffee source code.
     * @param  {Object} opts Parser options:
     * ```js
     * {
     *     commentReg: RegExp,
     *     splitReg: RegExp,
     *     tagNameReg: RegExp,
     *     typeReg: RegExp,
     *     nameReg: RegExp,
     *     nameTags: ['param', 'property'],
     *     descriptionReg: RegExp
     * }
     * ```
     * @return {Array} The parsed comments. Each item is something like:
     * ```js
     * {
     *     name: 'parseComment',
     *     description: 'A comments parser for coffee-script.',
     *     tags: [
     *         {
     *             tagName: 'param',
     *             type: 'string',
     *             name: 'code',
     *             description: 'The name of the module it belongs to.',
     *             index: 256, // The target char index in the file.
     *             line: 32 // The line number of the target in the file.
     *         }
     *     ]
     * }
     * ```
     */
    parseComment(code, opts) {
        if (opts == null) {
            opts = {};
        }
        _.defaults(opts, {
            commentReg: new RegExp(`(?:\\#\\#\\#|\\/\\*)\\*([\\s\\S]+?)(?:\\#\\#\\#|\\*\\/)\\s+(?:var\\s|let\\s|const\\s|function\\s+)?['"]?([$@\\w\\.-]+)['"]?`, 'g'),
            splitReg: /^\s+\* @/m,
            tagNameReg: /^([\w.]+)\s*/,
            typeReg: /^\{(.+?)\}\s*/,
            nameReg: /^(\[.+\]|\w+)\s*/,
            nameTags: ['param', 'property'],
            descriptionReg: /^([\s\S]*)/
        });

        const parseInfo = function (block) {
            // Unescape '\/'
            block = block.replace(/\\\//g, '/');

            // Clean the prefix '*'
            const arr = block.split(opts.splitReg).map(el => el.replace(/^[ \t]+\*[ \t]?/mg, '').trim());

            return {
                description: arr[0] || '',
                tags: arr.slice(1).map(function (el) {
                    const parseTag = function (reg) {
                        const m = el.match(reg);
                        if (m && m[1]) {
                            el = el.slice(m[0].length);
                            return m[1];
                        } else {
                            return null;
                        }
                    };

                    const tag = {};

                    tag.tagName = parseTag(opts.tagNameReg);

                    const type = parseTag(opts.typeReg);
                    if (type) {
                        tag.type = type;
                        if (Array.from(opts.nameTags).includes(tag.tagName)) {
                            tag.name = parseTag(opts.nameReg);
                        }
                        tag.description = parseTag(opts.descriptionReg) || '';
                    } else {
                        tag.description = parseTag(opts.descriptionReg) || '';
                    }
                    return tag;
                })
            };
        };

        const comments = [];
        let m = null;
        while ((m = opts.commentReg.exec(code)) !== null) {
            const info = parseInfo(m[1]);
            comments.push({
                name: m[2],
                description: info.description,
                tags: info.tags,
                index: opts.commentReg.lastIndex,
                line: _.reduce(code.slice(0, opts.commentReg.lastIndex), function (count, char) {
                    if (char === '\n') {
                        count++;
                    }
                    return count;
                }, 1)
            });
        }

        return comments;
    },

    /**
     * Parse dependency tree by regex. The dependency relationships
     * is not a tree, but a graph. To avoid dependency cycle, this
     * function only return an linear array of the dependencies,
     * from which you won't get the detail relationshops between files.
     * @param  {String | Array} entryPaths The file to begin with.
     * @param  {Object} opts Defaults:
     * ```js
     * {
     *  // It will match `require`, `import` statements.
     *  depReg: RegExp,
     *
     *  // It will handle all the matched paths.
     *  // Return false value if you don't want this match.
     *  handle: (path) => path
     * }
     * ```
     * @return {Promise} It resolves the dependency path array.
     * @example
     * ```js
     * kit.parseDependency('main.', {
     *  depReg: /require\s*\(?['"](.+)['"]\)?/gm,
     *  handle: (path) => {
     *      if (path.match(/^(?:\.|\/|[a-z]:)/i)) return path;
     *  }
     * })
     * .then((markdownStr) =>
     *  kit.log(markdownStr)
     * );
     * ```
     */
    parseDependency(entryPaths, opts, depPaths) {
        if (opts == null) {
            opts = {};
        }
        if (depPaths == null) {
            depPaths = {};
        }
        _.defaults(opts, {
            depReg: kit.parseDependencyReg,
            handle: _.identity,
            visitedPaths: {}
        });

        const winSep = /\\/g;

        if (_.isString(entryPaths)) {
            entryPaths = [entryPaths];
        }

        entryPaths = entryPaths.reduce(function (s, p) {
            if (opts.visitedPaths[p]) {
                return s;
            } else {
                opts.visitedPaths[p] = true;
            }

            if (kit.path.extname(p)) {
                s.push(p);
            } else {
                s.push(p + '{/index.,}*');
            }

            return s;
        }, []);

        // Parse file.
        return kit.glob(entryPaths).then(paths =>
            Promise.all(paths.map(function (path) {
                // Prevent the recycle dependencies.
                if (depPaths[path]) {
                    return;
                }

                return kit.readFile(path, 'utf8')
                    .then(function (str) {
                        // The point to add path to watch list.
                        depPaths[path.replace(winSep, '/')] = true;
                        const dir = kit.path.dirname(path);

                        entryPaths = [];
                        str.replace(opts.depReg, function (n0, ...rest) {
                            const adjustedLength = Math.max(rest.length, 2),
                                ms = rest.slice(0, adjustedLength - 2);
                            const p = opts.handle(_.find(ms, _.isString));
                            if (!p) {
                                return;
                            }
                            return entryPaths.push(kit.path.join(dir, p));
                        });

                        return kit.parseDependency(entryPaths, opts, depPaths);
                    }).catch(_.noop);
            }))).then(() => _.keys(depPaths));
    },

    parseDependencyReg: new RegExp(`require\\s*\\(?['"](.+)['"]\\)?|^\\s*import\\s+['"](.+)['"][;\\s]*$|^\\s*import[\\s\\S]+?from\\s+['"](.+)['"]`, 'mg'),

    /**
     * io.js native module `path`. See `nofs` for more information.
     */
    path: fs.path,

    /**
     * The promise lib. Now, it uses Yaku as ES5 polyfill.
     * In the future, the Yaku will be replaced with native
     * ES6 Promise. Please don't use any API other than the ES6 spec.
     * @type {Object}
     */
    Promise,

    /**
     * The `proxy` module.
     * You must `kit.require 'proxy'` before using it.
     * For more information goto the `Proxy` section.
     */
    proxy: null,

    /**
     * Reduce a string via a regex.
     * @param  {RegExp} reg
     * @param  {String} str
     * @param  {Function} iter `(init, matchGroup) -> init`, default is `_.iteratee`.
     * @param  {Any} init
     * @return {Any}
     * @example
     * ```js
     * let out = kit.regexReduce(/\w(\d+)/g, 'a1, b10, c3', (ret, ms) => {
     *  ret.push(ms[1]);
     *  return ret;
     * }, []);
     *
     * kit.log(out); // => [1, 10, 3]
     * ```
     */
    regexReduce(reg, str, iter, init) {
        iter = _.iteratee(iter);
        let ms = null;
        if (reg.global) {
            while ((ms = reg.exec(str)) !== null) {
                init = iter(init, ms);
            }
        } else {
            return iter(init, reg.exec(str));
        }

        return init;
    },

    /**
     * Map a string via a regex.
     * @param  {RegExp} reg
     * @param  {String} str
     * @param  {Function} iter `(matchGroup) ->`, default is `_.iteratee`.
     * @return {Array}
     * @example
     * ```js
     * let out = kit.regexMap(/\w(\d+)/g, 'a1, b10, c3', 1);
     *
     * kit.log(out) // => [1, 10, 3]
     * ```
     */
    regexMap(reg, str, iter) {
        iter = _.iteratee(iter);
        let ms = null;
        const init = [];
        if (reg.global) {
            while ((ms = reg.exec(str)) !== null) {
                init.push(iter(ms));
            }
        } else {
            return iter.push(reg.exec(str));
        }

        return init;
    },

    /**
     * An async string replace function.
     * @param  {String} str     The string to replace
     * @param  {String | Regex} pattern
     * @param  {Function} iter It can return a promise
     * @return {Promise}
     */
    replace(str, pattern, iter) {
        const promises = [];

        if (iter == null) {
            iter = (p, m) => m;
        }

        str.replace(pattern, function () {
            const offset = arguments[arguments.length - 2];
            const start = offset + arguments[0].length;

            promises.push(
                Promise.resolve(iter.apply(null, arguments))
                .then(res => [offset, start, res])
            );

        });

        return Promise.all(promises).then(function (list) {
            let out = '';
            let start = 0;
            let end = 0;

            for (let item of Array.from(list)) {
                end = item[0];
                out += str.slice(start, end) + item[2];
                start = item[1];
            }

            out += str.slice(start);
            return out;
        });
    },

    /**
     * An async string replace function, each replacement process will run in line.
     * @param  {String} str     The string to replace
     * @param  {String | Regex} pattern
     * @param  {Function} iter It can return a promise
     * @return {Promise}
     */
    replaceSync(str, pattern, iter) {
        let out = '';
        let promise = Promise.resolve();
        let start = 0;
        let end = 0;

        if (iter == null) {
            iter = (p, m) => m;
        }

        str.replace(pattern, function () {
            const arr = _.toArray(arguments);
            const offset = arr[arr.length - 2];

            promise = promise.then(() => iter.apply(null, arr)).then(function (res) {
                end = offset;
                out += str.slice(start, end) + res;
                start = offset + arr[0].length;
            });

        });

        return promise.then(function () {
            out += str.slice(start);
            return out;
        });
    },

    /**
     * Much faster than the native require of node, but you should
     * follow some rules to use it safely.
     * Use it to load nokit's internal module.
     * @param {String} moduleName The module path or name.
     * @param {String} dir Current absolute file path. Not optional, expect when
     * requiring nokit's internal modules.
     * On most times, just pass `__dirname` to it is enough.
     * @param {Function} loaded Run only the first time after the module loaded.
     * @return {Module} The module that you require.
     * @example
     * Use it to load nokit's internal module.
     * ```js
     * kit.require('jhash');
     * // Then you can use the module, or it will be null.
     * kit.jhash.hash('test');
     * ```
     * To load a relative path, or you own module,
     * the second parameter 'dir' is required.
     * ```js
     * let mod = kit.require('./mod', __dirname);
     *
     * // Or load your own 'jhash', rather than nokit's.
     * let jhash = kit.require('jhash', __dirname);
     * ```
     */
    require(moduleName, dir, loaded) {
        let e, modPath;
        if (_.isFunction(dir)) {
            loaded = dir;
            dir = null;
        }

        const key = moduleName + (dir ? `@${dir}` : '');

        if (kit.requireCache[key]) {
            return kit.requireCache[key];
        }

        if ((dir == null)) {
            if ((moduleName[0] === '.') || (kit[moduleName] !== null)) {
                const err = new Error(
                    "[kit.require] argument 'dir' is not defined: " +
                    moduleName
                );
                err.source = 'nokit';
                throw err;
            }

            try {
                modPath = require.resolve(`./${moduleName}`);
            } catch (error) {
                e = error;
                if (e.code !== 'MODULE_NOT_FOUND') {
                    throw e;
                }
            }

            if (modPath) {
                return kit[moduleName] =
                    (kit.requireCache[key] =
                        require(modPath));
            }

            return kit[moduleName] =
                (kit.requireCache[key] =
                    require(moduleName));
        }

        const names = moduleName[0] === '.' ? [kit.path.join(dir, moduleName)] :
            kit.genModulePaths(moduleName, dir)
            .concat(process.env.NODE_PATH ?
                Array.from(process.env.NODE_PATH.split(kit.path.delimiter)).map((p) =>
                    kit.path.join(p, moduleName)) :
                []);


        for (let name of Array.from(names)) {
            try {
                modPath = require.resolve(name);
            } catch (error1) {
                e = error1;
                if (e.code === 'MODULE_NOT_FOUND') {
                    modPath = null;
                } else {
                    throw e;
                }
            }

            if (modPath) {
                kit.requireCache[key] = require(modPath);
                if (typeof loaded === 'function') {
                    loaded(kit.requireCache[key]);
                }
                break;
            }
        }

        if (!kit.requireCache[key]) {
            e = new Error(`Module not found: ${moduleName}`);
            e.code = 'MODULE_NOT_FOUND';
            throw e;
        }

        if (kit[moduleName] === null) {
            kit[moduleName] = kit.requireCache[key];
        }

        return kit.requireCache[key];
    },

    /**
     * Require an optional package. If not found, it will
     * warn the user to npm install it, and exit the process.
     * When `kit.requireOptional.autoInstall` is set to `true`, the package will
     * be auto installed if it's missed.
     * @param {String} name Package name
     * @param {String} dir Current absolute file path. Not optional.
     * On most times, just pass `__dirname` to it is enough.
     * @param  {String} semver Specify what version you need,
     * such as `^0.3.1` or `>=1.2.3`, ect.
     * @return {Any} The required package.
     */
    requireOptional(name, dir, semver) {
        const key = semver ? name + '@' + semver : name;
        if (kit.requireCache[key]) {
            return kit.requireCache[key];
        }

        try {
            if (semver) {
                kit.require('semver');
                const {
                    version
                } = kit.require(name + '/package.json', dir);
                if (!kit.semver.satisfies(version, semver)) {
                    const info = `expect ${name} version ` +
                        `'${semver}', but get '${version}'`;
                    name = `${name}@"${semver}"`;
                    throw new Error(info);
                }
            }

            return kit.require(name, dir);
        } catch (err) {
            const br = kit.require('brush');

            if (kit.requireOptional.autoInstall) {
                const {
                    spawnSync
                } = kit.require('child_process', __dirname);
                const whichSync = kit.require('whichSync');
                spawnSync(whichSync('npm'), ['i', key], {
                    cwd: dir,
                    stdio: 'inherit'
                });
                try {
                    return kit.require(name, dir);
                } catch (err) {
                    if (err && err.code === 'MODULE_NOT_FOUND') {
                        kit.errs(br.red('Optional module installed, please rerun the program.'), err.stack)
                        process.exit(1)
                    } else {
                        throw err
                    }
                }
            }

            if (err.source === 'nokit') {
                throw err;
            }

            kit.err(
                (br.red("Optional module required. Please " +
                    br.green(`'npm install -S ${name}'` + br.red(" first.\n")))) +
                err.stack, {
                    isShowTime: false
                });
            return process.exit(1);
        }
    },

    /**
     * A handy extended combination of `http.request` and `https.request`.
     * @param  {Object} opts The same as the [http.request](http://nodejs.org/api/http.html#httpHttpRequestOptionsCallback),
     * but with some extra options:
     * ```js
     * {
     *  // String or Url Object.
     *  url: String | Object,
     *
     *  // Other than return `res` with `res.body`,return `body` directly.
     *  body: true,
     *
     *  // Max times of auto redirect. If 0, no auto redirect.
     *  redirect: 0,
     *
     *  // Timeout of the socket of the http connection.
     *  // If timeout happens, the promise will reject.
     *  // Zero means no timeout.
     *  timeout: 0,
     *
     *  // The key of headers should be lowercased.
     *  headers: {},
     *
     *  protocol: 'http:' or 'https:',
     *
     *  agent: null,
     *
     *  // Auto set "transfer-encoding" header to 'chunked' if the `reqData` is
     *  // stream and the 'Content-Length' header is not set.
     *  autoTE: true,
     *
     *  // Set null to use buffer, optional.
     *  // It supports GBK, ShiftJIS etc.
     *  // For more info, see https://github.com/ashtuchkin/iconv-lite
     *  resEncoding: 'auto',
     *
     *  // Whether to unzip gzip / deflate.
     *  autoUnzip: true,
     *
     *  // It's string, object, stream or buffer, it's optional. When it's an object,
     *  // The request will be 'application/x-www-form-urlencoded'.
     *  reqData: null,
     *
     *  // auto end the request.
     *  autoEndReq: true,
     *
     *  // Writable stream.
     *  resPipe: null,
     *
     *  // Handle resPipe before it's piped.
     *  // Its returned value will be assigned to `opts.resPipe`. So you can return
     *  // null to make the request resolve the `body`.
     *  handleResPipe: (res, resPipe) => resPipe,
     *
     *  /// The progress of the request.
     *  reqProgress: (complete, total) => {},
     *
     *  // The progress of the response.
     *  resProgress: (complete, total) => {},
     *
     *  resPipeError: (res) => res.end()
     * }
     * ```
     * And if set opts as string, it will be treated as the url.
     * @return {Promise} Contains the http response object,
     * it has an extra `body` property.
     * You can also get the request object by using `Promise.req`.
     * @example
     * ```js
     * let p = kit.request('http://test.com');
     * p.req.on('response', (res) =>
     *  kit.log res.headers['content-length']
     * );
     * p.then((body) =>
     *  kit.log(body); // html or buffer
     * );
     *
     * kit.request({
     *  url: {
     *      protocol: 'https', hostname: 'test.com',
     *      port: 8123, path: '/a.mp3?s=1'
     *  },
     *  body: false,
     *  resProgress: (complete, total) =>
     *      kit.log(`Progress: ${complete} / ${total}`)
     * })
     * .then((res) => {
     *  kit.log(res.body.length);
     *  kit.log(res.headers);
     * });
     *
     * // Send form-data.
     * let form = new require('form-data');
     * form.append('image', new Buffer(0), {
     *  filename: 'a.jpg', contentType: 'image/jpg'
     * });
     * form.append('key', 'value');
     * kit.request({
     *  url: 'a.com',
     *  method: 'POST',
     *  headers: form.getHeaders(),
     *
     *  reqData: form
     * })
     * .then((body) =>
     *  kit.log(body)
     * );
     * ```
     */
    request(opts) {
        let reqBuf;
        if (_.isString(opts)) {
            opts = {
                url: opts
            };
        }

        let url = opts.url || {};
        if (_.isObject(url)) {
            let hostSepIndex;
            if (url.protocol == null) {
                url.protocol = 'http:';
            }
            if (url.host && ((hostSepIndex = url.host.indexOf(':')) > -1)) {
                url.hostname = url.host.slice(0, hostSepIndex);
                url.port = url.host.slice(hostSepIndex + 1);
            }
        } else {
            if (url.indexOf('http') !== 0) {
                url = `http://${url}`;
            }
            url = nodeUrl.parse(url);
            if (url.protocol == null) {
                url.protocol = 'http:';
            }
            delete url.host;
        }

        _.defaults(opts, url);

        let request = null;
        switch (opts.protocol) {
            case 'http:':
                ({
                    request
                } = kit.require('http', __dirname));
                break;
            case 'https:':
                ({
                    request
                } = kit.require('https', __dirname));
                break;
            default:
                Promise.reject(new Error(`Protocol not supported: ${opts.protocol}`));
        }

        _.defaults(opts, {
            body: true,
            resEncoding: 'auto',
            reqData: null,
            autoEndReq: true,
            autoUnzip: true,
            reqProgress: null,
            resProgress: null,
            autoTE: true
        });

        if (opts.headers == null) {
            opts.headers = {};
        }
        if (Buffer.isBuffer(opts.reqData)) {
            reqBuf = opts.reqData;
        } else if (_.isString(opts.reqData)) {
            reqBuf = new Buffer(opts.reqData);
        } else if (_.isObject(opts.reqData)) {
            if (opts.reqData && _.isFunction(opts.reqData.pipe)) {
                opts.reqPipe = opts.reqData;
            } else {
                if (opts.headers['content-type'] == null) {
                    opts.headers['content-type'] =
                        'application/x-www-form-urlencoded; charset=utf-8';
                }
                reqBuf = new Buffer(
                    _.map(opts.reqData, (v, k) => [encodeURIComponent(k), encodeURIComponent(v)].join('=')).join('&')
                );
            }
        } else {
            reqBuf = undefined;
        }

        if (reqBuf !== undefined) {
            if (opts.headers['content-length'] == null) {
                opts.headers['content-length'] = reqBuf.length;
            }
        }

        if (opts.autoTE && (!('content-length' in opts.headers)) &&
            (!('Content-Length' in opts.headers)) && opts.reqPipe) {
            opts.headers['transfer-encoding'] = 'chunked';
        }

        let req = null;
        const promise = new Promise(function (resolve, reject) {
            let resPipeError;
            req = request(opts, function (res) {
                let unzip;
                let resStream = res;

                if ((opts.redirect > 0) && res.headers.location) {
                    opts.redirect--;
                    url = nodeUrl.resolve(
                        nodeUrl.format(opts),
                        res.headers.location
                    );
                    kit.request(_.extend(opts, nodeUrl.parse(url)))
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                if (opts.resProgress) {
                    (function () {
                        const total = +res.headers['content-length'];
                        let complete = 0;
                        return resStream.on('data', function (chunk) {
                            complete += chunk.length;
                            return opts.resProgress(complete, total);
                        });
                    })();
                }

                if (_.isFunction(opts.handleResPipe)) {
                    opts.resPipe = opts.handleResPipe(res, opts.resPipe);
                }

                if (opts.autoUnzip) {
                    unzip = (() => {
                        switch (res.headers['content-encoding']) {
                            case 'gzip':
                                return unzip = kit.require('zlib', __dirname).createGunzip();
                            case 'deflate':
                                return unzip = kit.require('zlib', __dirname).createInflateRaw();
                        }
                    })();

                    if (unzip) {
                        let isEmptyZipPipe = true;
                        resStream = res.pipe(unzip);
                        unzip.on('data', () => isEmptyZipPipe = false);
                        unzip.on('error', function (err) {
                            // Empty pipe to gzip
                            if (isEmptyZipPipe) {
                                return resolver(buf);
                            } else {
                                return reject(err);
                            }
                        });
                    }
                }

                if (resPipeError) {
                    resStream.on('error', resPipeError);
                }

                if (opts.resPipe) {
                    resStream.pipe(opts.resPipe);

                    opts.resPipe.on('error', resPipeError);
                    return resStream.on('end', () => resolve(res));
                } else {
                    var buf = new Buffer(0);

                    resStream.on('data', chunk => buf = Buffer.concat([buf, chunk]));

                    var resolver = function (body) {
                        if (opts.body) {
                            return resolve(body);
                        } else {
                            res.body = body;
                            return resolve(res);
                        }
                    };

                    resStream.on('error', reject);

                    return resStream.on('end', function () {
                        if (opts.resEncoding) {
                            let encoding;
                            if (opts.resEncoding === 'auto') {
                                encoding = null;
                                const cType = res.headers['content-type'];
                                if (/text|javascript|css|json|xml/.test(cType)) {
                                    encoding = 'utf8';
                                }

                                if (!opts.autoUnzip && /gzip|deflate/.test(res.headers['content-encoding'])) {
                                    encoding = null;
                                }
                            } else {
                                encoding = opts.resEncoding;
                            }

                            const decode = function (buf) {
                                if (!encoding || !buf) {
                                    return buf;
                                }
                                try {
                                    if (encoding === 'utf8') {
                                        return buf.toString();
                                    } else {
                                        return kit.requireOptional('iconv-lite', __dirname)
                                            .decode(buf, encoding);
                                    }
                                } catch (err) {
                                    return reject(err);
                                }
                            };

                            return resolver(decode(buf));
                        } else {
                            return resolver(buf);
                        }
                    });
                }
            });

            if (opts.resPipe) {
                resPipeError = function (err) {
                    if (opts.resPipeError) {
                        opts.resPipeError(opts.resPipe);
                    } else {
                        opts.resPipe.end();
                    }
                    return reject(err);
                };
            }

            req.on('error', function (err) {
                if (opts.resPipe) {
                    resPipeError(err);
                }
                return reject(err);
            });

            if (opts.timeout > 0) {
                req.setTimeout(opts.timeout, () => req.emit('error', new Error('timeout')));
            }

            if (opts.reqPipe) {
                if (opts.reqProgress) {
                    (function () {
                        const total = +opts.headers['content-length'];
                        let complete = 0;
                        return opts.reqPipe.on('data', function (chunk) {
                            complete += chunk.length;
                            return opts.reqProgress(complete, total);
                        });
                    })();
                }

                return opts.reqPipe.pipe(req);
            } else {
                if (opts.autoEndReq) {
                    return req.end(reqBuf);
                }
            }
        });

        promise.req = req;
        return promise;
    },

    /**
     * The semantic versioner for npm, known as [semver](https://github.com/npm/node-semver).
     * You must `kit.require 'semver'` before using it.
     * @type {Object}
     */
    semver: null,

    /**
     * A safer version of `child_process.spawn` to cross-platform run
     * a process. In some conditions, it may be more convenient
     * to use the `kit.exec`.
     * It will automatically add `node_modules/.bin` to the `PATH`
     * environment variable.
     * @param  {String} cmd Path or name of an executable program.
     * @param  {Array} args CLI arguments. If any of the item is an object,
     * it will be converted to string by `JSON.stringify`.
     * @param  {Object} opts Process options.
     * Almost the same with the Node.js official documentation.
     * It will inherit the parent's stdio by default.
     * An extra `prefix` option, if it's enabled, all stdout and stderr
     * will be prefix with the specified string, you can also specify the
     * color like `web:red`, `web:blue`, if no color found, a random color
     * will be used.
     * @return {Promise} The `promise.process` is the spawned child
     * process object.
     * **Resolves** when the process's stdio is drained and the exit
     * code is either `0` or `130`. The resolve value
     * is like:
     * ```js
     * {
     *  code: 0,
     *  signal: null
     * }
     * ```
     * @example
     * ```js
     * kit.spawn('git', ['commit', '-m', '42 is the answer to everything'])
     * .then(({code}) => kit.log code);
     * ```
     */
    spawn(cmd, args, opts) {
        let prefix;
        if (args == null) {
            args = [];
        }
        if (opts == null) {
            opts = {};
        }
        let PATH = (opts.env && opts.env.PATH) ?
            opts.env.PATH :
            process.env.PATH || process.env.Path;

        [
            kit.path.normalize(__dirname + '/../node_modules/.bin'),
            kit.path.normalize(process.cwd() + '/node_modules/.bin')
        ].forEach(function (path) {
            if ((PATH.indexOf(path) < 0) && kit.fs.existsSync(path)) {
                return PATH = [path, PATH].join(kit.path.delimiter);
            }
        });

        _.defaultsDeep(opts, {
            stdio: 'inherit',
            env: process.env
        });

        opts.env.PATH = PATH;

        if (process.platform === 'win32') {
            kit.require('whichSync');
            cmd = kit.whichSync(cmd);
            if (cmd.slice(-3).toLowerCase() === 'cmd') {
                const cmdSrc = kit.fs.readFileSync(cmd, 'utf8');
                const m = cmdSrc.match(/node\s+"%~dp0\\(\.\.\\.+)"/);
                if (m && m[1]) {
                    cmd = kit.path.join(cmd, '..', m[1]);
                    cmd = kit.path.normalize(cmd);
                    args = [cmd].concat(args);
                    cmd = 'node';
                }
            }
        }

        const {
            spawn
        } = kit.require('child_process', __dirname);

        let ps = null;

        for (let k in args) {
            const v = args[k];
            if (_.isObject(v)) {
                args[k] = JSON.stringify(v);
            }
        }

        if (opts.prefix) {
            let color;
            const br = kit.require('brush');
            [prefix, color] = Array.from(opts.prefix.split(':'));
            if (color) {
                prefix = br[color](prefix);
            } else {
                prefix = br.random(prefix);
            }
            prefix += '$&';
            opts.stdio = [process.stdin, 'pipe', 'pipe'];
        }

        const promise = new Promise(function (resolve, reject) {
            try {
                ps = spawn(cmd, args, opts);
            } catch (error) {
                const err = error;
                reject(err);
            }

            if (opts.prefix) {
                const prefixReg = /.*\n/g;
                ps.stdout.on('data', d =>
                    process.stdout.write(
                        (d + '').replace(prefixReg, prefix)
                    )
                );
                ps.stderr.on('data', d =>
                    process.stderr.write(
                        (d + '').replace(prefixReg, prefix)
                    )
                );
            }

            ps.on('error', err => reject(err));

            return ps.on('close', function (code, signal) {
                if ((code === null) || (code === 0) || (code === 130)) {
                    return resolve({
                        code,
                        signal
                    });
                } else {
                    return reject({
                        code,
                        signal
                    });
                }
            });
        });

        promise.process = ps;
        return promise;
    },

    /**
     * The `sse` module.
     * You must `kit.require 'sse'` before using it.
     * For more information goto the `sse` section.
     */
    sse: null,

    /**
     * Sequencing and executing tasks and dependencies concurrently.
     * @param  {String}   name The task name.
     * @param  {Object}   opts Optional. Defaults:
     * ```js
     * {
     *  deps: String | Array,
     *  description: String,
     *  logStart: () => (),
     *  logEnd: () => (),
     *
     *  // Whether to run dependency in a row.
     *  isSequential: false
     * }
     * ```
     * @param  {Function} fn `(val) -> Promise | Any` The task function.
     * If it is a async task, it should return a promise.
     * It will get its dependency tasks' resolved values.
     * @property {Function} run Use it to start tasks. Each task will only run once.
     * `(names = 'default', opts) ->`. The `names` can be a string or array.
     * The default opts:
     * ```js
     * {
     *  isSequential: false,
     *
     *  // Will be passed as the first task's argument.
     *  init: undefined,
     *
     *  // To stop the run currently in process. Set the `$stop`
     *  // reference to true. It will reject a "runStopped" error.
     *  warp: { $stop: false }
     * }
     * ```
     * @property {Object} list The defined task functions.
     * @return {Promise} Resolve with the last task's resolved value.
     * When `isSequential == true`, it resolves a value, else it resolves
     * an array.
     * @example
     * ```js
     * kit.task('default', { deps: 'build' }, () =>
     *  kit.log('run defaults...')
     * );
     *
     * kit.task('build', { deps: ['clean'] }, (isFull) =>
     *  isFull ? 'do something' : 'do something else'
     * );
     *
     * kit.task('clean', (opts) =>
     *  opts.isForce ?
     *      kit.remove('dist/**', { isForce: true }) :
     *      kit.remove('dist/**')
     * );
     *
     * kit.task.run()
     * .then(() =>
     *  kit.log('All Done!')
     * );
     * ```
     */
    task(name, opts, fn) {
        const br = kit.require('brush');
        if (_.isFunction(opts)) {
            fn = opts;
            opts = {};
        }

        _.defaults(opts, {
            isSequential: false,
            description: '',
            logStart() {
                return kit.log(br.cyan('Task Start >> ') +
                    br.green(`[${name}] `) + this.description
                );
            },
            logEnd() {
                return kit.log(br.cyan('Task Done >> ') +
                    br.green(`[${name}] `) + this.description
                );
            }
        });

        if (_.isString(opts.deps)) {
            opts.deps = [opts.deps];
        }

        if (kit.task.list == null) {
            kit.task.list = {};
        }

        // Here we use some curry functions to deal with the race condition.
        const runTask = warp => name => function (val) {
            if (warp[name]) {
                return warp[name];
            } else {
                if (!kit.task.list[name]) {
                    return Promise.reject(new Error(`task not found: ${name}`));
                }
                return warp[name] = kit.task.list[name](warp)(val);
            }
        };

        kit.task.list[name] = warp => function (val) {
            if (warp.$stop) {
                return Promise.reject(new Error('runStopped'));
            }

            opts.logStart();

            const p = ((() => {
                if (!opts.deps || (opts.deps.length < 1)) {
                    return Promise.resolve(val);
                } else {
                    const depTasks = opts.deps.map(runTask(warp));

                    if (opts.isSequential) {
                        return kit.flow(depTasks)(val);
                    } else {
                        return Promise.all(depTasks.map(task => task(val)));
                    }
                }

            })()).then(fn);
            p.then(opts.logEnd.bind(opts));
            return p;
        };

        kit.task.list[name].opts = opts;

        return kit.task.run != null ? kit.task.run : (kit.task.run = function (names, opts) {
            if (names == null) {
                names = 'default';
            }
            if (opts == null) {
                opts = {};
            }
            if (_.isString(names)) {
                names = [names];
            }

            _.defaults(opts, {
                isSequential: false,
                init: undefined,
                warp: {
                    $stop: false
                }
            });

            const task = runTask(opts.warp);

            if (opts.isSequential) {
                return kit.flow(names.map(task))(opts.init);
            } else {
                return Promise.all(names.map(name => task(name)(opts.init)));
            }
        });
    },

    /**
     * Cross-platform kill process tree by root process id.
     * @param  {Number} pid
     * @param  {String | Number} signal Such as 'SIGINT'
     * @param  {Function} callback
     */
    treeKill: null,

    /**
     * The `url` module of node.
     * You must `kit.require 'url'` before using it.
     */
    url: null,

    /**
     * Works much like `gulp.src`, but with Promise instead.
     * The warp control and error handling is more pleasant.
     * @param  {String} from Glob pattern string.
     * @param  {Object} opts It extends the options of `nofs.glob`, but
     * with some extra proptereis. Defaults:
     * ```js
     * {
     *  // The base directory of the pattern.
     *  baseDir: String
     * }
     * ```
     * @return {Object} The returned warp object has these members:
     * ```js
     * {
     *  // The drive can also be a promise that will resolve a drive.
     *  load: (drive) => fileInfo | null,
     *
     *  run: (path) => Promise
     * }
     * ```
     * Each piped drive will recieve a
     * object that extends `nofs`'s fileInfo object:
     * ```js
     * {
     *  // Set the contents and return self.
     *  set: (String | Buffer) => fileInfo,
     *
     *  // The src file path.
     *  path: String,
     *
     *  // The dest root path.
     *  to: String,
     *
     *  baseDir: String,
     *
     *  // The destination path.
     *  // Alter it if you want to change the output file's location.
     *  // You can set it to string, warp will auto-convert it to object.
     *  // It's "valueOf" will return "kit.path.join dir, name + ext".
     *  dest: { root, dir, base, ext, name },
     *
     *  // The file content.
     *  contents: String | Buffer,
     *
     *  isDir: Boolean,
     *
     *  stats: fs.Stats,
     *
     *  // Alter it to control the left drives dynamically.
     *  drives: [Function],
     *
     *  // All the globbed files.
     *  list: Array,
     *
     *  driveList: Array,
     *
     *  // The opts you passed to "kit.warp", it will be extended.
     *  opts: Object
     * }
     * ```
     *
     * Each drive can have a `onEnd: (fileInfo) -> Any | Promise` function,
     * which will be called after a file's whole warp is ended.
     *
     * The drive can have a `isReader` property, which will make the drive
     * override the default file reader.
     *
     * The drive can have a `isWriter` property, which will make the drive
     * override the default file writer.
     *
     * If a drive overrides another, it can call `fileInfo.super()` to use it again.
     * @example
     * ```js
     * // Define a simple workflow.
     * kit.warp('src/**\/*.js')
     * .load((fileInfo) =>
     *     fileInfo.set('/* Lisence Info *\/' + fileInfo.contents)
     * )
     * .load(jslint())
     * .load(minify())
     * .run('build/minified');
     *
     * // Override warp's file reader with a custom one.
     * let myReader = kit._.extend((f) =>
     *     kit.readFile(f.path, 'hex').then(f.path)
     * ), {
     *  // This will tell warp you want use your own reader.
     *  isReader: true
     * });
     *
     * // Override writer.
     * let myWriter = kit._.extend((f) => {
     *  if (f.dest === 'a.js') return;
     *
     *  // Call the overrided writer.
     *  f.super();
     * }, { isWriter: true, onEnd: () => {
     *    super();
     *    kit.log(this.list);
     * });
     *
     * kit.warp('src/**\/*.js')
     * .load(myWriter)
     * .run('dist');
     *
     * // Use nokit's built-in warp drives.
     * let drives = kit.require('drives');
     * kit.warp('src/**\/*.coffee')
     * .load(drives.coffee());
     * .run('dist');
     * ```
     */
    warp(from, opts) {
        let warpper;
        if (opts == null) {
            opts = {};
        }
        const drives = kit.require('drives');
        const driveList = [];
        let reader = drives.reader();
        let writer = drives.writer();

        var runDrive = drive => function (info) {
            const run = function (drive) {
                if (_.isString(info.dest)) {
                    info.dest = _.extend(kit.path.parse(info.dest), {
                        valueOf() {
                            return kit.path.join(this.dir, this.name + this.ext);
                        }
                    });
                }
                if (drive.super) {
                    info.super = () => runDrive(drive.super)(info);
                }

                return Promise.resolve(drive.call(info, info))
                    .then(() => info);
            };

            if (_.isFunction(drive.then)) {
                return drive.then(run);
            } else {
                return run(drive);
            }
        };

        const initInfo = function (info) {
            if (opts.baseDir) {
                info.baseDir = opts.baseDir;
            }
            if (info.path != null) {
                info.dest = kit.path.join(info.to,
                    kit.path.relative(info.baseDir, info.path));
            }

            return _.extend(info, {
                driveList,
                opts,
                set(contents) {
                    return info.contents = contents;
                }
            });
        };

        return warpper = {
            load(drive) {
                if (drive.isReader || drive.isWriter) {
                    if (drive.isWriter) {
                        drive.super = writer;
                        drive.onEnd.super = writer.onEnd;
                        writer = drive;
                    }
                    if (drive.isReader) {
                        drive.super = reader;
                        reader = drive;
                    }
                } else {
                    driveList.push(drive);
                }
                return warpper;
            },

            run(to) {
                if (to == null) {
                    to = '.';
                }
                driveList.unshift(reader);
                driveList.push(writer);

                const globOpts = _.extend({}, opts, {
                    iter(info, list) {
                        list.push(info);
                        if (opts.baseDir) {
                            info.baseDir = opts.baseDir;
                        }
                        _.extend(info, {
                            drives: _.clone(driveList),
                            to,
                            list
                        });

                        return kit.flow({
                            next() {
                                const drive = info.drives.shift();
                                return {
                                    value: drive && runDrive(drive),
                                    done: !drive
                                };
                            }
                        })(initInfo(info));
                    }
                });

                return kit.glob(from, globOpts)
                    .then(list =>
                        Promise.all(driveList.map(function (drive) {
                            if (!drive.onEnd) {
                                return;
                            }
                            return runDrive(drive.onEnd)(initInfo({
                                to,
                                list
                            }));
                        })));
            }
        };
    },

    /**
     * Same as the unix `which` command.
     * You must `kit.require 'which'` before using it.
     * @param {String} name The command.
     * @return {Promise}
     */
    which: null,

    /**
     * Sync version of `which`.
     * You must `kit.require 'whichSync'` before using it.
     * @type {Function}
     */
    whichSync: null,

    /**
     * For debugging. Dump a colorful object.
     * @param  {Object} obj Your target object.
     * @param  {Object} opts Options. Default:
     * ```js
     * { colors: true, depth: 7 }
     * ```
     * @return {String}
     */
    xinspect(obj, opts) {
        if (opts == null) {
            opts = {};
        }
        const util = kit.require('util', __dirname);

        _.defaults(opts, {
            colors: kit.isDevelopment(),
            depth: 7
        });

        return util.inspect(obj, opts);
    },

    /**
     * Open a thing that your system can recognize.
     * Now only support Windows, OSX or system that installed 'xdg-open'.
     * @param  {String | Array} cmds  The thing you want to open.
     * @param  {Object} opts The options of the node native
     * `child_process.exec`.
     * @return {Promise} When the child process exists.
     * @example
     * Open a webpage with the default browser.
     * ```js
     * kit.open('http://ysmood.org');
     * ```
     */
    xopen(cmds, opts) {
        if (opts == null) {
            opts = {};
        }
        const child_process = kit.require('child_process', __dirname);

        if (_.isString(cmds)) {
            cmds = [cmds];
        }

        return (Promise.resolve((() => {
            switch (process.platform) {
                case 'darwin':
                    return 'open';
                case 'win32':
                    child_process.exec(`start ${cmds.join(' ')}`);
                    return null;
                default:
                    try {
                        kit.require('whichSync');
                        return kit.whichSync('xdg-open');
                    } catch (error) {
                        return null;
                    }

            }
        })())).then(function (starter) {
            if (!starter) {
                return;
            }

            return kit.spawn(starter, cmds);
        });
    }
});

module.exports = kit;