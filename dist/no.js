
/*
	A simplified version of Make.
 */
var _, br, cmder, error, kit, launch, loadNofile, searchTasks, task;

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
 * @return {Promise}
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
  return alias.forEach(function(name) {
    cmder.command(name).description(helpInfo);
    kit.task(name, args, function() {
      return args.fn(cmder);
    });
    return helpInfo = br.cyan('-> ') + alias[0];
  });
};


/**
 * Load nofile.
 * @return {String} The path of found nofile.
 */

loadNofile = function() {
  var dir, exts, i, j, lang, len, len1, load, nofileIndex, path, paths, rdir, ref;
  if (process.env.nokitPreload) {
    ref = process.env.nokitPreload.split(' ');
    for (i = 0, len = ref.length; i < len; i++) {
      lang = ref[i];
      try {
        require(lang);
      } catch (undefined) {}
    }
  } else {
    try {
      require('babel/register');
    } catch (undefined) {}
    try {
      require('coffee-script/register');
    } catch (undefined) {}
  }
  exts = _(require.extensions).keys().filter(function(ext) {
    return ['.json', '.node', '.litcoffee', '.coffee.md'].indexOf(ext) === -1;
  });
  load = function(path) {
    var tasker;
    kit.Promise.enableLongStackTrace();
    tasker = require(path);
    if (_.isFunction(tasker)) {
      tasker(task, cmder.option.bind(cmder));
    } else {
      kit.err('No task found.');
    }
    return path;
  };
  if ((nofileIndex = process.argv.indexOf('--nofile')) > -1) {
    return load(kit.path.resolve(process.argv[nofileIndex + 1]));
  }
  paths = kit.genModulePaths('nofile', process.cwd(), '').reduce(function(s, p) {
    return s.concat(exts.map(function(ext) {
      return p + ext;
    }).value());
  }, []);
  for (j = 0, len1 = paths.length; j < len1; j++) {
    path = paths[j];
    if (kit.existsSync(path)) {
      dir = kit.path.dirname(path);
      rdir = kit.path.relative('.', dir);
      if (rdir) {
        kit.log(br.cyan('Change Working Direcoty: ') + br.green(rdir));
      }
      process.chdir(dir);
      return load(path);
    }
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

module.exports = launch = function() {
  var cwd, nofilePath, tasks;
  cwd = process.cwd();
  nofilePath = loadNofile();
  cmder.option('--nofile <path>', 'force nofile path').usage('[options] [fuzzy_task_name]...' + br.grey("  # " + (kit.path.relative(cwd, nofilePath))));
  if (!kit.task.list) {
    return;
  }
  cmder.parse(process.argv);
  if (cmder.args.length === 0) {
    if (kit.task.list['default']) {
      kit.task.run('default', {
        init: cmder
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
    init: cmder,
    isSequential: true
  })["catch"](kit["throw"]);
};
