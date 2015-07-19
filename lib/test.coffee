kit = require './kit'
{ _, Promise } = kit
cs = kit.require 'colors/safe'
assert = require 'assert'

helpers = {
	eq: assert.strictEqual
}

module.exports = ken = (msg, fn) ->
	self = this
	msg = if _.isUndefined self.msg
		msg
	else
		self.msg + ' ' + msg

	Promise.resolve().then ->
		fn _.assign ken.bind({ msg }), helpers
	.then ->
		console.log cs.green('o'), msg
	, (err) ->
		console.error cs.red('x'), msg, err.stack
		Promise.reject err
