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

	paths = kit.genModulePaths 'nofile', process.cwd(), ''
	for path in paths
		try
			return require path
		catch err
			if err.code != 'MODULE_NOT_FOUND'
				throw err

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

	cmder.command args.name
	.description args.description

	kit.task args.name, args, -> args.fn cmder

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
			cs = kit.require 'colors/safe'
			info = kit.readJsonSync(__dirname + '/../package.json')
			console.log cs.green("nokit@#{info.version}"),
				cs.grey("(#{require.resolve('./kit')})")
			process.exit()
	.usage '[options] [commands]'

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

	tasks = searchTasks()

	if tasks.length == 0
		error 'No such tasks: ' + cmder.args

	kit.task.run tasks, { init: cmder }
