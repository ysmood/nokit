kit = require './kit'
{ _, Promise } = kit
cs = kit.require 'colors/safe'
assert = require 'assert'

###*
 * - check if some test never failed (count)
 * - print the test summary
 * - print the assert info
 * - async test flow
 * - sync test flow
###

helpers = {
	eq: assert.strictEqual
}

module.exports = (opts = {}) ->
	_.defaults opts, {
		logPass: (msg) ->
			console.log cs.green('o'), msg
		onError: (err) ->
			console.log cs.red('x'), err
			# Promise.reject err
	}

	test = _.extend ((msg, fn) -> ->
		Promise.resolve()
		.then fn
		.then ->
			opts.logPass msg
		, opts.onError
	), helpers