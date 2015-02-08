var Overview, Promise, cls, kit, _;

kit = require('./kit');

_ = kit._, Promise = kit.Promise;

cls = kit.require('colors/safe');


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
      return kit.log(cls.cyan('clean css: ') + this.dest);
    };
  }, {
    compress: ['.css']
  }),

  /**
  	 * coffee-script compiler
  	 * @param  {Object} opts Default is `{ bare: true }`.
  	 * @return {Function}
   */
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
      var err;
      opts.filename = this.path;
      this.deps = [this.path];
      this.dest.ext = '.js';
      try {
        this.set(coffee.compile(this.contents + '', opts));
        return kit.log(cls.cyan('coffee: ') + this.path);
      } catch (_error) {
        err = _error;
        kit.err(cls.red(err.stack));
        return Promise.reject('coffeescriptCompileError');
      }
    };
  }, {
    compile: ['.coffee']
  }),

  /**
  	 * coffeelint processor
  	 * @param  {Object} opts It extends the default config
  	 * of coffeelint, properties:
  	 * ```coffee
  	 * {
  	 * 	colorize: true
  	 * 	reporter: 'default'
  	 *
  	 * 	# The json of the "coffeelint.json".
  	 * 	# If it's null, coffeelint will try to find
  	 * 	# "coffeelint.json" as its content.
  	 * 	config: null | JSON | JsonFilePath
  	 * }
  	 * ```
  	 * @return {Function}
   */
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
      var errorReport, errors, path, reporter, _ref;
      this.deps = [this.path];
      errorReport = new coffeelint.getErrorReport();
      errorReport.lint(this.path, this.contents, opts.config);
      reporter = new Reporter(errorReport, opts);
      _ref = errorReport.paths;
      for (path in _ref) {
        errors = _ref[path];
        kit.log(cls.cyan('coffeelint: ') + _.trim(reporter.reportPath(path, errors)));
        if (errors.length > 0) {
          return Promise.reject(errors[0]);
        }
      }
    };
  }, {
    lint: ['.coffee']
  }),

  /**
  	 * Parse commment from a js, coffee, or livescript file,
  	 * and output a markdown string.
  	 * @param  {String} path
  	 * @param  {Object} opts Defaults:
  	 * ```coffee
  	 * {
  	 * 	# Output doc path.
  	 * 	out: 'readme.md'
  	 *
  	 * 	# jst template path.
  	 * 	tpl: 'readme.jst.md'
  	 *
  	 * 	# Init doc info.
  	 * 	doc: {}
  	 *
  	 * 	# Header size.
  	 * 	h: 3
  	 *
  	 * 	parseComment: -> ...
  	 * 	formatComment: -> ...
  	 * }
  	 * ```
  	 * @return {Function}
  	 * @example
  	 * The nofile of nokit shows how to use it.
   */
  comment2md: function(opts) {
    var cache;
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
    cache = null;
    return _.extend(function(file) {
      var comments, writer;
      if (this.isWarpEnd) {
        writer = kit.drives.writer(opts);
        if (cache) {
          _.extend(this, cache);
          return writer.call(this, this);
        }
        this.deps = _.pluck(this.list, 'path');
        this.dest = kit.path.join(this.to, opts.out);
        return kit.readFile(opts.tpl, 'utf8').then(function(tpl) {
          return file.set(_.template(tpl)({
            doc: opts.doc
          }));
        }).then(function() {
          kit.log(cls.cyan('comment2md: ') + kit.path.join(file.to, opts.out));
          return writer.call(file, file);
        });
      }
      if (cache) {
        return;
      }
      if (this.isFromCache) {
        return cache = this;
      }
      opts.formatComment.name = function(_arg) {
        var line, link, name;
        name = _arg.name, line = _arg.line;
        name = name.replace('self.', '');
        link = file.path + "?source#L" + line;
        return "- " + (_.repeat('#', opts.h)) + " **[" + name + "](" + link + ")**\n\n";
      };
      comments = kit.parseComment(this.contents + '', opts.parseComment);
      return opts.doc[this.path] = kit.formatComment(comments, opts.formatComment);
    }, {
      isWriter: true,
      isHandleCache: true
    });
  },

  /**
  	 * Auto-compiler file by extension. It will search through
  	 * `kit.drives`, and find proper drive to run the task.
  	 * You can extend `kit.drives` to let it support more.
  	 * For example:
  	 * ```coffee
  	 * kit.drives.myCompiler = kit._.extend ->
  	 * 	# your compile logic
  	 * , compiler: ['.jsx']
  	 * ```
  	 * @param {String} action By default, it can be
  	 * 'compile' or 'compress' or 'lint'
  	 * @param  {Object} opts
  	 * ```coffee
  	 * {
  	 * 	# If no compiler match.
  	 * 	onNotFound: (fileInfo) ->
  	 * }
  	 * ```
  	 * @return {Function}
   */
  auto: function(action, opts) {
    var compilers, list;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      onNotFound: function() {}
    });
    list = _(kit.drives).map(action).compact().flatten().value().join(' ');
    kit.log(cls.green(action + ": ") + ("[ " + list + " ]"));
    compilers = {};
    return function() {
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
      return compilers[ext].call(this, this);
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
    all = '';
    return _.extend(function() {
      if (this.isWarpEnd) {
        if (dir == null) {
          dir = this.to;
        }
        this.dest = kit.path.join(dir, name);
        this.deps = _.pluck(this.list, 'path');
        this.set(all);
        return kit.drives.writer(this.opts).call(this, this);
      } else {
        all += this.contents + '\n';
        return kit.log(cls.cyan('concat: ') + this.path);
      }
    }, {
      isWriter: true
    });
  },

  /**
  	 * Lint js via `jshint`.
  	 * @param  {Object} opts Properties:
  	 * ```coffee
  	 * {
  	 * 	global: null
  	 * 	config: null | JSON | JsonFilePath
  	 * }
  	 * ```
  	 * @return {Function}
   */
  jshint: _.extend(function(opts) {
    var JSHINT;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {});
    JSHINT = kit.requireOptional('jshint', __dirname).JSHINT;
    if (_.isString(opts.config)) {
      opts.config = kit.readJsonSync(opts.config);
    }
    return function(file) {
      var errs;
      this.deps = [this.path];
      if (JSHINT(this.contents, opts.config, opts.global)) {
        kit.log(cls.cyan('jshint: ') + this.path);
        return;
      }
      errs = '';
      JSHINT.errors.forEach(function(err) {
        if (err) {
          return errs += "\nJshint " + (cls.red(err.id)) + ": " + file.path + ":" + err.line + ":" + err.character + "\n\"" + (cls.cyan(err.evidence)) + "\"\n" + (cls.yellow(err.reason)) + "\n------------------------------------";
        }
      });
      return Promise.reject(errs);
    };
  }, {
    lint: ['.js']
  }),

  /**
  	 * Compile less.
  	 * @param  {Object}
  	 * @return {Function}
   */
  less: _.extend(function(opts) {
    var less;
    if (opts == null) {
      opts = {};
    }
    less = kit.requireOptional('less', __dirname, '>=2.0.0');
    return function(file) {
      this.dest.ext = '.css';
      opts.filename = this.path;
      return less.render(this.contents + '', opts).then(function(output) {
        file.deps = _.keys(output.imports);
        file.set(output.css);
        return kit.log(cls.cyan('less: ') + file.path);
      }, function(err) {
        var _ref;
        if (err.line == null) {
          return Promise.reject(err);
        }
        err.message = err.filename + (":" + err.line + ":" + err.column + "\n") + ((_ref = err.extract) != null ? _ref.join('\n') : void 0) + '\n--------\n' + err.message;
        return Promise.reject(err);
      });
    };
  }, {
    compile: ['.less']
  }),

  /**
  	 * LiveScript compiler.
  	 * @param  {Object} opts Default is `{ bare: true }`.
  	 * @return {Function}
   */
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
      var err;
      this.deps = [this.path];
      opts.filename = this.path;
      this.dest.ext = '.js';
      try {
        this.set(LiveScript.compile(this.contents + '', opts));
        return kit.log(cls.cyan('livescript: ') + this.path);
      } catch (_error) {
        err = _error;
        kit.err(cls.red(err));
        return Promise.reject('livescriptCompileError');
      }
    };
  }, {
    compile: ['.ls']
  }),

  /**
  	 * mocha test
  	 * @param  {Object} opts
  	 * ```
  	 * {
  	 * 	timeout: 5000
  	 * }
  	 * ```
  	 * @return {Function}
   */
  mocha: function(opts) {
    var Mocha, mocha;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      timeout: 5000
    });
    Mocha = kit.requireOptional('mocha', __dirname);
    mocha = new Mocha(opts);
    return _.extend(function() {
      if (this.isWarpEnd) {
        return new Promise(function(resolve, reject) {
          return mocha.run(function(code) {
            if (code === 0) {
              return resolve();
            } else {
              return reject({
                code: code
              });
            }
          });
        });
      } else {
        mocha.addFile(this.path);
        return this.tasks.length = 0;
      }
    }, {
      isReader: true,
      isWriter: true
    });
  },

  /**
  	 * read file and set `contents`
  	 * @param  {Object} opts Defaults:
  	 * ```coffee
  	 * {
  	 * 	isCache: true
  	 * 	endcoding: 'utf8'
  	 * }
  	 * ```
  	 * @return {Function}
   */
  reader: function(opts) {
    var read;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      isCache: true,
      encoding: 'utf8'
    });
    read = function() {
      return kit.readFile(this.path, opts.encoding).then(this.set);
    };
    return _.extend(function(file) {
      if (this.isDir) {
        return;
      }
      if (opts.isCache) {
        return kit.depsCache({
          deps: [this.path],
          cacheDir: opts.cacheDir
        }).then(function(cache) {
          file.deps = cache.deps;
          if (cache.contents != null) {
            kit.log(cls.green('reader cache: ') + file.deps.join(cls.grey(', ')));
            file.dest = cache.dest;
            file.isFromCache = true;
            return file.set(cache.contents);
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
  	 * ```coffee
  	 * {
  	 * 	config: (styl) ->
  	 * }
  	 * ```
  	 * @return {Function}
  	 * @example
  	 * ```coffee
  	 * kit.drives.stylus {
  	 * 	compress: true
  	 * 	config: (styl) ->
  	 * 		styl.define 'jack', 'a persion'
  	 * }
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
        file.deps = styl.deps();
        file.set(css);
        return kit.log(cls.cyan('stylus: ') + file.path);
      });
    };
  }, {
    compile: ['.styl']
  }),

  /**
  	 * uglify-js processor
  	 * @param  {Object} opts Defaults:
  	 * ```coffee
  	 * {
  	 * 	output:
  	 * 		comments: (node, comment) ->
  	 * 			text = comment.value
  	 * 			type = comment.type
  	 * 			if type == "comment2"
  	 * 				return /@preserve|@license|@cc_on/i.test text
  	 * }
  	 * ```
  	 * @return {Function}
   */
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
      this.deps = [this.path];
      this.set((uglify.minify(this.contents + '', opts)).code);
      return kit.log(cls.cyan('uglifyjs: ') + this.dest);
    };
  }, {
    compress: ['.js']
  }),

  /**
  	 * Output file by `contents` and `dest`.
  	 * If the 'ext' or 'name' is not null,
  	 * the 'base' will be override by the 'ext' and 'name'.
  	 * @param  {Object} opts Defaults:
  	 * ```coffee
  	 * {
  	 * 	isCache: true
  	 * }
  	 * ```
  	 * @return {Function}
   */
  writer: function(opts) {
    var write;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      isCache: true
    });
    write = function() {
      var contents, dest, p, pCache;
      dest = this.dest, contents = this.contents;
      if ((dest == null) || (contents == null)) {
        return;
      }
      kit.log(cls.cyan('writer: ') + this.dest);
      p = kit.outputFile(dest + '', contents, this.opts);
      if (!opts.isCache || !this.deps || this.isFromCache) {
        return p;
      }
      kit.log(cls.cyan('writer cache: ') + this.dest);
      pCache = kit.depsCache({
        dest: this.dest + '',
        deps: this.deps,
        cacheDir: this.opts.cacheDir,
        contents: this.contents
      });
      return Promise.all([p, pCache]);
    };
    return _.extend(write, {
      isWriter: true,
      isHandleCache: true
    });
  }
};
