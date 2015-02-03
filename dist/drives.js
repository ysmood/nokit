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
      this.dest.ext = '.js';
      try {
        this.set(coffee.compile(this.contents + '', opts));
        return kit.log(cls.cyan('compile coffee: ') + this.path);
      } catch (_error) {
        err = _error;
        kit.err(cls.red(err.stack));
        return Promise.reject('coffeescriptCompileError');
      }
    };
  }, {
    extensions: ['.coffee']
  }),

  /**
  	 * coffeelint processor
  	 * @param  {Object} opts Default is `{ colorize: true }`.
  	 * @return {Function}
   */
  coffeelint: function(opts) {
    var Reporter, coffeelint, configfinder;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      colorize: true
    });
    coffeelint = kit.requireOptional('coffeelint', __dirname);
    if (!opts.config) {
      configfinder = require('coffeelint/lib/configfinder');
      opts.config = configfinder.getConfig();
    }
    Reporter = require('coffeelint/lib/reporters/default');
    return function() {
      var errorReport, errors, path, reporter, _ref;
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
  },

  /**
  	 * Parse commment from a js or coffee file, and output a markdown string.
  	 * @param  {String} path
  	 * @param  {Object} opts Defaults:
  	 * ```coffee
  	 * {
  	 * 	parseComment: {}
  	 * 	formatComment: {
  	 * 		name: ({ name, line }) ->
  	 * 			name = name.replace 'self.', ''
  	 * 			link = "#{path}?source#L#{line}"
  	 * 			"- \#\#\# **[#{name}](#{link})**\n\n"
  	 * 	}
  	 * }
  	 * ```
  	 * @return {Function}
   */
  comment2md: function(opts) {
    var doc;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      out: 'readme.md',
      tpl: 'readme.tpl.md',
      h: 3,
      parseComment: {},
      formatComment: {}
    });
    doc = {};
    return _.extend(function(file) {
      var comments;
      opts.formatComment.name = function(_arg) {
        var line, link, name;
        name = _arg.name, line = _arg.line;
        name = name.replace('self.', '');
        link = file.path + "?source#L" + line;
        return "- " + (_.repeat('#', opts.h)) + " **[" + name + "](" + link + ")**\n\n";
      };
      comments = kit.parseComment(this.contents, opts.parseComment);
      doc[this.path] = kit.formatComment(comments, opts.formatComment);
      return this.end();
    }, {
      onEnd: function(file) {
        this.dest = kit.path.join(this.to, opts.out);
        return kit.readFile(opts.tpl, 'utf8').then(function(tpl) {
          return file.set(_.template(tpl)({
            doc: doc
          }));
        });
      }
    });
  },

  /**
  	 * Auto-compiler file by extension.
  	 * Supports: `.coffee`, `.ls`
  	 * @param  {Object} opts
  	 * @return {Function}
   */
  compiler: function(opts) {
    var compilers;
    if (opts == null) {
      opts = {};
    }
    compilers = {};
    return function() {
      var d, ext;
      ext = this.xpath.ext.toLowerCase();
      if (!compilers[ext]) {
        d = _.find(kit.drives, function(drive) {
          return drive.extensions.indexOf(ext) > -1;
        });
        if (d) {
          compilers[ext] = d(opts[ext]);
        } else {
          return Promise.reject(new Error("no drive can match extension: '" + ext + "'"));
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
      all += this.contents;
      return this.end();
    }, {
      onEnd: function() {
        if (dir == null) {
          dir = this.to;
        }
        this.dest = kit.path.join(dir, name);
        return this.set(all);
      }
    });
  },

  /**
  	 * livescript compiler
  	 * @param  {Object} opts Default is `{ bare: true }`.
  	 * @return {Function}
   */
  livescript: _.extend(function(opts) {
    var Livescript;
    if (opts == null) {
      opts = {};
    }
    _.defaults(opts, {
      bare: true
    });
    Livescript = kit.requireOptional('Livescript', __dirname, '>=1.2.0');
    return function() {
      var err;
      opts.filename = this.path;
      this.dest.ext = '.js';
      try {
        this.set(Livescript.compile(this.contents + '', opts));
        return kit.log(cls.cyan('livescript coffee: ') + this.path);
      } catch (_error) {
        err = _error;
        kit.err(cls.red(err));
        return Promise.reject('livescriptCompileError');
      }
    };
  }, {
    extensions: ['.ls']
  }),

  /**
  	 * read file and set `contents`
   */
  reader: function() {
    return (this.isDir ? Promise.resolve() : kit.readFile(this.path, this.opts.encoding)).then(this.set);
  },

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
  uglify: function(opts) {
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
      return this.set((uglify.minify(this.contents, opts)).code);
    };
  },

  /**
  	 * output file by `contents` and `dest`
   */
  writer: function() {
    var contents, dest;
    dest = this.dest, contents = this.contents;
    if ((dest != null) && (contents != null)) {
      if (_.isObject(dest)) {
        if ((dest.name != null) && (dest.ext != null)) {
          dest.base = dest.name + dest.ext;
        }
        dest = kit.path.format(dest);
      }
      kit.log(cls.cyan('writer: ') + dest);
      return kit.outputFile(dest, contents, this.opts);
    }
  }
};
