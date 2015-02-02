process.chdir __dirname

require 'coffee-cache'
kit = require './lib/kit'

task 'default', ['build', 'test'], 'default task is "build -> test"'

task 'dev', 'lab', ->
	kit.monitorApp {
		bin: 'coffee'
		args: ['test/lab.coffee']
	}

option '-a, --all', 'Rebuild with dependencies, such as rebuild lodash.'
task 'build', 'build project', (opts) ->
	compileCoffee = ->
		kit.spawn 'coffee', [
			'-o', 'dist'
			'-cb', 'lib'
		]

	buildLodash = ->
		if opts.all
			kit.spawn 'lodash', [
				'modern', 'strict', '-p'
				'-o', 'lib/lodash.js'
			]

	createDoc = ->
		path = 'lib/kit.coffee'
		kit.flow([
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

	start = kit.flow [
		-> kit.remove 'dist'
		buildLodash
		-> kit.warp('lib/**/*.js').to 'dist'
		compileCoffee
		createDoc
	]

	start().then ->
		cs = kit.require 'colors/safe'
		kit.log cs.green 'Build done.'

option '-g, --grep [pattern]', 'test pattern', '.'
task 'test', 'unit tests', (opts) ->
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
