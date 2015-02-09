###
	For help info run "npm run no -- -h"
###

process.chdir __dirname

kit = require './lib/kit'
{ _, Promise } = kit

task 'default', ['build', 'test'], true

option '-d, --debug', 'enable node debug mode'
option '-p, --port [8283]', 'node debug mode', 8283
task 'lab l', 'run and monitor "test/lab.coffee"', (opts) ->
	args = ['test/lab.coffee']

	if opts.debug
		args.splice 0, 0, '--nodejs', '--debug-brk=' + opts.port

	kit.monitorApp { bin: 'coffee', args }

task 'clean', 'clean dist & cache', (opts) ->
	kit.async [
		kit.remove 'dist'
		kit.remove '.nokit' if opts.all
	]

option '-a, --all', 'rebuild with dependencies, such as rebuild lodash.'
task 'build b', ['clean'], 'build project', (opts) ->
	kit.require 'drives'

	buildLodash = ->
		if opts.all
			kit.spawn 'lodash', [
				'modern', 'strict', '-d'
				'-o', 'lib/lodash.js'
			]

	buildJs = ->
		kit.warp 'lib/**/*.js'
		.load kit.drives.auto 'compress'
		.run 'dist'

	buildCoffee = ->
		kit.warp 'lib/**/*.coffee'
		.load kit.drives.coffeelint()
		.load kit.drives.coffee()
		.run 'dist'

	buildDoc = ->
		kit.warp 'lib/{drives,kit}.coffee'
		.load kit.drives.comment2md
			h: 2, tpl: 'doc/readme.jst.md'
		.run()

	start = kit.flow [
		buildLodash
		buildJs
		buildCoffee
		buildDoc
	]

	start().catch (err) ->
		kit.err err.stack
		process.exit 1

option '-g, --grep [.]', 'test pattern', /./
option '-t, --timeout [3000]', 'test timeout', 3000
task 'test t', 'unit tests', (opts) ->
	clean = ->
		kit.spawn 'git', ['clean', '-fd', 'test/fixtures']

	clean().then ->
		kit.warp 'test/basic.coffee'
		.load kit.drives.mocha {
			timeout: opts.timeout
			grep: opts.grep
		}
		.run()
	.then -> clean()
	.catch (err) ->
		if err.code
			process.exit err.code
		else
			Promise.reject err
