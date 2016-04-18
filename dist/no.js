
/*
	A simplified version of Make.
 */
var _, br, cmder, error, getOptions, kit, loadNofile, searchTasks, task;

if (process.env.NODE_ENV == null) {
  process.env.NODE_ENV = 'development';
}

kit = require('./kit');

br = kit.require('brush');

_ = kit._;

cmder = require('commander');

error = function(msg) {
  var err;
  err = new Error(msg);
  err.source = 'nokit';
  throw err;
};


/**
 * A simplified task wrapper for `kit.task`
 * @param  {String}   name
 * @param  {Array}    deps
 * @param  {String}   description
 * @param  {Boolean}  isSequential
 * @param  {Function} fn
 * @return {Function} fn
 */

task = function() {
  var alias, args, depsInfo, helpInfo, sep;
  args = kit.defaultArgs(arguments, {
    name: {
      String: 'default'
    },
    deps: {
      Array: null
    },
    description: {
      String: ''
    },
    isSequential: {
      Boolean: null
    },
    fn: {
      Function: function() {}
    }
  });
  depsInfo = args.deps ? (sep = args.isSequential ? ' -> ' : ', ', br.grey("deps: [" + (args.deps.join(sep)) + "]")) : '';
  sep = args.description ? ' ' : '';
  helpInfo = args.description + sep + depsInfo;
  alias = args.name.split(' ');
  alias.forEach(function(name) {
    cmder.command(name).description(helpInfo);
    kit.task(name, args, function() {
      return args.fn(getOptions());
    });
    return helpInfo = br.cyan('-> ') + alias[0];
  });
  return args.fn;
};


/**
 * Load nofile.
 * @return {String} The path of found nofile.
 */

loadNofile = function() {
  var dir, findPath, load, nofileIndex, nofileReg, path, preRequire, rdir;
  preRequire = function(path) {
    var code, err, error1, i, len, r, requires, results;
    code = kit.readFileSync(path, 'utf8');
    requires = code.match(/nofile-pre-require:\s*[^\s]+/g);
    if (requires) {
      results = [];
      for (i = 0, len = requires.length; i < len; i++) {
        r = requires[i];
        try {
          results.push(require(_.trim(r.replace('nofile-pre-require:', ''))));
        } catch (error1) {
          err = error1;
          try {
            console.error("nofile-pre-require error in file " + path);
          } catch (undefined) {}
          throw err;
        }
      }
      return results;
    }
  };
  load = function(path) {
    var tasker;
    kit.Promise.enableLongStackTrace();
    preRequire(path);
    try {
      console.log(br.grey("# " + path));
    } catch (undefined) {}
    tasker = require(path);
    if (tasker && tasker["default"]) {
      tasker = tasker["default"];
    }
    if (_.isFunction(tasker)) {
      tasker(task, cmder.option.bind(cmder));
    } else {
      error('no task defined');
    }
    return path;
  };
  if ((nofileIndex = process.argv.indexOf('--nofile')) > -1) {
    return load(kit.path.resolve(process.argv[nofileIndex + 1]));
  }
  nofileReg = /^nofile\.\w+$/i;
  findPath = function(dir) {
    var name;
    name = _.find(kit.readdirSync(dir), function(n) {
      return nofileReg.test(n);
    });
    if (name) {
      return kit.path.join(dir, name);
    } else {
      return findPath(kit.path.dirname(dir));
    }
  };
  path = findPath(process.cwd());
  if (path) {
    dir = kit.path.dirname(path);
    rdir = kit.path.relative('.', dir);
    if (rdir) {
      try {
        console.log(br.cyan('change working direcoty to: ') + br.green(rdir));
      } catch (undefined) {}
    }
    process.chdir(dir);
    return load(path);
  }
  return error('Cannot find nofile');
};

searchTasks = function() {
  var list;
  list = _.keys(kit.task.list);
  return _(cmder.args).map(function(cmd) {
    return kit.fuzzySearch(cmd, list);
  }).compact().value();
};

getOptions = function() {
  return _.pick(cmder, cmder.options.map(function(o) {
    if (o.long.length === 2) {
      return o.long[1].toUpperCase();
    } else {
      return _.camelCase(o.long);
    }
  }));
};

module.exports = function() {
  var cwd, nofilePath, tasks;
  cwd = process.cwd();
  nofilePath = loadNofile();
  cmder.option('--nofile <path>', 'force nofile path').usage('[options] [fuzzy task name]...');
  if (!kit.task.list) {
    return;
  }
  cmder.parse(process.argv);
  if (cmder.args.length === 0) {
    if (kit.task.list['default']) {
      kit.task.run('default', {
        init: getOptions()
      })["catch"](kit["throw"]);
    } else {
      cmder.outputHelp();
    }
    return;
  }
  tasks = searchTasks();
  if (tasks.length === 0) {
    error('No such tasks: ' + cmder.args);
  }
  return kit.task.run(tasks, {
    init: getOptions(),
    isSequential: true
  })["catch"](kit["throw"]);
};
