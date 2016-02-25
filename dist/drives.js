var Overview, Promise, _, br, jhash, kit;

kit = require('./kit');

_ = kit._, Promise = kit.Promise;

br = kit.require('brush');

jhash = null;


/**
 * The built-in plguins for warp. It's more like examples
 * to show how to use nokit efficiently.
 */

Overview = 'drives';

module.exports = {

  /**
   * clean-css
   * @param  {Object} opts
   * @return {Function}
   */
  cleanCss: _.extend(function(opts) {
    var clean;
    if (opts == null) {
      opts = {};
    }
    clean = kit.requireOptional('clean-css', __dirname);
    return function() {
      this.deps = [this.path];
      this.set((new clean(opts).minify(this.contents)).styles);
      return kit.log(br.cyan('clean css: ') + this.dest);
    };
  }, {
    compress: ['.css']

    /**
     * coffee-script compiler
     * @param  {Object} opts Default is `{ bare: true }`.
     * @return {Function}
     */
  }),
  coffee: _.extend(function(opts) {
    var coffee;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      bare: true
    });
    coffee = kit.requireOptional('coffee-script', __dirname, '>=1.8.0');
    return function() {
      var err, error;
      opts.filename = this.path;
      this.deps = [this.path];
      this.dest.ext = '.js';
      try {
        this.set(coffee.compile(this.contents + '', opts));
        return kit.log(br.cyan('coffee: ') + this.path);
      } catch (error) {
        err = error;
        kit.err(br.red(err.stack));
        return Promise.reject('coffeescriptCompileError');
      }
    };
  }, {
    compile: ['.coffee']

    /**
     * coffeelint processor
     * @param  {Object} opts It extends the default config
     * of coffeelint, properties:
     * ```js
     * {
     *  colorize: true,
     *  reporter: 'default',
     *
     *  // The json of the "coffeelint.json".
     *  // If it's null, coffeelint will try to find
     *  // "coffeelint.json" as its content.
     *  config: null | JSON | JsonFilePath
     * }
     * ```
     * @return {Function}
     */
  }),
  coffeelint: _.extend(function(opts) {
    var Reporter, coffeelint, configfinder;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      colorize: true,
      reporter: 'default'
    });
    coffeelint = kit.requireOptional('coffeelint', __dirname);
    if (!opts.config) {
      configfinder = require('coffeelint/lib/configfinder');
      opts.config = configfinder.getConfig();
    }
    if (_.isString(opts.config)) {
      opts.config = kit.readJsonSync(opts.config);
    }
    Reporter = require('coffeelint/lib/reporters/' + opts.reporter);
    return function() {
      var errorReport, errors, path, ref, reporter;
      this.deps = [this.path];
      errorReport = new coffeelint.getErrorReport();
      errorReport.lint(this.path, this.contents, opts.config);
      reporter = new Reporter(errorReport, opts);
      ref = errorReport.paths;
      for (path in ref) {
        errors = ref[path];
        kit.log(br.cyan('coffeelint: ') + _.trim(reporter.reportPath(path, errors)));
        if (errors.length > 0) {
          return Promise.reject(errors[0]);
        }
      }
    };
  }, {
    lint: ['.coffee']

    /**
     * Parse commment from a js, coffee, or livescript file,
     * and output a markdown string.
     * @param  {String} path
     * @param  {Object} opts Defaults:
     * ```js
     * {
     *  // Output doc path.
     *  out: 'readme.md',
     *
     *  // jst template path.
     *  tpl: 'readme.jst.md',
     *
     *  // Init doc info.
     *  doc: {},
     *
     *  // Header size.
     *  h: 3,
     *
     *  parseComment: () => {},
     *  formatComment: () => {}
     * }
     * ```
     * @return {Function}
     * @example
     * The nofile of nokit shows how to use it.
     */
  }),
  comment2md: function(opts) {
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      out: 'readme.md',
      tpl: 'readme.jst.md',
      doc: {},
      h: 3,
      parseComment: {},
      formatComment: {}
    });
    return _.extend(function(file) {
      var comments, toc;
      toc = [];
      opts.formatComment.name = function(arg) {
        var line, link, name, tocName;
        name = arg.name, line = arg.line;
        name = name.replace('self.', '');
        tocName = name.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]/g, '');
        toc.push("  - [" + name + "](#" + tocName + ")");
        link = file.path + "?source#L" + line;
        return "- " + (_.repeat('#', opts.h)) + " **[" + name + "](" + link + ")**\n\n";
      };
      comments = kit.parseComment(this.contents + '', opts.parseComment);
      opts.doc[this.path] = kit.formatComment(comments, opts.formatComment);
      return opts.doc[this.path + '-toc'] = toc.join('\n');
    }, {
      isWriter: true,
      onEnd: function(file) {
        if (_.keys(opts.doc).length < this.list.length) {
          return;
        }
        this.deps = _.map(this.list, 'path');
        this.deps.push(opts.tpl);
        this.dest = kit.path.join(this.to, opts.out);
        return kit.readFile(opts.tpl, 'utf8').then(function(tpl) {
          return file.set(_.template(tpl)({
            doc: opts.doc
          }));
        }).then(function() {
          kit.log(br.cyan('comment2md: ') + kit.path.join(file.to, opts.out));
          return file["super"]();
        });
      }
    });
  },

  /**
   * Auto-compiler file by extension. It will search through
   * `kit.drives`, and find proper drive to run the task.
   * You can extend `kit.drives` to let it support more.
   * For example:
   * ```js
   * kit.drives.myCompiler = kit._.extend(() => {
   *     // your compile logic
   * }), { compiler: ['.jsx'] })
   * ```
   * @param {String} action By default, it can be
   * 'compile' or 'compress' or 'lint'
   * @param  {Object} opts
   * ```js
   * {
   *  // If no compiler match.
   *  onNotFound: (fileInfo) => {}
   * }
   * ```
   * @return {Function}
   */
  auto: function(action, opts) {
    var _str, auto, compilers, list;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      onNotFound: function() {}
    });
    list = _(kit.drives).map(action).compact().flatten().value().join(' ');
    kit.log(br.green(action + ": ") + ("[ " + list + " ]"));
    compilers = {};
    auto = function() {
      var d, ext;
      ext = this.dest.ext.toLowerCase();
      if (!compilers[ext]) {
        d = _.find(kit.drives, function(drive) {
          return drive[action] && drive[action].indexOf(ext) > -1;
        });
        if (d) {
          compilers[ext] = d(opts[ext]);
        } else {
          return opts.onNotFound.call(this, this);
        }
      }
      return this.drives.unshift(compilers[ext]);
    };
    _str = auto.toString;
    auto.toString = function() {
      var hash;
      hash = _str.call(auto);
      return hash += JSON.stringify(opts);
    };
    return auto;
  },

  /**
   * Change dest path with a filter.
   * @param  {String} dir
   * @param  {Function} filter `(fileInfo, dir) -> Boolean`
   * @return {Function}
   */
  changeDir: function(dir, filter) {
    return function(f) {
      if (filter != null) {
        if (filter(f, dir)) {
          f.dest.dir = dir;
        }
        return;
      }
      return f.dest.dir = dir;
    };
  },

  /**
   * a batch file concat helper
   * @param {String} name The output file path.
   * @param {String} dir Optional. Override the dest of warp's.
   * @return {Function}
   */
  concat: function(name, dir) {
    var all;
    all = [];
    return _.extend(function() {
      all.push(this.contents);
      return kit.log(br.cyan('concat: ') + this.path);
    }, {
      isWriter: true,
      onEnd: function() {
        if (all.length < this.list.length) {
          return;
        }
        if (dir == null) {
          dir = this.to;
        }
        this.dest = kit.path.join(dir, name);
        this.deps = _.map(this.list, 'path');
        this.set(all.join('\n'));
        return this["super"]();
      }
    });
  },

  /**
   * Suffix file name with the hash value of file content.
   * @param  {String} hashMapPath The output file name hash map.
   * @return {Function}
   */
  hashSuffix: function(hashMapPath) {
    var map;
    jhash = kit.require('jhash');
    jhash.setSymbols('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
    map = {};
    return _.assign(function(f) {
      var src;
      src = f.dest + '';
      f.dest.name += '.' + jhash.hash(f.contents);
      return map[src] = f.dest + '';
    }, {
      onEnd: function() {
        return kit.outputJson(hashMapPath, map);
      }
    });
  },

  /**
   * Lint js via `jshint`.
   * @param  {Object} opts Properties:
   * ```js
   * {
   *  global: null,
   *  config: null | JSON | JsonFilePath
   * }
   * ```
   * @return {Function}
   */
  jshint: _.extend(function(opts) {
    var JSHINT, jshint;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {});
    JSHINT = kit.requireOptional('jshint', __dirname).JSHINT;
    jshint = function(file) {
      var errs;
      this.deps = [this.path];
      if (JSHINT(this.contents, opts.config, opts.global)) {
        kit.log(br.cyan('jshint: ') + this.path);
        return;
      }
      errs = '';
      JSHINT.errors.forEach(function(err) {
        if (err) {
          return errs += "\nJshint " + (br.red(err.id)) + ": " + file.path + ":" + err.line + ":" + err.character + "\n\"" + (br.cyan(err.evidence)) + "\"\n" + (br.yellow(err.reason)) + "\n------------------------------------";
        }
      });
      return Promise.reject(errs);
    };
    return Promise.resolve(_.isString(opts.config) ? kit.prop(opts, 'config', kit.readJson(opts.config)) : void 0).then(function() {
      return jshint;
    });
  }, {
    lint: ['.js']

    /**
     * Compile less.
     * @param  {Object}
     * @return {Function}
     */
  }),
  less: _.extend(function(opts) {
    var less;
    if (opts == null) {
      opts = {};
    }
    less = kit.requireOptional('less', __dirname, '>=2.5.1');
    return function(file) {
      this.dest.ext = '.css';
      opts.filename = this.path;
      return less.render(this.contents + '', opts).then(function(output) {
        file.deps = [file.path].concat(output.imports);
        file.set(output.css);
        return kit.log(br.cyan('less: ') + file.path);
      }, function(err) {
        var ref;
        if (err.line == null) {
          return Promise.reject(err);
        }
        err.message = err.filename + (":" + err.line + ":" + err.column + "\n") + ((ref = err.extract) != null ? ref.join('\n') : void 0) + '\n--------\n' + err.message;
        return Promise.reject(err);
      });
    };
  }, {
    compile: ['.less']

    /**
     * LiveScript compiler.
     * @param  {Object} opts Default is `{ bare: true }`.
     * @return {Function}
     */
  }),
  livescript: _.extend(function(opts) {
    var LiveScript;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      bare: true
    });
    LiveScript = kit.requireOptional('LiveScript', __dirname, '>=1.2.0');
    return function() {
      var err, error;
      this.deps = [this.path];
      opts.filename = this.path;
      this.dest.ext = '.js';
      try {
        this.set(LiveScript.compile(this.contents + '', opts));
        return kit.log(br.cyan('livescript: ') + this.path);
      } catch (error) {
        err = error;
        kit.err(br.red(err));
        return Promise.reject('livescriptCompileError');
      }
    };
  }, {
    compile: ['.ls']

    /**
     * read file and set `contents`
     * @param  {Object} opts Defaults:
     * ```js
     * {
     *  isCache: false,
     *  encoding: 'utf8',
     *  cacheDir: '.nokit/warp'
     * }
     * ```
     * @return {Function}
     */
  }),
  reader: function(opts) {
    var hashDrives, read;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      isCache: false,
      encoding: 'utf8',
      cacheDir: '.nokit/warp'
    });
    if (jhash == null) {
      jhash = new (kit.require('jhash').constructor);
    }
    hashDrives = function(ds) {
      var str;
      str = _.map(ds, function(d) {
        return d.toString();
      }).join();
      return jhash.hash(str, true) + '';
    };
    read = function() {
      return kit.readFile(this.path, opts.encoding).then(this.set);
    };
    return _.extend(function(file) {
      if (!this.list.cacheDir) {
        this.list.isCache = opts.isCache;
        this.list.cacheDir = kit.path.join(opts.cacheDir, hashDrives(this.driveList));
      }
      if (this.isDir) {
        return;
      }
      if (opts.isCache) {
        return kit.depsCache({
          deps: [this.path],
          cacheDir: this.list.cacheDir
        }).then(function(cache) {
          file.deps = cache.deps;
          if (cache.isNewer) {
            kit.log(br.green('reader cache: ') + file.deps.join(br.grey(', ')));
            file.drives.length = 0;
            return Promise.all(_.map(cache.dests, function(cachePath, dest) {
              return kit.mkdirs(kit.path.dirname(dest)).then(function() {
                return kit.link(cachePath, dest)["catch"](function(err) {
                  if (err.code !== 'EEXIST') {
                    return Promise.reject(err);
                  }
                });
              });
            }));
          } else {
            return read.call(file);
          }
        });
      } else {
        return read.call(file);
      }
    }, {
      isReader: true
    });
  },

  /**
   * Compile stylus.
   * @param  {Object} opts It will use `stylus.set` to
   * iterate `opts` and set the key-value, is the value is
   * not a function.
   * ```js
   * {
   *  config: (styl) => {}
   * }
   * ```
   * @return {Function}
   * @example
   * ```js
   * kit.drives.stylus({
   *  compress: true,
   *  config: (styl) =>
   *      styl.define('jack', 'a persion')
   * });
   * ```
   */
  stylus: _.extend(function(opts) {
    var stylus;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      config: function() {}
    });
    stylus = kit.requireOptional('stylus', __dirname);
    return function(file) {
      var k, styl, v;
      this.dest.ext = '.css';
      styl = stylus(this.contents).set('filename', this.path);
      for (k in opts) {
        v = opts[k];
        if (_.isFunction(v)) {
          continue;
        }
        styl.set(k, v);
      }
      opts.config.call(this, styl);
      return kit.promisify(styl.render, styl)().then(function(css) {
        file.deps = [file.path].concat(styl.deps());
        file.set(css);
        return kit.log(br.cyan('stylus: ') + file.path);
      });
    };
  }, {
    compile: ['.styl']

    /**
     * uglify-js processor
     * @param  {Object} opts Defaults:
     * ```js
     * {
     *     output: {
     *         comments: (node, comment) => {
     *             let text = comment.value;
     *             let type = comment.type;
     *             if (type === "comment2")
     *                 return /@preserve|@license|@cc_on/i.test(text);
     *         }
     *     }
     * }
     * ```
     * @return {Function}
     */
  }),
  uglifyjs: _.extend(function(opts) {
    var uglify;
    if (opts == null) {
      opts = {};
    }
    uglify = kit.requireOptional('uglify-js', __dirname, '>=2.0.0');
    opts.fromString = true;
    if (opts.output == null) {
      opts.output = {
        comments: function(node, comment) {
          var text, type;
          text = comment.value;
          type = comment.type;
          if (type === "comment2") {
            return /@preserve|@license|@cc_on/i.test(text);
          }
        }
      };
    }
    return function() {
      var err, error;
      this.deps = [this.path];
      try {
        kit.log(br.cyan('uglifyjs: ') + this.dest);
        return this.set((uglify.minify(this.contents + '', opts)).code);
      } catch (error) {
        err = error;
        return kit.logs(br.cyan('uglifyjs err:'), this.path, err.message);
      }
    };
  }, {
    compress: ['.js']

    /**
     * Output file by `contents` and `dest`.
     * If the 'ext' or 'name' is not null,
     * the 'base' will be override by the 'ext' and 'name'.
     * @return {Function}
     */
  }),
  writer: function() {
    var write;
    write = function(file) {
      var contents, dest;
      dest = this.dest, contents = this.contents;
      if ((dest == null) || (contents == null)) {
        return;
      }
      kit.log(br.cyan('writer: ') + this.dest);
      return kit.outputFile(dest + '', contents, this.opts).then(function() {
        if (!file.list.isCache) {
          return;
        }
        kit.log(br.cyan('writer cache: ') + file.dest);
        return kit.depsCache({
          dests: file.dests || [file.dest + ''],
          deps: file.deps || [file.path],
          cacheDir: file.list.cacheDir
        });
      });
    };
    return _.extend(write, {
      isWriter: true,
      onEnd: write
    });
  }
};
