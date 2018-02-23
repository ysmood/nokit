/*
	A simplified version of Make.
*/

if ((process.env.NODE_ENV == null)) {
	process.env.NODE_ENV = 'development';
}

const kit = require('./kit');
kit.requireOptional.autoInstall = true;

const br = kit.require('brush');
const {
	_
} = kit;
const cmder = kit.requireOptional('commander', __dirname, '^2.9.0');
const autoInstallDeps = require('./autoInstallDeps');

const error = function (msg) {
	const err = new Error(msg);
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
const task = function () {
	let sep;
	const args = kit.defaultArgs(arguments, {
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
			Function() {}
		}
	});

	const depsInfo = (() => {
		if (args.deps) {
			sep = args.isSequential ? ' -> ' : ', ';
			return br.grey(`deps: [${args.deps.join(sep)}]`);
		} else {
			return '';
		}
	})();

	sep = args.description ? ' ' : '';

	let helpInfo = args.description + sep + depsInfo;

	const alias = args.name.split(' ');
	alias.forEach(function (name) {
		cmder.command(name)
			.description(helpInfo);
		kit.task(name, args, () => args.fn(getOptions()));

		return helpInfo = br.cyan('-> ') + alias[0];
	});

	return args.fn;
};

const checkEngines = function (engines) {
	const semver = kit.require('semver');
	if (engines.node && !semver.satisfies(process.version, engines.node)) {
		throw new Error(br.red(
			`package.json engines.node requires ${engines.node}, but get ${process.version}`
		));
	}

	if (engines.npm) {
		const {
			execSync
		} = kit.require('child_process', __dirname);
		const npmVer = _.trim(`${execSync('npm -v')}`);
		if (!semver.satisfies(npmVer, engines.npm)) {
			throw new Error(br.red(
				`package.json engines.npm requires ${engines.npm}, but get ${npmVer}`
			));
		}
	}
};

// maybe in the future: Microsoft's Chakra

var findPath = function (pattern, dir) {
	if (dir == null) {
		dir = process.cwd();
	}
	const name = _.find(kit.readdirSync(dir), n => pattern.test(n));
	const parent = kit.path.dirname(dir);

	if (parent === dir) {
		return null;
	}

	if (name) {
		return kit.path.join(dir, name);
	} else {
		return findPath(pattern, parent);
	}
};

const getPackageJsonPath = function () {
	const paths = kit.genModulePaths('package.json', process.cwd(), '');

	for (let p of Array.from(paths)) {
		if (kit.fileExistsSync(p)) {
			return p;
		}
	}
};

const preRequire = function (requires) {
	if (!_.isArray(requires)) {
		requires = [requires];
	}

	return Array.from(requires).map((path) =>
		(() => {
			try {
				return require(path);
			} catch (err) {
				console.error(`nofile pre-require error in file ${path}`);
				throw err;
			}
		})());
};

/**
 * Load nofile.
 * @return {String} The path of found nofile.
 */
const loadNofile = function (nofilePath) {
	let nofileIndex, path;
	const load = function (path) {
		kit.Promise.enableLongStackTrace();

		console.log(br.grey(`# ${path}`));

		let tasker = require(path);
		if (tasker && tasker.default) {
			tasker = tasker.default;
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
			return error(`package.json nofile.path not found: ${path}`);
		}
	}

	try {
		path = findPath(/^nofile\.\w+$/i);
	} catch (error1) {}

	if (path) {
		const dir = kit.path.dirname(path);

		const rdir = kit.path.relative('.', dir);
		if (rdir) {
			console.log(br.cyan('change working direcoty to: ') + br.green(rdir));
		}

		process.chdir(dir);

		return load(path);
	}

	return error('Cannot find nofile');
};

const searchTasks = function () {
	const list = _.keys(kit.task.list);
	return _(cmder.args)
		.map(cmd => kit.fuzzySearch(cmd, list)).compact()
		.value();
};

var getOptions = () =>
	_.pick(
		cmder,
		cmder.options.map(function (o) {
			if (o.long.length === 2) {
				return o.long[1].toUpperCase();
			} else {
				return _.camelCase(o.long);
			}
		})
	);

module.exports = function () {
	const cwd = process.cwd();

	const packagePath = getPackageJsonPath();

	const packageInfo = packagePath ?
		kit.readJsonSync(packagePath) :
		null;

	checkEngines(_.get(packageInfo, 'engines', {}));

	if (_.get(packageInfo, 'nofile.autoInstallDeps')) {
		autoInstallDeps(kit.path.dirname(packagePath), packageInfo);
	}

	preRequire(_.get(packageInfo, 'nofile.preRequire', []));

	loadNofile(_.get(packageInfo, 'nofile.path'));

	cmder
		.option('--nofile <path>', 'force nofile path')
		.usage('[options] [fuzzy task name]...');

	if (!kit.task.list) {
		return;
	}

	cmder.parse(process.argv);

	if (cmder.args.length === 0) {
		if (kit.task.list['default']) {
			kit.task.run('default', {
					init: getOptions()
				})
				.catch(kit.throw);
		} else {
			cmder.outputHelp();
		}
		return;
	}

	const tasks = searchTasks();

	if (tasks.length === 0) {
		error(`No such tasks: ${cmder.args}`);
	}

	return kit.task.run(tasks, {
			init: getOptions(),
			isSequential: true
		})
		.catch(kit.throw);
};