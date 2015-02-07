###
	A simplified version of Make.
###

if not process.env.NODE_ENV?
	process.env.NODE_ENV = 'development'

kit = require './kit'
kit.require 'colors'
{ _ } = kit
cmder = kit.requireOptional 'commander', __dirname

error = (msg) ->
	err = new Error msg
	err.source = 'nokit'
	throw err

loadNofile = ->
	process.env.nokitPreload ?= 'coffee-cache coffee-script/register'
	for lang in process.env.nokitPreload.split ' '
		try require lang

	exts = _(require.extensions).keys().filter (ext) ->
		['.json', '.node', '.litcoffee', '.coffee.md'].indexOf(ext) == -1

	paths = kit.genModulePaths 'nofile', process.cwd(), ''
		.reduce (s, p) ->
			s.concat exts.map((ext) -> p + ext).value()
		, []

	for path in paths
		if kit.existsSync path
			require path
			return kit.path.parse path

	error 'Cannot find nofile'

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
		"deps: [#{args.deps.join sep}]".grey
	else
		''

	sep = if args.description then ' ' else ''

	helpInfo = args.description + sep + depsInfo

	alias = args.name.split ' '
	aliasSym = ''
	alias.forEach (name) ->
		cmder.command name
		.description helpInfo
		kit.task name + aliasSym, args, -> args.fn cmder

		aliasSym = '@'.magenta
		helpInfo = '-> '.cyan + alias[0]


setGlobals = ->
	option = cmder.option.bind cmder

	# Expose global helpers.
	kit._.extend global, {
		_
		kit
		task
		option
		Promise: kit.Promise
		warp: kit.warp
	}

searchTasks = ->
	list = _.keys kit.task.list
	_ cmder.args
	.map (cmd) ->
		kit.fuzzySearch cmd, list
	.compact()
	.value()

module.exports = launch = ->

	cmder
	.option '-v, --version',
		'output version of nokit',
		->
			info = kit.readJsonSync(__dirname + '/../package.json')
			console.log "nokit@#{info.version}".green,
				"(#{require.resolve('./kit')})".grey
			process.exit()
	.usage '[options] [tasks]    # supports fuzzy task name'

	setGlobals()
	loadNofile()

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

	kit.task.run tasks, { init: cmder }
