###
	For help info run "npm run no -- -h"
###

process.chdir __dirname

kit = require './lib/kit'

task 'default', ['build', 'test'], true

task 'lab l', 'run and monitor "test/lab.coffee"', ->
	kit.monitorApp {
		bin: 'coffee'
		args: ['test/lab.coffee']
	}

task 'clean', 'clean dist', ->
	kit.remove 'dist'

option '-a, --all', 'Rebuild with dependencies, such as rebuild lodash.'
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
		Promise.all [
			kit.warp 'lib/kit.coffee'
				.load kit.drives.comment2md {
					h: 2
					tpl: 'doc/readme.tpl.md'
				}
			.run()

			kit.warp 'lib/drives.coffee'
				.load kit.drives.comment2md {
					h: 2
					out: 'doc/drives.md'
					tpl: 'doc/drives.tpl.md'
				}
			.run()
		]

	start = kit.flow [
		buildLodash
		buildJs
		buildCoffee
		buildDoc
	]

	start().then ->
		kit.log 'Build done.'.green
	.catch (err) ->
		kit.err err.stack
		process.exit 1

option '-g, --grep [pattern]', 'test pattern', '.'
task 'test t', 'unit tests', (opts) ->
	clean = ->
		kit.spawn 'git', ['clean', '-fd', kit.path.normalize('test/fixtures')]

	clean().then ->
		kit.spawn('mocha', [
			'-t', '10000'
			'-r', 'coffee-script/register'
			'-R', 'spec'
			'-g', opts.grep
			'test/basic.coffee'
		])
	.then -> clean()
	.catch (err) ->
		if err.code
			process.exit err.code
		else
			Promise.reject err
