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

module.exports = ken = (msg, opts, fn) ->
	self = @

	if _.isFunction opts
		fn = opts
		opts = {}

	opts = _.assign {
		logPass: (msg) ->
			console.log cs.green('o'), cs.cyan(msg)
		logFail: (msg, err) ->
			console.error cs.red('x'), cs.yellow(msg), (err and err.stack)
	}, self.opts, opts

	msg = if _.isUndefined self.msg
		msg
	else
		self.msg + ' ' + msg

	Promise.resolve().then ->
		fn _.assign ken.bind({ msg, opts }), helpers
	.then ->
		opts.logPass msg
	, (err) ->
		if not (err instanceof TestError)
			opts.logFail msg, err
			err = new TestError err

		Promise.reject err
