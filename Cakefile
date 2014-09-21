kit = require './kit'

task 'build', 'Build project.', build = ->
	kit.spawn 'coffee', [
		'-cb', 'kit.coffee'
	]
	.done ->
		kit.log 'Build done.'

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
