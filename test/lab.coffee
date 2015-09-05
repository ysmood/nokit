kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
{ Promise } = kit
# require '../lib/proxy'

ken = kit.require 'ken'
it = ken()

# Async tests
it.async [
	it 'basic 1', ->
		it.eq 'ok', 'ok'
	it 'basic 2', ->
		it.eq { a: 1, b: 1 }, { a: 1, b: 2 }

	# Sync tests
	kit.flow [
		it 'basic 3', ->
			it.eq 'ok', 'ok'
		it 'basic 4', ->
			it.eq 'ok', 'ok'
	]
]
