kit = require './kit'

task 'build', 'Build project.', build = ->
	start = kit.compose [
		kit.spawn 'coffee', [
			'-cb', 'kit.coffee'
		]
		kit.readFile 'kit.coffee'
		(code) ->
			kit.parse_comment 'kit', code, 'kit.coffee'
		(mod) ->
			kit.log mod
		->
			kit.log 'Build done.'
	]

	start().done()

task 'clean', 'Remove temp files.', clean = ->
	kit.remove 'kit.js'

task 'test', 'Test', ->
	kit.spawn('mocha', [
		'-t', '5000'
		'-r', 'coffee-script/register'
		'-R', 'spec'
		'test/test.coffee'
	]).process.on 'exit', (code) ->
		if code != 0
			process.exit code
