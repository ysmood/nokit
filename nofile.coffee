###
	For help info run "npm run no -- -h"
###

kit = require './lib/kit'

module.exports = (task, option) ->

	option '-a, --all', 'rebuild with dependencies, such as rebuild lodash.'
	task 'default build b', ['clean'], 'build project', (opts) ->
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
			.load kit.drives.coffee()
			.run 'dist'

		buildDoc = ->
			kit.warp 'lib/*.coffee'
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

	option '-d, --debug', 'enable node debug mode'
	option '-p, --port [8283]', 'node debug mode', 8283
	task 'lab l', 'run and monitor "test/lab.coffee"', (opts) ->
		args = ['test/lab.coffee']

		if opts.debug
			args.splice 0, 0, '--nodejs', '--debug-brk=' + opts.port

		kit.monitorApp { bin: 'coffee', args }

	task 'clean', 'clean dist & cache', (opts) ->
		if opts.all
			kit.async [
				kit.remove 'dist'
				kit.remove '.nokit'
			]

	option '-g, --grep <pattern>', 'test pattern', ''
	task 'test t', 'unit tests', (opts) ->
		clean = ->
			kit.spawn 'git', ['clean', '-fd', 'test/fixtures']

		clean().then ->
			kit.spawn('junit', [
				'-r', 'coffee-script/register'
				'-g', opts.grep
				'test/basic.coffee'
			])
		.then -> clean()
		.catch (err) ->
			if err.code
				process.exit err.code
			else
				kit.Promise.reject err
