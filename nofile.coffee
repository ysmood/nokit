process.chdir __dirname

task 'default', ['build'], 'Default task'

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

				kit.outputFile 'readme.md', _.template(tpl)({ api: doc })
		])()

	start = kit.compose [
		-> kit.remove 'dist'
		-> flow('lib/**/*.js').to 'dist'
		compileCoffee
		createDoc
	]

	start().then ->
		kit.log 'Build done.'.green

option '-g, --grep [pattern]', 'Test pattern', '.'
option '-b, --bare', 'Don\'t compile before test.'
task 'test', 'Test', (opts) ->
	clean = ->
		kit.spawn 'git', ['clean', '-fd', kit.path.normalize('test/fixtures')]

	(if opts.bare
		kit.Promise.resolve()
	else
		build()
	).then clean
	.then ->
		kit.spawn('mocha', [
			'-t', '10000'
			'-r', 'coffee-script/register'
			'-R', 'spec'
			'-g', opts.grep
			'test/basic.coffee'
		])
	.then -> clean()
	.catch ({ code }) ->
		process.exit code
