kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
{ Promise } = kit
# require '../lib/proxy'

ken = kit.require 'ken'
test = ken()

# Async tests
test.async [
	test 'basic 1', ->
		ken.eq 'ok', 'ok'
	test 'basic 2', ->
		ken.deepEq { a: 1, b: 2 }, { a: 1, b: 2 }

	# Sync tests
	kit.flow [
		test 'basic 3', ->
			ken.eq 'ok', 'ok'
		test 'basic 4', ->
			ken.eq 'ok', 'ok'
	]
]
