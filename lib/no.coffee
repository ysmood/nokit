###
	A simplified version of Make.
###

if not process.env.NODE_ENV?
	process.env.NODE_ENV = 'development'

kit = require './kit'
{ _ } = kit
cmder = kit.requireOptional 'commander'

error = (msg) ->
	err = new Error msg
	err.source = 'nokit'
	throw err

loadNofile = ->
	process.env.nokitPreload ?= 'coffee-script/register'
	for lang in process.env.nokitPreload.split ' '
		try require lang

	paths = kit.genModulePaths('nofile', process.cwd(), '')[1..]
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
task = (name, deps, description, isSequential, fn = ->) ->
	# Allowed option format:
	#
	# task name, fn
	# task name, description, fn
	# task name, deps, fn
	# task name, deps, description, fn
	if _.isFunction deps
		fn = deps
		deps = null
		description = null
		isSequential = null
	else if _.isString(deps) and _.isFunction(description)
		fn = description
		description = deps
		deps = null
		isSequential = null
	else if _.isArray(deps) and _.isFunction(description)
		fn = description
		description = null
		isSequential = null
	else if _.isArray(deps) and _.isString(description) and
	_.isFunction(isSequential)
		fn = isSequential
		isSequential = null

	argedFn = -> fn cmder

	cmder.command name
	.description description or ''

	kit.task name, { deps, description, isSequential }, argedFn

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

	for task in cmder.args
		if not kit.task.list[task]
			error 'No such task: ' + task

	kit.task.run cmder.args, { init: cmder }
