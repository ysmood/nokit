
/*
	A simplified version of Make.
 */
var _, autoInstallDeps, br, checkEngines, cmder, error, findPath, getOptions, getPackageJsonPath, kit, loadNofile, preRequire, searchTasks, task;

if (process.env.NODE_ENV == null) {
  process.env.NODE_ENV = 'development';
}

kit = require('./kit');

kit.requireOptional.autoInstall = true;

br = kit.require('brush');

_ = kit._;

cmder = kit.requireOptional('commander', __dirname, '^2.9.0');

autoInstallDeps = require('./autoInstallDeps');

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

checkEngines = function(engines) {
  var execSync, npmVer, semver;
  semver = kit.require('semver');
  if (engines.node && !semver.satisfies(process.version, engines.node)) {
    throw new Error(br.red("package.json engines.node requires " + engines.node + ", but get " + process.version));
  }
  if (engines.npm) {
    execSync = kit.require('child_process', __dirname).execSync;
    npmVer = _.trim('' + execSync('npm -v'));
    if (!semver.satisfies(npmVer, engines.npm)) {
      throw new Error(br.red("package.json engines.npm requires " + engines.npm + ", but get " + npmVer));
    }
  }
};

findPath = function(pattern, dir) {
  var name, parent;
  if (dir == null) {
    dir = process.cwd();
  }
  name = _.find(kit.readdirSync(dir), function(n) {
    return pattern.test(n);
  });
  parent = kit.path.dirname(dir);
  if (parent === dir) {
    return null;
  }
  if (name) {
    return kit.path.join(dir, name);
  } else {
    return findPath(pattern, parent);
  }
};

getPackageJsonPath = function() {
  var i, len, p, paths;
  paths = kit.genModulePaths('package.json', process.cwd(), '');
  for (i = 0, len = paths.length; i < len; i++) {
    p = paths[i];
    if (kit.fileExistsSync(p)) {
      return p;
    }
  }
};

preRequire = function(requires) {
  var err, i, len, path, results;
  if (!_.isArray(requires)) {
    requires = [requires];
  }
  results = [];
  for (i = 0, len = requires.length; i < len; i++) {
    path = requires[i];
    try {
      results.push(require(path));
    } catch (error1) {
      err = error1;
      console.error("nofile pre-require error in file " + path);
      throw err;
    }
  }
  return results;
};


/**
 * Load nofile.
 * @return {String} The path of found nofile.
 */

loadNofile = function(nofilePath) {
  var dir, load, nofileIndex, path, rdir;
  load = function(path) {
    var tasker;
    kit.Promise.enableLongStackTrace();
    console.log(br.grey("# " + path));
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
    path = kit.path.resolve(process.argv[nofileIndex + 1]);
    if (kit.fileExistsSync(path)) {
      return load(path);
    } else {
      return error('Cannot find nofile');
    }
  }
  if (nofilePath) {
    path = kit.path.resolve(nofilePath);
    if (kit.fileExistsSync(path)) {
      return load(path);
    } else {
      return error("package.json nofile.path not found: " + path);
    }
  }
  try {
    path = findPath(/^nofile\.\w+$/i);
  } catch (error1) {}
  if (path) {
    dir = kit.path.dirname(path);
    rdir = kit.path.relative('.', dir);
    if (rdir) {
      console.log(br.cyan('change working direcoty to: ') + br.green(rdir));
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
  var cwd, packageInfo, packagePath, tasks;
  cwd = process.cwd();
  packagePath = getPackageJsonPath();
  packageInfo = packagePath ? kit.readJsonSync(packagePath) : null;
  checkEngines(_.get(packageInfo, 'engines', {}));
  if (_.get(packageInfo, 'nofile.autoInstallDeps')) {
    autoInstallDeps(kit.path.dirname(packagePath), packageInfo);
  }
  preRequire(_.get(packageInfo, 'nofile.preRequire', []));
  loadNofile(_.get(packageInfo, 'nofile.path'));
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
