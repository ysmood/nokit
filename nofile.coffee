process.chdir __dirname

require 'coffee-cache'
kit = require './lib/kit'

task 'default', ['build', 'test'], true

task 'dev', 'lab', ->
	kit.monitorApp {
		bin: 'coffee'
		args: ['test/lab.coffee']
	}

task 'clean', 'clean dist', ->
	kit.remove 'dist'

option '-a, --all', 'Rebuild with dependencies, such as rebuild lodash.'
task 'build', ['clean'], 'build project', (opts) ->
	kit.require 'warpDrives'

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
		buildLodash
		-> kit.warp('lib/**/*.js').to 'dist'
		->
			kit.warp 'lib/**/*.coffee'
			.pipe kit.warpDrives.coffeelint()
			.pipe kit.warpDrives.coffee()
			.to 'dist'
		createDoc
	]

	start().then ->
		kit.log 'Build done.'.green

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
