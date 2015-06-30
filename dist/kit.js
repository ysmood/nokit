'use strict';
var Overview, Promise, _, fs, kit,
  slice = [].slice,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

_ = require('./lodash');

fs = require('nofs');

Promise = fs.Promise;

kit = {};


/**
 * Nokit extends all the functions of [nofs](https://github.com/ysmood/nofs)
 * and [`yaku/lib/utils`](https://github.com/ysmood/yaku#utils).
 * You can use it as same as nofs. For more info, see the doc:
 *
 * [Offline Documentation](?gotoDoc=nofs/readme.md)
 * @example
 * ```coffee
 * kit.readFile('test.txt', 'utf8').then (str) ->
 * 	console.log str
 *
 * kit.outputFile 'a.txt', 'test'
 * .then -> kit.log 'done'
 *
 * kit.writeJSON 'b.json', { a: 10 }
 * .then -> kit.log 'done'
 *
 * kit.mkdirs 'b.json', { a: 10 }
 * .then -> kit.log 'done'
 * ```
 */

Overview = 'overview';

_.extend(kit, fs, fs.PromiseUtils, {

  /**
  	 * The [lodash](https://lodash.com) lib.
  	 * @type {Object}
  	 * @example
  	 * ```coffee
  	 * kit._.map [1, 2, 3]
  	 * ```
   */
  _: _,
  requireCache: {},

  /**
  	 * The browser helper.
  	 * @static
  	 * @param {Object} opts The options of the client, defaults:
  	 * ```coffee
  	 * {
  	 * 	autoReload: kit.isDevelopment()
  	 * 	host: '' # The host of the event source.
  	 * }
  	 * ```
  	 * @param {Boolean} useJs By default use html. Default is false.
  	 * @return {String} The code of client helper.
  	 * @example
  	 * When the client code is loaded on the browser, you can use
  	 * the `nb.log` to log anything to server's terminal.
  	 * The server will auto-format and log the information to the terminal.
  	 * It's convinient for mobile development when remote debug is not possible.
  	 * ```coffee
  	 * # The nb is assigned to the "window" object.
  	 * nb.log { a: 10 }
  	 * nb.log 10
  	 * ```
   */
  browserHelper: function(opts, useJs) {
    var helper, js, optsStr;
    if (opts == null) {
      opts = {};
    }
    if (useJs == null) {
      useJs = false;
    }
    helper = kit.browserHelper.cache || kit.require('./browserHelper', __dirname).toString();
    optsStr = JSON.stringify(_.defaults(opts, {
      autoReload: kit.isDevelopment(),
      host: ''
    }));
    js = "window.nokit = (" + helper + ")(" + optsStr + ");\n";
    if (useJs) {
      return js;
    } else {
      return "\n\n<!-- Nokit Browser Helper -->\n<script type=\"text/javascript\">\n" + js + "\n</script>\n\n";
    }
  },

  /**
  	 * The [colors](https://github.com/Marak/colors.js) lib
  	 * makes it easier to print colorful info in CLI.
  	 * You must `kit.require 'colors'` before using it.
  	 * Sometimes use `kit.require 'colors/safe'` will be better.
  	 * @type {Object}
  	 * @example
  	 * ```coffee
  	 * cs = kit.require 'colors/safe'
  	 * kit.log cs.red 'error info'
  	 * ```
   */
  colors: null,
  'colors/safe': null,

  /**
  	 * A fast file cache helper. It uses hard link to cache files.
  	 * @param  {Object} info Not optional.
  	 * ```coffee
  	 * {
  	 * 	# The first item is the key path, others are
  	 * 	# its dependencies.
  	 * 	deps: Array
  	 *
  	 * 	# The path of the output file.
  	 * 	# If it's undefined, depsCache will try to get cache.
  	 * 	dests: Array
  	 *
  	 * 	cacheDir: '.nokit'
  	 * }
  	 * ```
  	 * @return {Promise} Resolve a info object.
  	 * ```coffee
  	 * {
  	 * 	isNewer: Boolean
  	 *
  	 * 	# { path: mtime }
  	 * 	deps: Object
  	 *
  	 * 	# { destPath: cachePath }
  	 * 	dests: Object
  	 *
  	 * 	cacheError: undefined | Error
  	 * }
  	 * ```
  	 * @example
  	 * ```coffee
  	 * # Set cache
  	 * kit.depsCache {
  	 * 	dests: ['index.css']
  	 * 	deps: ['index.less', 'b.less', 'c.less']
  	 * }
  	 *
  	 * # Get cache
  	 * # You don't have to sepecify 'b.less', 'c.less'.
  	 * kit.depsCache { deps: ['index.less'] }
  	 * .then (cache) ->
  	 * 	if cache.isNewer
  	 * 		kit.log 'cache is newer'.
  	 * 		kit.log cache.dests
  	 * ```
   */
  depsCache: function(opts) {
    var base, hashPath, info, key, saveContents, saveInfo, saveLink;
    _.defaults(opts, {
      cacheDir: '.nokit'
    });
    if ((base = kit.depsCache).jhash == null) {
      base.jhash = new (kit.require('jhash').constructor);
    }
    hashPath = function(path) {
      var hash;
      hash = kit.depsCache.jhash.hash(path, true) + '-' + kit.path.basename(path);
      path = kit.path.join(opts.cacheDir, hash);
      return {
        cache: path,
        info: path + '.json'
      };
    };
    key = hashPath(opts.deps[0]);
    if (opts.dests) {
      info = {
        dests: {},
        deps: {}
      };
      saveLink = function(from, to) {
        return kit.mkdirs(opts.cacheDir).then(function() {
          return kit.link(from, to)["catch"](function(err) {
            if (err.code !== 'EEXIST') {
              return Promise.reject(err);
            }
            return kit.unlink(to).then(function() {
              return kit.link(from, to);
            });
          });
        });
      };
      saveInfo = function(infoPath) {
        return Promise.all(opts.deps.map(function(path, i) {
          if (i === 0) {
            return info.deps[path] = Date.now();
          }
          return kit.stat(path)["catch"](function() {}).then(function(stats) {
            if (!stats) {
              return;
            }
            return info.deps[path] = stats.mtime.getTime();
          });
        })).then(function() {
          return kit.outputJson(infoPath, info);
        }).then(function() {
          return Promise.all(opts.deps.slice(1).map(function(dep) {
            return saveLink(infoPath, hashPath(dep).info);
          }));
        });
      };
      saveContents = function() {
        return Promise.all(opts.dests.map(function(dest) {
          var hashed;
          hashed = hashPath(dest);
          info.dests[dest] = hashed.cache;
          return saveLink(dest, hashed.cache);
        }));
      };
      return Promise.all([saveContents(), saveInfo(key.info)]);
    } else {
      info = {};
      return kit.readJson(key.info).then(function(data) {
        info = data;
        return Promise.all(_(info.deps).keys().map(function(path) {
          return kit.stat(path).then(function(stats) {
            return info.deps[path] >= stats.mtime.getTime();
          });
        }).value());
      }).then(function(latestList) {
        info.deps = _.keys(info.deps);
        return info.isNewer = _.all(latestList);
      })["catch"](function(err) {
        return info.cacheError = err;
      }).then(function() {
        return info;
      });
    }
  },

  /**
  	 * Daemonize a program. Just a shortcut usage of `kit.spawn`.
  	 * @param  {Object} opts Defaults:
  	 * ```coffee
  	 * {
  	 * 	bin: 'node'
  	 * 	args: ['app.js']
  	 * 	stdout: 'stdout.log' # Can also be a fd
  	 * 	stderr: 'stderr.log' # Can also be a fd
  	 * }
  	 * ```
  	 * @return {Porcess} The daemonized process.
   */
  daemonize: function(opts) {
    var errLog, outLog, p;
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
    p = kit.spawn(opts.bin, opts.args, {
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
  decrypt: function(data, password, algorithm) {
    var crypto, decipher;
    if (algorithm == null) {
      algorithm = 'aes128';
    }
    crypto = kit.require('crypto', __dirname);
    decipher = crypto.createDecipher(algorithm, password);
    if (kit.nodeVersion() < 0.10) {
      if (Buffer.isBuffer(data)) {
        data = data.toString('binary');
      }
      return new Buffer(decipher.update(data, 'binary') + decipher.final(), 'binary');
    } else {
      if (!Buffer.isBuffer(data)) {
        data = new Buffer(data);
      }
      return Buffer.concat([decipher.update(data), decipher.final()]);
    }
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
  encrypt: function(data, password, algorithm) {
    var cipher, crypto;
    if (algorithm == null) {
      algorithm = 'aes128';
    }
    crypto = kit.require('crypto', __dirname);
    cipher = crypto.createCipher(algorithm, password);
    if (kit.nodeVersion() < 0.10) {
      if (Buffer.isBuffer(data)) {
        data = data.toString('binary');
      }
      return new Buffer(cipher.update(data, 'binary') + cipher.final(), 'binary');
    } else {
      if (!Buffer.isBuffer(data)) {
        data = new Buffer(data);
      }
      return Buffer.concat([cipher.update(data), cipher.final()]);
    }
  },

  /**
  	 * A error log shortcut for `kit.log(msg, 'error', opts)`
  	 * @param  {Any} msg
  	 * @param  {Object} opts
   */
  err: function(msg, opts) {
    if (opts == null) {
      opts = {};
    }
    return kit.log(msg, 'error', opts);
  },

  /**
  	 * A better `child_process.exec`. Supports multi-line shell script.
  	 * For supporting old version of node, it will create 3 temp files,
  	 * the temp files will be removed after the execution.
  	 * @param  {String} cmd   Shell commands.
  	 * @param  {String} shell Shell name. Such as `bash`, `zsh`. Optinal.
  	 * @return {Promise} Resolves when the process's stdio is drained.
  	 * The resolve value is like:
  	 * ```coffee
  	 * {
  	 * 	code: 0
  	 * 	signal: null
  	 * 	stdout: 'hello world'
  	 * 	stderr: ''
  	 * }
  	 * ```
  	 * @example
  	 * ```coffee
  	 * kit.exec("""
  	 * 	a='hello world'
  	 *  echo $a
  	 * """).then ({code, stdout}) ->
  	 * 	kit.log code # output => 0
  	 * 	kit.log stdout # output => "hello world"
  	 *
  	 * # Bash doesn't support "**" recusive match pattern.
  	 * p = kit.exec """
  	 * 	echo **\/*.css
  	 * """, 'zsh'
  	 *
  	 * # Get the child process object.
  	 * p.process.then (proc) ->
  	 * 	kit.log proc.pid
  	 * ```
   */
  exec: function(cmd, shell) {
    var clean, fileHandlers, os, paths, proc, processPromise, promise, randName, stderrPath, stdinPath, stdoutPath;
    os = kit.require('os', __dirname);
    if (shell == null) {
      shell = process.env.SHELL || process.env.ComSpec || process.env.COMSPEC;
    }
    randName = Date.now() + Math.random();
    paths = ['.in', '.out', '.err'].map(function(type) {
      return kit.path.join(os.tmpDir(), 'nokit-' + randName + type);
    });
    stdinPath = paths[0], stdoutPath = paths[1], stderrPath = paths[2];
    fileHandlers = [];
    clean = function() {
      return Promise.all(fileHandlers.map(function(f) {
        return kit.close(f);
      })).then(function() {
        return Promise.all(paths.map(function(p) {
          return kit.remove(p);
        }));
      });
    };
    proc = null;
    processPromise = kit.outputFile(stdinPath, cmd + '\n').then(function() {
      return Promise.all([kit.fs.open(stdinPath, 'r'), kit.fs.open(stdoutPath, 'w'), kit.fs.open(stderrPath, 'w')]);
    }).then(function(stdio) {
      var p;
      fileHandlers = fileHandlers.concat(stdio);
      p = kit.spawn(shell, [], {
        stdio: stdio
      });
      proc = p.process;
      return p;
    });
    promise = processPromise.then(function(msg) {
      return kit.readFile(stdoutPath, 'utf8').then(function(stdout) {
        return _.extend(msg, {
          stdout: stdout
        });
      });
    })["catch"](function(msg) {
      return kit.readFile(stderrPath, 'utf8').then(function(stderr) {
        _.extend(msg, {
          stderr: stderr
        });
        return Promise.reject(msg);
      });
    });
    promise.process = processPromise.then(function() {
      return proc;
    });
    promise.then(clean)["catch"](clean);
    return promise;
  },

  /**
  	 * Format the parsed comments array to a markdown string.
  	 * @param  {Array}  comments
  	 * @param  {Object} opts Defaults:
  	 * ```coffee
  	 * {
  	 * 	indent: 0
  	 * 	name: ({ name }) ->
  	 * 		name = name.replace 'self.', ''
  	 * 		"- \#\#\#\# #{name}\n\n"
  	 * 	tag: ({ tagName, name, type }) ->
  	 * 		tname = if name then " `#{name}`" else ''
  	 * 		ttype = if type then " { _#{type}_ }" else ''
  	 * 		"- **<u>#{tagName}</u>**:#{tname}#{ttype}"
  	 * }
  	 * ```
  	 * @return {String}
   */
  formatComment: function(comments, opts) {
    var all, cmt, cmtStr, j, l, len, len1, paramList, ref, tag;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      indent: 0,
      name: function(arg) {
        var name;
        name = arg.name;
        name = name.replace('self.', '');
        return "- #### " + name + "\n\n";
      },
      tag: function(arg) {
        var name, tagName, tname, ttype, type;
        tagName = arg.tagName, name = arg.name, type = arg.type;
        tname = name ? " `" + name + "`" : '';
        ttype = type ? " { _" + type + "_ }" : '';
        return "- **<u>" + tagName + "</u>**:" + tname + ttype;
      }
    });
    all = '';
    for (j = 0, len = comments.length; j < len; j++) {
      cmt = comments[j];
      if (_.any(cmt.tags, {
        tagName: 'private'
      })) {
        continue;
      }
      paramList = _(cmt.tags).filter(function(tag) {
        return tag.tagName === 'param';
      }).map('name').value();
      if (paramList.length > 0) {
        cmt.name += "(" + (paramList.join(', ')) + ")";
      } else if (_.find(cmt.tags, {
        tagName: 'return'
      })) {
        cmt.name += "()";
      }
      cmtStr = opts.name(cmt);
      if (cmt.description) {
        cmtStr += kit.indent(cmt.description, 4);
        cmtStr += '\n\n';
      }
      ref = cmt.tags;
      for (l = 0, len1 = ref.length; l < len1; l++) {
        tag = ref[l];
        cmtStr += kit.indent(opts.tag(tag), 4);
        cmtStr += '\n\n';
        if (tag.description) {
          cmtStr += kit.indent(tag.description, 8);
          cmtStr += '\n\n';
        }
      }
      all += cmtStr;
    }
    all = all.replace(/[ \t]+$/mg, '');
    return kit.indent(all, opts.indent);
  },

  /**
  	 * See my project [nofs](https://github.com/ysmood/nofs).
  	 *
  	 * [Offline Documentation](?gotoDoc=nofs/readme.md)
   */
  fs: fs,

  /**
  	 * Fuzzy search a string list by a key word.
  	 * @param {String} keys The key word.
  	 * @param {Array} list The list of string to search.
  	 * @param {Object} opts Defaults:
  	 * ```coffee
  	 * {
  	 * 	result: (wrappedList) ->
  	 * 		wrappedList.min('distance').words
  	 * 	threshold: (cOffset, keyLen, cIndex) ->
  	 * 		Infinity
  	 * 	notFound: (cOffset, keyLen, cIndex) ->
  	 * 		Infinity
  	 * 	span: (cOffset, keyLen, cIndex) ->
  	 * 		cOffset
  	 * 	found: (cOffset, keyLen, cIndex) ->
  	 * 		(Math.exp(cOffset + 1) - 1) * (keyLen - cIndex)
  	 * 	tail: (cOffset, keyLen, cIndex, tailLen) ->
  	 * 		tailLen
  	 * }
  	 * ```
  	 * @return {String} The best matched one. If not found,
  	 * return undefined.
  	 * @example
  	 * ```coffee
  	 * kit.fuzzySearch 'hw', ['test', 'hello world', 'hey world']
  	 * # output => 'hey world'
  	 *
  	 * # To get a sortable weighted list.
  	 * kit.fuzzySearch 'hw', ['test', 'hello world', 'hey world'], {
  	 * 	result: (wrappedList) -> wrappedList.value()
  	 * }
  	 * # output => [
  	 * #  { distance: Infinity }
  	 * #  { words: 'hello world', distance: 1110.069 }
  	 * #  { words: 'hey world', distance: 159.849 }
  	 * # ]
  	 * ```
   */
  fuzzySearch: function(key, list, opts) {
    var wrappedList;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      result: function(list) {
        return list.min('distance').words;
      },
      threshold: function(cOffset, keyLen, cIndex) {
        return Infinity;
      },
      notFound: function(cOffset, keyLen, cIndex) {
        return Infinity;
      },
      span: function(cOffset, keyLen, cIndex) {
        return cOffset;
      },
      found: function(cOffset, keyLen, cIndex) {
        return (Math.exp(cOffset + 1) - 1) * (keyLen - cIndex);
      },
      tail: function(cOffset, keyLen, cIndex, tailLen) {
        return tailLen;
      }
    });
    wrappedList = _(list).map(function(words) {
      var c, cIndex, cOffset, distance, j, keyLen, len;
      distance = 0;
      keyLen = key.length;
      for (cIndex = j = 0, len = key.length; j < len; cIndex = ++j) {
        c = key[cIndex];
        cOffset = words.indexOf(c, cOffset + 1);
        distance = cOffset < 0 ? opts.notFound(cOffset, keyLen, cIndex) : distance + opts.found(cOffset, keyLen, cIndex);
        distance += opts.span(cOffset, keyLen, cIndex);
        if (distance >= opts.threshold(cOffset, keyLen, cIndex)) {
          return {
            distance: Infinity
          };
        }
      }
      distance += opts.tail(cOffset, keyLen, cIndex, words.slice(cOffset).length);
      if (distance >= opts.threshold(cOffset, keyLen, cIndex)) {
        return {
          distance: Infinity
        };
      }
      return {
        words: words,
        distance: distance
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
  	 * ```coffee
  	 * # Suppose current working directory is '/home/a'
  	 * kit.genModulePaths 'test'
  	 * # output => ['/home/a/node_modules/test', '/home/node_modules/test', '/node_modules/test']
  	 * ```
   */
  genModulePaths: function(moduleName, dir, modDir) {
    var names, pDir;
    if (dir == null) {
      dir = process.cwd();
    }
    if (modDir == null) {
      modDir = 'node_modules';
    }
    names = [];
    while (true) {
      names.push(kit.path.join(dir, modDir, moduleName));
      pDir = kit.path.dirname(dir);
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
  	 * ```coffee
  	 * # Increase
  	 * kit.indent "one\ntwo", 2
  	 * # => "  one\n  two"
  	 *
  	 * # Decrease
  	 * kit.indent "--one\n--two", 0, '', /^--/mg
  	 * # => "one\ntwo"
  	 * ```
   */
  indent: function(text, num, char, reg) {
    var prefix;
    if (num == null) {
      num = 0;
    }
    if (char == null) {
      char = ' ';
    }
    if (reg == null) {
      reg = /^/mg;
    }
    prefix = _.repeat(char, num);
    return text.replace(reg, prefix);
  },

  /**
  	 * Nokit use it to check the running mode of the app.
  	 * Overwrite it if you want to control the check logic.
  	 * By default it returns the `rocess.env.NODE_ENV == 'development'`.
  	 * @return {Boolean}
   */
  isDevelopment: function() {
    return process.env.NODE_ENV === 'development';
  },

  /**
  	 * Nokit use it to check the running mode of the app.
  	 * Overwrite it if you want to control the check logic.
  	 * By default it returns the `rocess.env.NODE_ENV == 'production'`.
  	 * @return {Boolean}
   */
  isProduction: function() {
    return process.env.NODE_ENV === 'production';
  },

  /**
  	 * A fast helper to hash string or binary file.
  	 * See my [jhash](https://github.com/ysmood/jhash) project.
  	 * You must `kit.require 'jhash'` before using it.
  	 *
  	 * [Offline Documentation](?gotoDoc=jhash/readme.md)
  	 * @example
  	 * ```coffee
  	 * kit.require 'jhash'
  	 * kit.jhash.hash 'test' # output => '349o'
  	 *
  	 * jhash.hash kit.readFileSync('a.jpg')
  	 *
  	 * # Control the hash char set.
  	 * kit.jhash.setSymbols 'abcdef'
  	 * kit.jhash.hash 'test' # output => 'decfddfe'
  	 *
  	 * # Control the max length of the result hash value. Unit is bit.
  	 * jhash.setMaskLen 10
  	 * jhash.hash 'test' # output => 'ede'
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
  	 * ```coffee
  	 * {
  	 * 	isShowTime: true
  	 * 	logReg: process.env.logReg and new RegExp process.env.logReg
  	 * 	logTrace: process.env.logTrace == 'on'
  	 * }
  	 * ```
  	 * @example
  	 * ```coffee
  	 * kit.log 'test'
  	 * # => '[2015-02-07 08:31:49] test'
  	 *
  	 * kit.log 'test', { isShowTime: false }
  	 * # => 'test'
  	 *
  	 * kit.log 'test', { logReg: /a/ }
  	 * # => ''
  	 *
  	 * kit.log '%s %s %d', ['a', 'b', 10]
  	 * # => '[2015-02-07 08:31:49] a b 10'
  	 * ```
   */
  log: function() {
    var action, args, cs, formats, log, msg, opts, ref, time, timeDelta, util;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    cs = kit.require('colors/safe', function() {
      if (kit.isDevelopment()) {
        return cs.mode = 'none';
      }
    });
    if (_.isObject(action)) {
      opts = action;
      action = 'log';
    }
    msg = args[0];
    ref = kit.defaultArgs(args.slice(1), {
      action: {
        String: 'log'
      },
      formats: {
        Array: null
      },
      opts: {
        Object: {}
      }
    }), action = ref.action, formats = ref.formats, opts = ref.opts;
    _.defaults(opts, {
      isShowTime: true,
      logReg: process.env.logReg && new RegExp(process.env.logReg),
      logTrace: process.env.logTrace === 'on'
    });
    if (!kit.lastLogTime) {
      kit.lastLogTime = new Date;
      if (opts.logReg) {
        kit.logReg = opts.logReg;
      }
    }
    if (opts.isShowTime) {
      time = new Date();
      timeDelta = cs.magenta(+time - +kit.lastLogTime) + 'ms';
      kit.lastLogTime = time;
      time = cs.grey([
        [[time.getFullYear(), 4, '0'], [time.getMonth() + 1, 2, '0'], [time.getDate(), 2, '0']].map(function(e) {
          return _.padLeft.apply(0, e);
        }).join('-'), [[time.getHours(), 2, '0'], [time.getMinutes(), 2, '0'], [time.getSeconds(), 2, '0']].map(function(e) {
          return _.padLeft.apply(0, e);
        }).join(':')
      ].join(' '));
    }
    log = function() {
      var err, str;
      str = _.toArray(arguments).join(' ');
      if (kit.logReg && !kit.logReg.test(str)) {
        return;
      }
      console[action](str);
      if (opts.logTrace) {
        err = cs.grey((new Error).stack).replace(/.+\n.+\n.+/, '\nStack trace:');
        return console.log(err);
      }
    };
    if (_.isObject(msg)) {
      if (opts.isShowTime) {
        log(("[" + time + "] ->\n") + kit.xinspect(msg, opts), timeDelta);
      } else {
        log(kit.xinspect(msg, opts), timeDelta);
      }
    } else {
      if (formats) {
        formats.unshift(msg);
        util = kit.require('util', __dirname);
        msg = util.format.apply(0, formats);
      }
      if (opts.isShowTime) {
        log(("[" + time + "] ") + msg, timeDelta);
      } else {
        log(msg, timeDelta);
      }
    }
    if (action === 'error') {
      process.stdout.write("\u0007");
    }
  },

  /**
  	 * Shortcut for logging multiple strings.
  	 * @param  {Any} args...
  	 * @example
  	 * ```coffee
  	 * kit.log 'test1', 'test2', test3'
  	 * # => [2015-02-07 08:31:49] test1 test2 test3
  	 * ```
   */
  logs: function() {
    var args;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    return kit.log(args.join(' '));
  },

  /**
  	 * Monitor an application and automatically restart it when file changed.
  	 * Even when the monitored app exit with error, the monitor will still wait
  	 * for your file change to restart the application. Not only nodejs, but also
  	 * other programs like ruby or python.
  	 * It will print useful infomation when it application unexceptedly.
  	 * @param  {Object} opts Defaults:
  	 * ```coffee
  	 * {
  	 * 	bin: 'node'
  	 * 	args: ['index.js']
  	 * 	watchList: [] # By default, the same with the "args".
  	 * 	isNodeDeps: true
  	 * 	opts: {} # Same as the opts of 'kit.spawn'.
  	 *
  	 * 	# The option of `kit.parseDependency`
  	 * 	parseDependency: {}
  	 *
  	 * 	onStart: ->
  	 * 		kit.log "Monitor: " + opts.watchList
  	 * 	onRestart: (path) ->
  	 * 		kit.log "Reload app, modified: " + path
  	 * 	onWatchFiles: (paths) ->
  	 * 		kit.log 'Watching:' + paths.join(', ')
  	 * 	onNormalExit: ({ code, signal }) ->
  	 * 		kit.log 'EXIT' +
  	 * 			" code: #{code} signal: #{signal}"
  	 * 	onErrorExit: ({ code, signal }) ->
  	 * 		kit.err 'EXIT' +
  	 * 		" code: #{code} signal: #{signal}\n" +
  	 * 		'Process closed. Edit and save
  	 * 			the watched file to restart.'
  	 * 	sepLine: ->
  	 * 		process.stdout.write _.repeat('*', process.stdout.columns)
  	 * }
  	 * ```
  	 * @return {Promise} It has a property `process`, which is the monitored
  	 * child process. Properties:
  	 * ```coffee
  	 * {
  	 * 	process: Object
  	 *
  	 * 	# Call it to stop monitor.
  	 * 	stop: ->
  	 *
  	 * 	# Resolve a list of watch handlers.
  	 * 	watchPromise: Promise
  	 * }
  	 * ```
  	 * @example
  	 * ```coffee
  	 * kit.monitorApp {
  	 * 	bin: 'coffee'
  	 * 	args: ['main.coffee']
  	 * }
  	 *
  	 * kit.monitorApp {
  	 * 	bin: 'ruby'
  	 * 	args: ['app.rb', 'lib\/**\/*.rb']
  	 * 	isNodeDeps: false
  	 * }
  	 * ```
   */
  monitorApp: function(opts) {
    var childPromise, cs, start, stop, watchPromise, watcher;
    cs = kit.require('colors/safe');
    _.defaults(opts, {
      bin: 'node',
      args: ['index.js'],
      watchList: null,
      isNodeDeps: true,
      parseDependency: {},
      opts: {},
      onStart: function() {
        return kit.log(cs.yellow("Monitor: ") + opts.watchList);
      },
      onRestart: function(path) {
        return kit.log(cs.yellow("Reload app, modified: ") + path);
      },
      onWatchFiles: function(paths) {
        return kit.log(cs.yellow('Watching: ') + paths.join(', '));
      },
      onNormalExit: function(arg) {
        var code, signal;
        code = arg.code, signal = arg.signal;
        return kit.log(cs.yellow('EXIT') + (" code: " + (cs.cyan(code)) + " signal: " + (cs.cyan(signal))));
      },
      onErrorExit: function(arg) {
        var code, signal;
        code = arg.code, signal = arg.signal;
        return kit.err(cs.yellow('EXIT') + (" code: " + (cs.cyan(code)) + " ") + ("signal: " + (cs.cyan(signal)) + "\n") + cs.red('Process closed. Edit and save the watched file to restart.'));
      },
      sepLine: function() {
        return process.stdout.write(cs.yellow(_.repeat('*', process.stdout.columns)));
      }
    });
    if (opts.watchList == null) {
      opts.watchList = opts.args;
    }
    childPromise = null;
    start = function() {
      opts.sepLine();
      childPromise = kit.spawn(opts.bin, opts.args, opts.opts);
      childPromise.watchPromise = watchPromise;
      return childPromise.then(function(msg) {
        return opts.onNormalExit(msg);
      })["catch"](function(err) {
        if (err.stack) {
          return Promise.reject(err.stack);
        }
        return opts.onErrorExit(err);
      });
    };
    watcher = function(path, curr, prev, isDelete) {
      if (isDelete) {
        return;
      }
      if (curr.mtime !== prev.mtime) {
        opts.onRestart(path);
        childPromise["catch"](function() {}).then(start);
        return childPromise.process.kill('SIGINT');
      }
    };
    stop = function() {
      return childPromise.watchPromise.then(function(list) {
        var j, len, results, w;
        results = [];
        for (j = 0, len = list.length; j < len; j++) {
          w = list[j];
          results.push(kit.unwatchFile(w.path, w.handler));
        }
        return results;
      });
    };
    process.on('SIGINT', function() {
      childPromise.process.kill('SIGINT');
      return process.exit();
    });
    watchPromise = opts.isNodeDeps ? kit.parseDependency(opts.watchList, opts.parseDependency).then(function(paths) {
      opts.onWatchFiles(paths);
      return kit.watchFiles(paths, {
        handler: watcher
      });
    }) : kit.watchFiles(opts.watchList, {
      handler: watcher
    });
    opts.onStart();
    start();
    return _.extend(childPromise, {
      watchPromise: watchPromise,
      stop: stop
    });
  },

  /**
  	 * Node version. Such as `v0.10.23` is `0.1023`, `v0.10.1` is `0.1001`.
  	 * @return {Float}
   */
  nodeVersion: function() {
    var ms, str;
    if (kit.nodeVersion.ver) {
      return kit.nodeVersion.ver;
    }
    ms = process.versions.node.match(/(\d+)\.(\d+)\.(\d+)/);
    str = ms[1] + '.' + _.padLeft(ms[2], 2, '0') + _.padLeft(ms[3], 2, '0');
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
  	 * ```coffee
  	 * foo = ->
  	 * 	args = kit.defaultArgs arguments, {
  	 * 		name: { String: 'A' }
  	 * 		colors: { Array: [] }
  	 * 		family: { String: null }
  	 * 		isReal: { Boolean: false }
  	 * 		fn: { Function: -> 'callback' }
  	 * 	}
  	 *
  	 * kit.log foo('test', false, ['red'], -> 'nothing')
  	 * # Here the logged value will deeply equal:
  	 * { name: 'test', colors: ['red'], family: null, fn: -> 'nothing' }
  	 * ```
   */
  defaultArgs: function(args, defaults) {
    var name, ref, ret, set, type, v, val;
    set = _(args).toArray().groupBy(function(e) {
      return e.constructor.name;
    }).value();
    ret = {};
    for (name in defaults) {
      val = defaults[name];
      type = _.keys(val)[0];
      ret[name] = set[type] ? ((ref = set[type].splice(0, 1), v = ref[0], ref), v ? v : val[type]) : val[type];
    }
    return ret;
  },

  /**
  	 * A comments parser for javascript and coffee-script.
  	 * Used to generate documentation from source code automatically.
  	 * It will traverse through all the comments of a coffee file.
  	 * @param  {String} code Coffee source code.
  	 * @param  {Object} opts Parser options:
  	 * ```coffee
  	 * {
  	 * 	commentReg: RegExp
  	 * 	splitReg: RegExp
  	 * 	tagNameReg: RegExp
  	 * 	typeReg: RegExp
  	 * 	nameReg: RegExp
  	 * 	nameTags: ['param', 'property']
  	 * 	descriptionReg: RegExp
  	 * }
  	 * ```
  	 * @return {Array} The parsed comments. Each item is something like:
  	 * ```coffee
  	 * {
  	 * 	name: 'parseComment'
  	 * 	description: 'A comments parser for coffee-script.'
  	 * 	tags: [
  	 * 		{
  	 * 			tagName: 'param'
  	 * 			type: 'string'
  	 * 			name: 'code'
  	 * 			description: 'The name of the module it belongs to.'
  	 * 			index: 256 # The target char index in the file.
  	 * 			line: 32 # The line number of the target in the file.
  	 * 		}
  	 * 	]
  	 * }
  	 * ```
   */
  parseComment: function(code, opts) {
    var comments, info, m, parseInfo;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      commentReg: /(?:\#\#\#|\/\*)\*([\s\S]+?)(?:\#\#\#|\*\/)\s+(?:var\s+)?([$@\w\.-]+)/g,
      splitReg: /^\s+\* @/m,
      tagNameReg: /^([\w\.]+)\s*/,
      typeReg: /^\{(.+?)\}\s*/,
      nameReg: /^(\w+)\s*/,
      nameTags: ['param', 'property'],
      descriptionReg: /^([\s\S]*)/
    });
    parseInfo = function(block) {
      var arr;
      block = block.replace(/\\\//g, '/');
      arr = block.split(opts.splitReg).map(function(el) {
        return el.replace(/^[ \t]+\*[ \t]?/mg, '').trim();
      });
      return {
        description: arr[0] || '',
        tags: arr.slice(1).map(function(el) {
          var parseTag, ref, tag, type;
          parseTag = function(reg) {
            var m;
            m = el.match(reg);
            if (m && m[1]) {
              el = el.slice(m[0].length);
              return m[1];
            } else {
              return null;
            }
          };
          tag = {};
          tag.tagName = parseTag(opts.tagNameReg);
          type = parseTag(opts.typeReg);
          if (type) {
            tag.type = type;
            if (ref = tag.tagName, indexOf.call(opts.nameTags, ref) >= 0) {
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
    comments = [];
    m = null;
    while ((m = opts.commentReg.exec(code)) !== null) {
      info = parseInfo(m[1]);
      comments.push({
        name: m[2],
        description: info.description,
        tags: info.tags,
        index: opts.commentReg.lastIndex,
        line: _.reduce(code.slice(0, opts.commentReg.lastIndex), function(count, char) {
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
  	 * ```coffee
  	 * {
  	 * 	depReg: /require\s*\(?['"](.+)['"]\)?/gm
  	 * 	depRoots: ['']
  	 * 	extensions: ['.js', '.coffee', 'index.js', 'index.coffee']
  	 *
  	 * 	# It will handle all the matched paths.
  	 * 	# Return false value if you don't want this match.
  	 * 	handle: (path) ->
  	 * 		path.replace(/^[\s'"]+/, '').replace(/[\s'";]+$/, '')
  	 * }
  	 * ```
  	 * @return {Promise} It resolves the dependency path array.
  	 * @example
  	 * ```coffee
  	 * kit.parseDependency 'main.', {
  	 * 	depReg: /require\s*\(?['"](.+)['"]\)?/gm
  	 * 	handle: (path) ->
  	 * 		return path if path.match /^(?:\.|\/|[a-z]:)/i
  	 * }
  	 * .then (markdownStr) ->
  	 * 	kit.log markdownStr
  	 * ```
   */
  parseDependency: function(entryPaths, opts, depPaths) {
    var winSep;
    if (opts == null) {
      opts = {};
    }
    if (depPaths == null) {
      depPaths = {};
    }
    _.defaults(opts, {
      depReg: /require\s*\(?['"](.+)['"]\)?/g,
      depRoots: [''],
      extensions: ['.js', '.coffee', '/index.js', '/index.coffee'],
      handle: function(path) {
        if (path.match(/^(?:\.|\/|[a-z]:)/i)) {
          return path;
        }
      }
    });
    winSep = /\\/g;
    if (_.isString(entryPaths)) {
      entryPaths = [entryPaths];
    }
    entryPaths = entryPaths.reduce(function(s, p) {
      if (kit.path.extname(p)) {
        return s.concat([p]);
      } else {
        return s.concat(opts.extensions.map(function(ext) {
          return p + ext;
        }));
      }
    }, []);
    if (opts.depRoots.indexOf('') === -1) {
      opts.depRoots.push('');
    }
    entryPaths = entryPaths.reduce(function(s, p) {
      return s.concat(opts.depRoots.map(function(root) {
        return kit.path.join(root, p);
      }));
    }, []);
    return Promise.all(entryPaths.map(function(entryPath) {
      return (entryPath.indexOf('*') > -1 ? kit.glob(entryPaths) : kit.fileExists(entryPath).then(function(exists) {
        if (exists) {
          return [entryPath];
        } else {
          return [];
        }
      })).then(function(paths) {
        return Promise.all(paths.map(function(path) {
          if (depPaths[path]) {
            return;
          }
          return kit.readFile(path, 'utf8').then(function(str) {
            var dir;
            depPaths[path.replace(winSep, '/')] = true;
            dir = kit.path.dirname(path);
            entryPaths = [];
            str.replace(opts.depReg, function(m, p) {
              p = opts.handle(p);
              if (!p) {
                return;
              }
              entryPaths.push(p);
              return entryPaths.push(kit.path.join(dir, p));
            });
            return kit.parseDependency(entryPaths, opts, depPaths);
          });
        }));
      });
    })).then(function() {
      return _.keys(depPaths);
    });
  },

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
  Promise: Promise,

  /**
  	 * Create a getter & setter for an object's property.
  	 * @param  {Object} self
  	 * @param  {String} prop The property name.
  	 * @return {Function} `(v) -> Any`
  	 * ```coffee
  	 * # Two arguments
  	 * data = { path: 'a.txt' }
  	 * txt = kit.prop data, 'txt'
  	 * txt kit.readFile data.path
  	 * .then ->
  	 * 	kit.log data
  	 * 	kit.log txt()
  	 *
  	 * # Two arguments another form.
  	 * kit.readFile data.path
  	 * .then txt
  	 * .then ->
  	 * 	kit.log data
  	 *
  	 * # One argument.
  	 * txt = kit.prop 'default value'
  	 * kit.log txt() # => "default value"
  	 * txt 20
  	 * kit.log txt() # => 20
  	 * ```
   */
  prop: function(self, prop) {
    var get, set, val;
    if (arguments.length < 2) {
      val = self;
      set = function(v) {
        return val = v;
      };
      get = function() {
        return val;
      };
    } else {
      set = function(v) {
        return self[prop] = v;
      };
      get = function() {
        return self[prop];
      };
    }
    return function(v) {
      if (v != null) {
        if (_.isFunction(v.then)) {
          return v.then(set);
        } else {
          return set(v);
        }
      } else {
        return get();
      }
    };
  },

  /**
  	 * The `proxy` module.
  	 * You must `kit.require 'proxy'` before using it.
  	 * For more information goto the `Proxy` section.
   */
  proxy: null,

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
  	 * ```coffee
  	 * kit.require 'jhash'
  	 * # Then you can use the module, or it will be null.
  	 * kit.jhash.hash 'test'
  	 * ```
  	 * To load a relative path, or you own module,
  	 * the second parameter 'dir' is required.
  	 * ```coffee
  	 * mod = kit.require './mod', __dirname
  	 *
  	 * # Or load your own 'jhash', rather than nokit's.
  	 * jhash = kit.require 'jhash', __dirname
  	 * ```
   */
  require: function(moduleName, dir, loaded) {
    var e, err, j, key, len, modPath, name, names, p;
    if (_.isFunction(dir)) {
      loaded = dir;
      dir = null;
    }
    key = moduleName + (dir ? '@' + dir : '');
    if (kit.requireCache[key]) {
      return kit.requireCache[key];
    }
    if (dir == null) {
      if (moduleName[0] === '.' || kit[moduleName] !== null) {
        err = new Error("[kit.require] argument 'dir' is not defined");
        err.source = 'nokit';
        throw err;
      }
      try {
        modPath = require.resolve('./' + moduleName);
      } catch (_error) {
        e = _error;
        if (e.code !== 'MODULE_NOT_FOUND') {
          throw e;
        }
      }
      if (modPath) {
        return kit[moduleName] = kit.requireCache[key] = require(modPath);
      }
      return kit[moduleName] = kit.requireCache[key] = require(moduleName);
    }
    names = moduleName[0] === '.' ? [kit.path.join(dir, moduleName)] : kit.genModulePaths(moduleName, dir).concat((function() {
      var j, len, ref, results;
      if (process.env.NODE_PATH) {
        ref = process.env.NODE_PATH.split(kit.path.delimiter);
        results = [];
        for (j = 0, len = ref.length; j < len; j++) {
          p = ref[j];
          results.push(kit.path.join(p, moduleName));
        }
        return results;
      } else {
        return [];
      }
    })());
    for (j = 0, len = names.length; j < len; j++) {
      name = names[j];
      try {
        modPath = require.resolve(name);
      } catch (_error) {
        e = _error;
        if (e.code === 'MODULE_NOT_FOUND') {
          modPath = null;
        } else {
          throw e;
        }
      }
      if (modPath) {
        kit.requireCache[key] = require(modPath);
        if (typeof loaded === "function") {
          loaded(kit.requireCache[key]);
        }
        break;
      }
    }
    if (!kit.requireCache[key]) {
      throw new Error('Module not found: ' + moduleName);
    }
    if (kit[moduleName] === null) {
      kit[moduleName] = kit.requireCache[key];
    }
    return kit.requireCache[key];
  },

  /**
  	 * Require an optional package. If not found, it will
  	 * warn the user to npm install it, and exit the process.
  	 * @param {String} name Package name
  	 * @param {String} dir Current absolute file path. Not optional.
  	 * On most times, just pass `__dirname` to it is enough.
  	 * @param  {String} semver Specify what version you need,
  	 * such as `^0.3.1` or `>=1.2.3`, ect.
  	 * @return {Any} The required package.
   */
  requireOptional: function(name, dir, semver) {
    var cs, err, info, key, version;
    key = semver ? name + '@' + semver : name;
    if (kit.requireCache[key]) {
      return kit.requireCache[key];
    }
    try {
      if (semver) {
        kit.require('semver');
        version = kit.require(name + '/package.json', dir).version;
        if (!kit.semver.satisfies(version, semver)) {
          info = ("expect " + name + " version ") + ("'" + semver + "', but get '" + version + "'");
          name = name + "@\"" + semver + "\"";
          throw new Error(info);
        }
      }
      return kit.require(name, dir);
    } catch (_error) {
      err = _error;
      if (err.source === 'nokit') {
        throw err;
      }
      cs = kit.require('colors/safe');
      kit.err((cs.red("Optional module required.\n" + cs.red("If current module is installed globally, run " + cs.green(("'npm install -g " + name + "'") + cs.red(" first, else run " + cs.green(("'npm install -S " + name + "'") + cs.red(" first.\n"))))))) + err.stack, {
        isShowTime: false
      });
      return process.exit(1);
    }
  },

  /**
  	 * A handy extended combination of `http.request` and `https.request`.
  	 * @param  {Object} opts The same as the [http.request](http://nodejs.org/api/http.html#httpHttpRequestOptionsCallback),
  	 * but with some extra options:
  	 * ```coffee
  	 * {
  	 * 	# String or Url Object.
  	 * 	url: String | Object
  	 *
  	 * 	# Other than return `res` with `res.body`,return `body` directly.
  	 * 	body: true
  	 *
  	 * 	# Max times of auto redirect. If 0, no auto redirect.
  	 * 	redirect: 0
  	 *
  	 * 	# Timeout of the socket of the http connection.
  	 * 	# If timeout happens, the promise will reject.
  	 * 	# Zero means no timeout.
  	 * 	timeout: 0
  	 *
  	 * 	# The key of headers should be lowercased.
  	 * 	headers: {}
  	 *
  	 * 	protocol: 'http:' or 'https:'
  	 *
  	 * 	agent: null
  	 *
  	 * 	# Set "transfer-encoding" header to 'chunked'.
  	 * 	setTE: false
  	 *
  	 * 	# Set null to use buffer, optional.
  	 * 	# It supports GBK, ShiftJIS etc.
  	 * 	# For more info, see https://github.com/ashtuchkin/iconv-lite
  	 * 	resEncoding: 'auto'
  	 *
  	 * 	# It's string, object or buffer, optional. When it's an object,
  	 * 	# The request will be 'application/x-www-form-urlencoded'.
  	 * 	reqData: null
  	 *
  	 * 	# auto end the request.
  	 * 	autoEndReq: true
  	 *
  	 * 	# Readable stream.
  	 * 	reqPipe: null
  	 *
  	 * 	# Writable stream.
  	 * 	resPipe: null
  	 *
  	 * 	# The progress of the request.
  	 * 	reqProgress: (complete, total) ->
  	 *
  	 * 	# The progress of the response.
  	 * 	resProgress: (complete, total) ->
  	 * }
  	 * ```
  	 * And if set opts as string, it will be treated as the url.
  	 * @return {Promise} Contains the http response object,
  	 * it has an extra `body` property.
  	 * You can also get the request object by using `Promise.req`.
  	 * @example
  	 * ```coffee
  	 * p = kit.request 'http://test.com'
  	 * p.req.on 'response', (res) ->
  	 * 	kit.log res.headers['content-length']
  	 * p.then (body) ->
  	 * 	kit.log body # html or buffer
  	 *
  	 * kit.request {
  	 * 	url: {
  	 * 		protocol: 'https', hostname: 'test.com'
  	 * 		port: 8123, path: '/a.mp3?s=1'
  	 * 	}
  	 * 	body: false
  	 * 	resProgress: (complete, total) ->
  	 * 		kit.log "Progress: #{complete} / #{total}"
  	 * }
  	 * .then (res) ->
  	 * 	kit.log res.body.length
  	 * 	kit.log res.headers
  	 *
  	 * # Send form-data.
  	 * form = new (require 'form-data')
  	 * form.append 'image', new Buffer(0), {
  	 * 	filename: 'a.jpg', contentType: 'image/jpg'
  	 * }
  	 * form.append 'key', 'value'
  	 * kit.request {
  	 * 	url: 'a.com'
  	 * 	method: 'POST'
  	 * 	headers: form.getHeaders()
  	 *
  	 * 	# Use chunked encoding, so that we don't have to calculate
  	 * 	# the 'Content-Length'.
  	 * 	setTE: true
  	 *
  	 * 	reqPipe: form
  	 * }
  	 * .then (body) ->
  	 * 	kit.log body
  	 * ```
   */
  request: function(opts) {
    var base, base1, promise, req, reqBuf, request, url;
    kit.require('url');
    if (_.isString(opts)) {
      opts = {
        url: opts
      };
    }
    url = opts.url || {};
    if (_.isObject(url)) {
      if (url.protocol == null) {
        url.protocol = 'http:';
      }
    } else {
      if (url.indexOf('http') !== 0) {
        url = 'http://' + url;
      }
      url = kit.url.parse(url);
      if (url.protocol == null) {
        url.protocol = 'http:';
      }
      delete url.host;
    }
    _.defaults(opts, url);
    request = null;
    switch (opts.protocol) {
      case 'http:':
        request = kit.require('http', __dirname).request;
        break;
      case 'https:':
        request = kit.require('https', __dirname).request;
        break;
      default:
        Promise.reject(new Error('Protocol not supported: ' + opts.protocol));
    }
    _.defaults(opts, {
      body: true,
      resEncoding: 'auto',
      reqData: null,
      autoEndReq: true,
      autoUnzip: true,
      reqProgress: null,
      resProgress: null
    });
    if (opts.headers == null) {
      opts.headers = {};
    }
    if (Buffer.isBuffer(opts.reqData)) {
      reqBuf = opts.reqData;
    } else if (_.isString(opts.reqData)) {
      reqBuf = new Buffer(opts.reqData);
    } else if (_.isObject(opts.reqData)) {
      if ((base = opts.headers)['content-type'] == null) {
        base['content-type'] = 'application/x-www-form-urlencoded; charset=utf-8';
      }
      reqBuf = new Buffer(_.map(opts.reqData, function(v, k) {
        return [encodeURIComponent(k), encodeURIComponent(v)].join('=');
      }).join('&'));
    } else {
      reqBuf = void 0;
    }
    if (reqBuf !== void 0) {
      if ((base1 = opts.headers)['content-length'] == null) {
        base1['content-length'] = reqBuf.length;
      }
    }
    if (opts.setTE) {
      opts.headers['transfer-encoding'] = 'chunked';
    }
    req = null;
    promise = new Promise(function(resolve, reject) {
      req = request(opts, function(res) {
        var buf, resPipeError, unzip;
        if (opts.redirect > 0 && res.headers.location) {
          opts.redirect--;
          url = kit.url.resolve(kit.url.format(opts), res.headers.location);
          kit.request(_.extend(opts, kit.url.parse(url))).then(resolve)["catch"](reject);
          return;
        }
        if (opts.resProgress) {
          (function() {
            var complete, total;
            total = +res.headers['content-length'];
            complete = 0;
            return res.on('data', function(chunk) {
              complete += chunk.length;
              return opts.resProgress(complete, total);
            });
          })();
        }
        if (opts.resPipe) {
          resPipeError = function(err) {
            opts.resPipe.end();
            return reject(err);
          };
          if (opts.autoUnzip) {
            switch (res.headers['content-encoding']) {
              case 'gzip':
                unzip = kit.require('zlib', __dirname).createGunzip();
                break;
              case 'deflate':
                unzip = kit.require('zlib', __dirname).createInflat();
                break;
              default:
                unzip = null;
            }
            if (unzip) {
              unzip.on('error', resPipeError);
              res.pipe(unzip).pipe(opts.resPipe);
            } else {
              res.pipe(opts.resPipe);
            }
          } else {
            res.pipe(opts.resPipe);
          }
          opts.resPipe.on('error', resPipeError);
          res.on('error', resPipeError);
          return res.on('end', function() {
            return resolve(res);
          });
        } else {
          buf = new Buffer(0);
          res.on('data', function(chunk) {
            return buf = Buffer.concat([buf, chunk]);
          });
          return res.on('end', function() {
            var cType, decode, encoding, m, resolver;
            resolver = function(body) {
              if (opts.body) {
                return resolve(body);
              } else {
                res.body = body;
                return resolve(res);
              }
            };
            if (opts.resEncoding) {
              if (opts.resEncoding === 'auto') {
                encoding = 'utf8';
                cType = res.headers['content-type'];
                if (_.isString(cType)) {
                  m = cType.match(/charset=(.+);?/i);
                  if (m && m[1]) {
                    encoding = m[1].toLowerCase();
                    if (encoding === 'utf-8') {
                      encoding = 'utf8';
                    }
                  }
                  if (!/^(text)|(application)\//.test(cType)) {
                    encoding = null;
                  }
                }
              } else {
                encoding = opts.resEncoding;
              }
              decode = function(buf) {
                var err;
                if (!encoding) {
                  return buf;
                }
                try {
                  if (encoding === 'utf8') {
                    return buf.toString();
                  } else {
                    return kit.requireOptional('iconv-lite', __dirname).decode(buf, encoding);
                  }
                } catch (_error) {
                  err = _error;
                  return reject(err);
                }
              };
              if (opts.autoUnzip) {
                switch (res.headers['content-encoding']) {
                  case 'gzip':
                    unzip = kit.require('zlib', __dirname).gunzip;
                    break;
                  case 'deflate':
                    unzip = kit.require('zlib', __dirname).inflate;
                    break;
                  default:
                    unzip = null;
                }
                if (unzip) {
                  return unzip(buf, function(err, buf) {
                    return resolver(decode(buf));
                  });
                } else {
                  return resolver(decode(buf));
                }
              } else {
                return resolver(decode(buf));
              }
            } else {
              return resolver(buf);
            }
          });
        }
      });
      req.on('error', function(err) {
        var ref;
        if ((ref = opts.resPipe) != null) {
          ref.end();
        }
        return reject(err);
      });
      if (opts.timeout > 0) {
        req.setTimeout(opts.timeout, function() {
          return req.emit('error', new Error('timeout'));
        });
      }
      if (opts.reqPipe) {
        if (opts.reqProgress) {
          (function() {
            var complete, total;
            total = +opts.headers['content-length'];
            complete = 0;
            return opts.reqPipe.on('data', function(chunk) {
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
  	 * Create a http request handler middleware.
  	 * @param  {Object} opts Same as the sse.
  	 * @return {Function} `(req, res, next) ->`
  	 * @example
  	 * Visit 'http://127.0.0.1:80123', every 3 sec, the page will be reloaded.
  	 * ```coffee
  	 * http = require 'http'
  	 * handler = kit.serverHelper()
  	 *
  	 * http.createServer (req, res) ->
  	 * 	handler req, res, ->
  	 * 		res.end kit.browserHelper()
  	 *
  	 * .listen 8123, ->
  	 * 	kit.log 'listen ' + 8123
  	 *
  	 * 	setInterval ->
  	 * 		handler.sse.emit 'fileModified', 'changed-file-path.js'
  	 * 	, 3000
  	 * ```
  	 * You can also use the `nokit.log` on the browser to log to the remote server.
  	 * ```coffee
  	 * nokit.log { any: 'thing' }
  	 * ```
   */
  serverHelper: function(opts) {
    var handler;
    handler = function(req, res, next) {
      var cs, data;
      switch (req.url) {
        case '/nokit-sse':
          return handler.sse(req, res);
        case '/nokit-log':
          cs = kit.require('colors/safe');
          data = '';
          req.on('data', function(chunk) {
            return data += chunk;
          });
          return req.on('end', function() {
            var e;
            try {
              kit.log(cs.cyan('client') + cs.grey(' | ') + (data ? kit.xinspect(JSON.parse(data)) : data));
              return res.end();
            } catch (_error) {
              e = _error;
              res.statusCode = 500;
              return res.end(e.stack);
            }
          });
        default:
          return typeof next === "function" ? next() : void 0;
      }
    };
    handler.sse = kit.require('sse')(opts);
    return handler;
  },

  /**
  	 * A safer version of `child_process.spawn` to cross-platform run
  	 * a process. In some conditions, it may be more convenient
  	 * to use the `kit.exec`.
  	 * It will automatically add `node_modules/.bin` to the `PATH`
  	 * environment variable.
  	 * @param  {String} cmd Path or name of an executable program.
  	 * @param  {Array} args CLI arguments.
  	 * @param  {Object} opts Process options.
  	 * Same with the Node.js official documentation.
  	 * Except that it will inherit the parent's stdio.
  	 * @return {Promise} The `promise.process` is the spawned child
  	 * process object.
  	 * **Resolves** when the process's stdio is drained and the exit
  	 * code is either `0` or `130`. The resolve value
  	 * is like:
  	 * ```coffee
  	 * {
  	 * 	code: 0
  	 * 	signal: null
  	 * }
  	 * ```
  	 * @example
  	 * ```coffee
  	 * kit.spawn 'git', ['commit', '-m', '42 is the answer to everything']
  	 * .then ({code}) -> kit.log code
  	 * ```
   */
  spawn: function(cmd, args, opts) {
    var PATH, cmdSrc, m, promise, ps, spawn;
    if (args == null) {
      args = [];
    }
    if (opts == null) {
      opts = {};
    }
    PATH = process.env.PATH || process.env.Path;
    [kit.path.normalize(__dirname + '/../node_modules/.bin'), kit.path.normalize(process.cwd() + '/node_modules/.bin')].forEach(function(path) {
      if (PATH.indexOf(path) < 0 && kit.fs.existsSync(path)) {
        return PATH = [path, PATH].join(kit.path.delimiter);
      }
    });
    process.env.PATH = PATH;
    process.env.Path = PATH;
    _.defaults(opts, {
      stdio: 'inherit'
    });
    if (process.platform === 'win32') {
      kit.require('whichSync');
      cmd = kit.whichSync(cmd);
      if (cmd.slice(-3).toLowerCase() === 'cmd') {
        cmdSrc = kit.fs.readFileSync(cmd, 'utf8');
        m = cmdSrc.match(/node\s+"%~dp0\\(\.\.\\.+)"/);
        if (m && m[1]) {
          cmd = kit.path.join(cmd, '..', m[1]);
          cmd = kit.path.normalize(cmd);
          args = [cmd].concat(args);
          cmd = 'node';
        }
      }
    }
    spawn = kit.require('child_process', __dirname).spawn;
    ps = null;
    promise = new Promise(function(resolve, reject) {
      var err;
      try {
        ps = spawn(cmd, args, opts);
      } catch (_error) {
        err = _error;
        reject(err);
      }
      ps.on('error', function(err) {
        return reject(err);
      });
      return ps.on('close', function(code, signal) {
        if (code === null || code === 0 || code === 130) {
          return resolve({
            code: code,
            signal: signal
          });
        } else {
          return reject({
            code: code,
            signal: signal
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
  	 * ```coffee
  	 * {
  	 * 	deps: String | Array
  	 * 	description: String
  	 * 	logStart: ->
  	 * 	logEnd: ->
  	 *
  	 * 	# Whether to run dependency in a row.
  	 * 	isSequential: false
  	 * }
  	 * ```
  	 * @param  {Function} fn `(val) -> Promise | Any` The task function.
  	 * If it is a async task, it should return a promise.
  	 * It will get its dependency tasks' resolved values.
  	 * @property {Function} run Use it to start tasks. Each task will only run once.
  	 * `(names = 'default', opts) ->`. The `names` can be a string or array.
  	 * The default opts:
  	 * ```coffee
  	 * {
  	 * 	isSequential: false
  	 *
  	 * 	# Will be passed as the first task's argument.
  	 * 	init: undefined
  	 *
  	 * 	# To stop the run currently in process. Set the `$stop`
  	 * 	# reference to true. It will reject a "runStopped" error.
  	 * 	warp: { $stop: false }
  	 * }
  	 * ```
  	 * @property {Object} list The defined task functions.
  	 * @return {Promise} Resolve with the last task's resolved value.
  	 * When `isSequential == true`, it resolves a value, else it resolves
  	 * an array.
  	 * @example
  	 * ```coffee
  	 * kit.task 'default', { deps: 'build' }, ->
  	 * 	kit.log 'run defaults...'
  	 *
  	 * kit.task 'build', { deps: ['clean'] }, (isFull) ->
  	 * 	if isFull
  	 * 		'do something'
  	 * 	else
  	 * 		'do something else'
  	 *
  	 * kit.task 'clean', (opts) ->
  	 * 	if opts.isForce
  	 * 		kit.remove 'dist/**', { isForce: true }
  	 * 	else
  	 * 		kit.remove 'dist/**'
  	 *
  	 * kit.task.run()
  	 * .then ->
  	 * 	kit.log 'All Done!'
  	 * ```
   */
  task: function(name, opts, fn) {
    var base, base1, cs, runTask;
    cs = require('colors/safe');
    if (_.isFunction(opts)) {
      fn = opts;
      opts = {};
    }
    _.defaults(opts, {
      isSequential: false,
      description: '',
      logStart: function() {
        return kit.log(cs.cyan('Task Start >> ') + cs.green("[" + name + "] ") + this.description);
      },
      logEnd: function() {
        return kit.log(cs.cyan('Task Done >> ') + cs.green("[" + name + "] ") + this.description);
      }
    });
    if (_.isString(opts.deps)) {
      opts.deps = [opts.deps];
    }
    if ((base = kit.task).list == null) {
      base.list = {};
    }
    runTask = function(warp) {
      return function(name) {
        return function(val) {
          if (warp[name]) {
            return warp[name];
          } else {
            return warp[name] = kit.task.list[name](warp)(val);
          }
        };
      };
    };
    kit.task.list[name] = function(warp) {
      return function(val) {
        var depTasks, p;
        if (warp.$stop) {
          return Promise.reject(new Error('runStopped'));
        }
        opts.logStart();
        p = (!opts.deps || opts.deps.length < 1 ? Promise.resolve(val) : (depTasks = opts.deps.map(runTask(warp)), opts.isSequential ? kit.flow(depTasks)(val) : Promise.all(depTasks.map(function(task) {
          return task(val);
        })))).then(fn);
        p.then(opts.logEnd.bind(opts))["catch"](function() {});
        return p;
      };
    };
    kit.task.list[name].opts = opts;
    return (base1 = kit.task).run != null ? base1.run : base1.run = function(names, opts) {
      var task;
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
        init: void 0,
        warp: {
          $stop: false
        }
      });
      task = runTask(opts.warp);
      if (opts.isSequential) {
        return kit.flow(names.map(task))(opts.init);
      } else {
        return Promise.all(names.map(function(name) {
          return task(name)(opts.init);
        }));
      }
    };
  },

  /**
  	 * The `url` module of [io.js](iojs.org).
  	 * You must `kit.require 'url'` before using it.
   */
  url: null,

  /**
  	 * Works much like `gulp.src`, but with Promise instead.
  	 * The warp control and error handling is more pleasant.
  	 * @param  {String} from Glob pattern string.
  	 * @param  {Object} opts It extends the options of `nofs.glob`, but
  	 * with some extra proptereis. Defaults:
  	 * ```coffee
  	 * {
  	 * 	# The base directory of the pattern.
  	 * 	baseDir: String
  	 * }
  	 * ```
  	 * @return {Object} The returned warp object has these members:
  	 * ```coffee
  	 * {
  	 * 	# The drive can also be a promise that will resolve a drive.
  	 * 	load: (drive) -> fileInfo | null
  	 *
  	 * 	run: (path) -> Promise
  	 * }
  	 * ```
  	 * Each piped drive will recieve a
  	 * object that extends `nofs`'s fileInfo object:
  	 * ```coffee
  	 * {
  	 * 	# Set the contents and return self.
  	 * 	set: (String | Buffer) -> fileInfo
  	 *
  	 * 	# The src file path.
  	 * 	path: String
  	 *
  	 * 	# The dest root path.
  	 * 	to: String
  	 *
  	 * 	baseDir: String
  	 *
  	 * 	# The destination path.
  	 * 	# Alter it if you want to change the output file's location.
  	 * 	# You can set it to string, warp will auto-convert it to object.
  	 * 	# It's "valueOf" will return "kit.path.join dir, name + ext".
  	 * 	dest: { root, dir, base, ext, name }
  	 *
  	 * 	# The file content.
  	 * 	contents: String | Buffer
  	 *
  	 * 	isDir: Boolean
  	 *
  	 * 	stats: fs.Stats
  	 *
  	 * 	# Alter it to control the left drives dynamically.
  	 * 	drives: [Function]
  	 *
  	 * 	# All the globbed files.
  	 * 	list: Array
  	 *
  	 * 	driveList: Array
  	 *
  	 * 	# The opts you passed to "kit.warp", it will be extended.
  	 * 	opts: Object
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
  	 * ```coffee
  	 * # Define a simple workflow.
  	 * kit.warp 'src/**\/*.js'
  	 * .load (fileInfo) ->
  	 * 	fileInfo.set '/* Lisence Info *\/' + fileInfo.contents
  	 * .load jslint()
  	 * .load minify()
  	 * .run 'build/minified'
  	 *
  	 * # Override warp's file reader with a custom one.
  	 * myReader = kit._.extend (fileInfo) ->
  	 * 	# Note that we can also use "@path",
  	 * 	# its the same with "fileInfo.path" here.
  	 * 	kit.readFile @path, 'hex'
  	 * 	.then @set
  	 * , {
  	 * 	# This will tell warp you want use your own reader.
  	 * 	isReader: true
  	 * }
  	 *
  	 * # Override writer.
  	 * myWriter = kit._.extend (fileInfo) ->
  	 * 	return if @dest == 'a.js'
  	 *
  	 * 	# Call the overrided writer.
  	 * 	@super()
  	 * , isWriter: true, onEnd: -> @super()
  	 * 	kit.log @list
  	 *
  	 * kit.warp 'src/**\/*.js'
  	 * .load myWriter
  	 * .run 'dist'
  	 *
  	 * # Use nokit's built-in warp drives.
  	 * drives = kit.require 'drives'
  	 * kit.warp src/**\/*.coffee'
  	 * .load drives.coffee()
  	 * .run 'dist'
  	 * ```
   */
  warp: function(from, opts) {
    var driveList, drives, initInfo, reader, runDrive, warpper, writer;
    if (opts == null) {
      opts = {};
    }
    drives = kit.require('drives');
    driveList = [];
    reader = drives.reader();
    writer = drives.writer();
    runDrive = function(drive) {
      return function(info) {
        var run;
        run = function(drive) {
          if (_.isString(info.dest)) {
            info.dest = _.extend(kit.path.parse(info.dest), {
              valueOf: function() {
                return kit.path.join(this.dir, this.name + this.ext);
              }
            });
          }
          if (drive["super"]) {
            info["super"] = function() {
              return runDrive(drive["super"])(info);
            };
          }
          return Promise.resolve(drive.call(info, info)).then(function(val) {
            return info;
          });
        };
        if (_.isFunction(drive.then)) {
          return drive.then(run);
        } else {
          return run(drive);
        }
      };
    };
    initInfo = function(info) {
      if (opts.baseDir) {
        info.baseDir = opts.baseDir;
      }
      if (info.path != null) {
        info.dest = kit.path.join(info.to, kit.path.relative(info.baseDir, info.path));
      }
      return _.extend(info, {
        driveList: driveList,
        opts: opts,
        set: function(contents) {
          return info.contents = contents;
        }
      });
    };
    return warpper = {
      load: function(drive) {
        if (drive.isReader || drive.isWriter) {
          if (drive.isWriter) {
            drive["super"] = writer;
            drive.onEnd["super"] = writer.onEnd;
            writer = drive;
          }
          if (drive.isReader) {
            drive["super"] = reader;
            reader = drive;
          }
        } else {
          driveList.push(drive);
        }
        return warpper;
      },
      run: function(to) {
        var globOpts;
        if (to == null) {
          to = '.';
        }
        driveList.unshift(reader);
        driveList.push(writer);
        globOpts = _.extend({}, opts, {
          iter: function(info, list) {
            list.push(info);
            if (opts.baseDir) {
              info.baseDir = opts.baseDir;
            }
            _.extend(info, {
              drives: _.clone(driveList),
              to: to,
              list: list
            });
            return kit.flow(function() {
              var drive;
              drive = info.drives.shift();
              if (drive) {
                return runDrive(drive);
              } else {
                return kit.end;
              }
            })(initInfo(info));
          }
        });
        return kit.glob(from, globOpts).then(function(list) {
          return Promise.all(driveList.map(function(drive) {
            if (!drive.onEnd) {
              return;
            }
            return runDrive(drive.onEnd)(initInfo({
              to: to,
              list: list
            }));
          }));
        });
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
  	 * ```coffee
  	 * { colors: true, depth: 5 }
  	 * ```
  	 * @return {String}
   */
  xinspect: function(obj, opts) {
    var str, util;
    if (opts == null) {
      opts = {};
    }
    util = kit.require('util', __dirname);
    _.defaults(opts, {
      colors: kit.isDevelopment(),
      depth: 5
    });
    return str = util.inspect(obj, opts);
  },

  /**
  	 * Open a thing that your system can recognize.
  	 * Now only support Windows, OSX or system that installed 'xdg-open'.
  	 * @param  {String | Array} cmds  The thing you want to open.
  	 * @param  {Object} opts The options of the node native
  	 * `child_process.exec`.
  	 * @return {Promise} When the child process exists.
  	 * @example
  	 * ```coffee
  	 * # Open a webpage with the default browser.
  	 * kit.open 'http://ysmood.org'
  	 * ```
   */
  xopen: function(cmds, opts) {
    if (opts == null) {
      opts = {};
    }
    return (Promise.resolve((function() {
      switch (process.platform) {
        case 'darwin':
          return 'open';
        case 'win32':
          return 'start';
        default:
          try {
            kit.require('which');
            return kit.which('xdg-open');
          } catch (_error) {
            return null;
          }
      }
    })())).then(function(starter) {
      if (!starter) {
        return;
      }
      if (_.isString(cmds)) {
        cmds = [cmds];
      }
      return kit.spawn(starter, cmds);
    });
  }
});

module.exports = kit;
