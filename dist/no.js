// Generated by CoffeeScript 1.8.0

/*
	A simplified version of Make.
 */
var cmder, kit, launch, loadNofile, setGlobals, task, _;

if (process.env.NODE_ENV == null) {
  process.env.NODE_ENV = 'development';
}

kit = require('./kit');

_ = kit._;

cmder = kit.requireOptional('commander');

loadNofile = function() {
  var err, path, paths, _i, _len;
  try {
    require('coffee-script/register');
  } catch (_error) {}
  try {
    require('Livescript');
  } catch (_error) {}
  paths = kit.genModulePaths('nofile', process.cwd(), '').slice(1);
  for (_i = 0, _len = paths.length; _i < _len; _i++) {
    path = paths[_i];
    try {
      return require(path);
    } catch (_error) {
      err = _error;
      if (err.code !== 'MODULE_NOT_FOUND') {
        throw err;
      }
    }
  }
  kit.err('[Error] Cannot find nofile'.red, {
    isShowTime: false
  });
  return process.exit();
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

task = function(name, deps, description, isSequential, fn) {
  var argedFn;
  if (fn == null) {
    fn = function() {};
  }
  if (_.isFunction(deps)) {
    fn = deps;
    deps = null;
    description = null;
    isSequential = null;
  } else if (_.isString(deps) && _.isFunction(description)) {
    fn = description;
    description = deps;
    deps = null;
    isSequential = null;
  } else if (_.isArray(deps) && _.isFunction(description)) {
    fn = description;
    description = null;
    isSequential = null;
  } else if (_.isArray(deps) && _.isString(description) && _.isFunction(isSequential)) {
    fn = isSequential;
    isSequential = null;
  }
  argedFn = function() {
    return fn(cmder);
  };
  cmder.command(name).description(description || '');
  return kit.task(name, {
    deps: deps,
    description: description,
    isSequential: isSequential
  }, argedFn);
};

setGlobals = function() {
  var option;
  option = cmder.option.bind(cmder);
  return kit._.extend(global, {
    _: _,
    kit: kit,
    task: task,
    option: option,
    flow: kit.flow
  });
};

launch = function() {
  var _i, _len, _ref;
  if (!kit.task.list) {
    return;
  }
  cmder.parse(process.argv);
  if (cmder.args.length === 0) {
    if (kit.task.list['default']) {
      kit.task.run('default', {
        init: cmder
      });
    } else {
      cmder.outputHelp();
    }
  }
  _ref = cmder.args;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    task = _ref[_i];
    if (!kit.task.list[task]) {
      kit.err('  [Error] No such task: '.red + task.cyan, {
        isShowTime: false
      });
      cmder.outputHelp();
      return;
    }
  }
  return kit.task.run(cmder.args, {
    init: cmder
  });
};

setGlobals();

loadNofile();

launch();
