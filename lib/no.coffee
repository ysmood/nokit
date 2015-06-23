###
	A simplified version of Make.
###

if not process.env.NODE_ENV?
	process.env.NODE_ENV = 'development'

kit = require './kit'
cls = kit.require 'colors/safe'
{ _ } = kit
cmder = require 'commander'

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
 * @return {Promise}
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
		cls.grey "deps: [#{args.deps.join sep}]"
	else
		''

	sep = if args.description then ' ' else ''

	helpInfo = args.description + sep + depsInfo

	alias = args.name.split ' '
	alias.forEach (name) ->
		cmder.command name
		.description helpInfo
		kit.task name, args, -> args.fn cmder

		helpInfo = cls.cyan('-> ') + alias[0]

###*
 * Load nofile.
 * @return {String} The path of found nofile.
###
loadNofile = ->
	if process.env.nokitPreload
		for lang in process.env.nokitPreload.split ' '
			try
				require lang + '/register'
			catch
				try require lang
	else
		try
			require 'coffee-cache'
		catch
			try require 'coffee-script/register'

	exts = _(require.extensions).keys().filter (ext) ->
		['.json', '.node', '.litcoffee', '.coffee.md'].indexOf(ext) == -1

	paths = kit.genModulePaths 'nofile', process.cwd(), ''
		.reduce (s, p) ->
			s.concat exts.map((ext) -> p + ext).value()
		, []

	for path in paths
		if kit.existsSync path
			dir = kit.path.dirname path

			rdir = kit.path.relative '.', dir
			if rdir
				kit.log cls.cyan('Change Working Direcoty: ') + cls.green rdir

			process.chdir dir

			kit.Promise.enableLongStackTrace()

			require(path)? task, cmder.option.bind(cmder)
			return path

	error 'Cannot find nofile'

searchTasks = ->
	list = _.keys kit.task.list
	_ cmder.args
	.map (cmd) ->
		kit.fuzzySearch cmd, list
	.compact()
	.value()

module.exports = launch = ->
	cwd = process.cwd()

	cmder
	.option '-v, --version',
		'output version of nokit',
		->
			info = kit.readJsonSync(__dirname + '/../package.json')
			console.log cls.green("nokit@#{info.version}"),
				cls.grey "(#{require.resolve('./kit')})"
			process.exit()

	nofilePath = loadNofile()

	cmder.usage '[options] [fuzzy_task_name]...' +
		cls.grey "  # #{kit.path.relative cwd, nofilePath}"

	if not kit.task.list
		return

	cmder.parse process.argv

	if cmder.args.length == 0
		if kit.task.list['default']
			kit.task.run 'default', { init: cmder }
		else
			cmder.outputHelp()
		return

	tasks = searchTasks()

	if tasks.length == 0
		error 'No such tasks: ' + cmder.args

	kit.task.run tasks, { init: cmder, isSequential: true }
