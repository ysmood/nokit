process.env.NODE_ENV = 'development'
process.chdir __dirname

kit = require './lib/kit'
{ _ } = kit

task 'dev', 'Lab', ->
	kit.monitorApp {
		bin: 'coffee'
		args: ['test/lab.coffee']
	}

task 'build', 'Build project.', build = ->
	compileCoffee = ->
		kit.spawn 'coffee', [
			'-o', 'dist'
			'-cb', 'lib'
		]

	createDoc = ->
		kit.compose([
			kit.parseFileComment 'lib/kit.coffee'
			(doc) ->
				tpl = kit.fs.readFileSync 'doc/readme.tpl.md', 'utf8'

				kit.outputFile 'readme.md', _.template tpl, { api: doc }
		])()

	start = kit.compose [
		compileCoffee
		createDoc
	]

	start().then ->
		kit.log 'Build done.'.green

option '-g', '--grep [grep]', 'Test pattern'
option '-b', '--bare', 'Don\'t compile before test.'
task 'test', 'Test', (opts) ->
	(if opts.bare
		kit.Promise.resolve()
	else
		build()
	).then ->
		kit.spawn('mocha', [
			'-t', '10000'
			'-r', 'coffee-script/register'
			'-R', 'spec'
			'-g', opts.grep or '.'
			'test/basic.coffee'
		]).catch ({ code }) ->
			process.exit code
