kit = require './kit'
{ _, Promise } = kit
cs = kit.require 'colors/safe'
assert = require 'assert'

helpers = {
	eq: assert.strictEqual
}

class TestError extends Error
	constructor: (msg) ->
		@details = msg
		super msg

module.exports = ken = (msg, opts) ->
	opts = _.assign {
		logPass: (msg) ->
			console.log cs.green('o'), cs.cyan(msg)
		logFail: (msg, err) ->
			console.error cs.red('x'), cs.yellow(msg), (err and err.stack)
	}, opts, opts

	
