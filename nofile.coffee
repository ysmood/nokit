process.chdir __dirname

kit = require './lib/kit'

task 'default', ['build'], 'default task is "build"'

task 'dev', 'lab', ->
	kit.monitorApp {
		bin: 'coffee'
		args: ['test/lab.coffee']
	}

task 'build', 'build project', build = ->
	compileCoffee = ->
		kit.spawn 'coffee', [
			'-o', 'dist'
			'-cb', 'lib'
		]

	createDoc = ->
		path = 'lib/kit.coffee'
		kit.compose([
			kit.parseFileComment path, {
				formatComment: {
					name: ({ name, line }) ->
						name = name.replace 'self.', ''
						link = "#{path}?source#L#{line}"
						"- ## **[#{name}](#{link})**\n\n"
				}
			}
			(doc) ->
				tpl = kit.fs.readFileSync 'doc/readme.tpl.md', 'utf8'

				kit.outputFile 'readme.md', _.template(tpl)({ api: doc })
		])()

	start = kit.compose [
		-> kit.remove 'dist'
		-> kit.warp('lib/**/*.js').to 'dist'
		compileCoffee
		createDoc
	]

	start().then ->
		kit.log 'Build done.'.green

option '-g, --grep [pattern]', 'test pattern', '.'
option '-b, --bare', 'don\'t compile before test'
task 'test', 'unit tests', (opts) ->
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
	.catch (err) ->
		if err.code
			process.exit code
		else
			Promise.reject err
