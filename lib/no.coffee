###
	A simplified version of Make.
###

if not process.env.NODE_ENV?
	process.env.NODE_ENV = 'development'

kit = require './kit'
br = kit.require 'brush'
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

###*
 * Load nofile.
 * @return {String} The path of found nofile.
###
loadNofile = ->
	preRequire = (path) ->
		code = kit.readFileSync path, 'utf8'
		requires = code.match /nofile-pre-require:\s*[^\s]+/g
		if requires
			for r in requires
				try
					require _.trim r.replace('nofile-pre-require:', '')
				catch err
					console.error "nofile-pre-require error in file #{path}"
					throw err

	load = (path) ->
		kit.Promise.enableLongStackTrace()

		preRequire path

		console.log br.grey("# #{path}")

		tasker = require path
		tasker = tasker.default if tasker and tasker.default
		if _.isFunction tasker
			tasker task, cmder.option.bind(cmder)
		else
			error 'no task defined'
		return path

	if (nofileIndex = process.argv.indexOf('--nofile')) > -1
		return load kit.path.resolve process.argv[nofileIndex + 1]


	nofileReg = /^nofile\.\w+$/i
	findPath = (dir) ->
		name = _.find kit.readdirSync(dir), (n) -> nofileReg.test n

		if name
			return kit.path.join dir, name
		else
			return findPath kit.path.dirname(dir)

	path = findPath process.cwd()

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

	nofilePath = loadNofile()

	cmder
	.option '--nofile <path>', 'force nofile path'
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
