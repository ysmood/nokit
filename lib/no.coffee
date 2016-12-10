###
	A simplified version of Make.
###

if not process.env.NODE_ENV?
	process.env.NODE_ENV = 'development'

kit = require './kit'
kit.requireOptional.autoInstall = true;

br = kit.require 'brush'
{ _ } = kit
cmder = kit.requireOptional 'commander', __dirname, '^2.9.0'
autoInstallDeps = require './autoInstallDeps'

error = (msg) ->
	err = new Error msg
	err.source = 'nokit'
	throw err

###*
 * A simplified task wrapper for `kit.task`
 * @param  {String}   name
 * @param  {Array}    deps
 * @param  {String}   description
 * @param  {Boolean}  isSequential
 * @param  {Function} fn
 * @return {Function} fn
###
task = ->
	args = kit.defaultArgs arguments, {
		name: { String: 'default' }
		deps: { Array: null }
		description: { String: '' }
		isSequential: { Boolean: null }
		fn: { Function: -> }
	}

	depsInfo = if args.deps
		sep = if args.isSequential then ' -> ' else ', '
		br.grey "deps: [#{args.deps.join sep}]"
	else
		''

	sep = if args.description then ' ' else ''

	helpInfo = args.description + sep + depsInfo

	alias = args.name.split ' '
	alias.forEach (name) ->
		cmder.command name
		.description helpInfo
		kit.task name, args, -> args.fn getOptions()

		helpInfo = br.cyan('-> ') + alias[0]

	args.fn

checkEngines = (engines) ->
	semver = kit.require 'semver'
	if engines.node && not semver.satisfies(process.version, engines.node)
		throw new Error(br.red(
			"package.json engines.node requires #{engines.node}, but get #{process.version}"
		))

	if engines.npm
		{ execSync } = kit.require 'child_process', __dirname
		npmVer = _.trim('' + execSync 'npm -v')
		if not semver.satisfies(npmVer, engines.npm)
			throw new Error(br.red(
				"package.json engines.npm requires #{engines.npm}, but get #{npmVer}"
			))

	# maybe in the future: Microsoft's Chakra

findPath = (pattern, dir = process.cwd()) ->
	name = _.find kit.readdirSync(dir), (n) -> pattern.test n
	parent = kit.path.dirname(dir);

	if parent == dir
		return null

	if name
		return kit.path.join dir, name
	else
		return findPath pattern, parent

getPackageJsonPath = () ->
	paths = kit.genModulePaths 'package.json', process.cwd(), ''

	for p in paths
		if kit.fileExistsSync p
			return p

preRequire = (requires) ->
	for path in requires
		try
			require path
		catch err
			console.error "nofile pre-require error in file #{path}"
			throw err

###*
 * Load nofile.
 * @return {String} The path of found nofile.
###
loadNofile = (nofilePath) ->
	load = (path) ->
		kit.Promise.enableLongStackTrace()

		console.log br.grey("# #{path}")

		tasker = require path
		tasker = tasker.default if tasker and tasker.default
		if _.isFunction tasker
			tasker task, cmder.option.bind(cmder)
		else
			error 'no task defined'
		return path

	if nofilePath
		path = kit.path.resolve nofilePath
		if kit.fileExistsSync path
			return load path
		else
			return error "package.json nofile.path not found: #{path}"

	try
		path = findPath /^nofile\.\w+$/i

	if path
		dir = kit.path.dirname path

		rdir = kit.path.relative '.', dir
		if rdir
			console.log br.cyan('change working direcoty to: ') + br.green rdir

		process.chdir dir

		return load path

	error 'Cannot find nofile'

searchTasks = ->
	list = _.keys kit.task.list
	_ cmder.args
	.map (cmd) ->
		kit.fuzzySearch cmd, list
	.compact()
	.value()

getOptions = ->
	_.pick(
		cmder,
		cmder.options.map (o) ->
			if (o.long.length == 2)
				o.long[1].toUpperCase()
			else
				_.camelCase(o.long)
	)

module.exports = ->
	cwd = process.cwd()

	packagePath = getPackageJsonPath()

	packageInfo = kit.readJsonSync packagePath

	checkEngines _.get(packageInfo, 'engines', {})

	if (_.get(packageInfo, 'nofile.autoInstallDeps'))
		autoInstallDeps kit.path.dirname(packagePath), packageInfo

	preRequire _.get(packageInfo, 'nofile.preRequire', [])

	loadNofile _.get(packageInfo, 'nofile.path')

	cmder
	.usage '[options] [fuzzy task name]...'

	if not kit.task.list
		return

	cmder.parse process.argv

	if cmder.args.length == 0
		if kit.task.list['default']
			kit.task.run 'default', { init: getOptions() }
			.catch kit.throw
		else
			cmder.outputHelp()
		return

	tasks = searchTasks()

	if tasks.length == 0
		error 'No such tasks: ' + cmder.args

	kit.task.run tasks, { init: getOptions(), isSequential: true }
	.catch kit.throw
