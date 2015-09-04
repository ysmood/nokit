kit = require './kit'
{ _, Promise } = kit
br = kit.require 'brush'
assert = require 'assert'

###*
 * A simple promise based module for unit tests.
 * @param  {Object} opts Defaults:
 * ```coffeescript
 * {
 * 	isBail: true
 * 	isExitOnUnhandled: true
 * 	logPass: (msg) ->
 * 		console.log br.green('o'), msg
 * 	logFail: (msg, err) ->
 * 		console.error br.red('x'), msg, err
 * 	logFinal: (passed, failed) ->
 * 		console.log """
 * 		#{br.grey '----------------'}
 * 		pass  #{br.green passed}
 * 		fail  #{br.red failed}
 * 		"""
 * }
 * ```
 * @return {Function} It has two members: `{ async, sync }`.
 * Both of them will resolve `{ passed, failed }`.
 * @example
 * ```coffeescript
 * ken = kit.require 'ken'
 * test = ken()
 *
 * # Async tests
 * test.async [
 * 	test 'basic 1', ->
 * 		ken.eq 'ok', 'ok'
 * 	test 'basic 2', ->
 * 		ken.deepEq { a: 1, b: 2 }, { a: 1, b: 2 }
 *
 * 	# Sync tests
 * 	kit.flow [
 * 		test 'basic 3', ->
 * 			ken.eq 'ok', 'ok'
 * 		test 'basic 4', ->
 * 			ken.eq 'ok', 'ok'
 * 	]
 * ]
 * .then ({ failed }) ->
 * 	process.exit failed
 * ```
 * @example
 * Filter the tests, only test the odd ones.
 * ```coffeescript
 * ken = kit.require 'ken'
 * test = ken()
 *
 * # Async tests
 * test.async(
 * 	[
 * 		test 'basic 1', ->
 * 			ken.eq 'ok', 'ok'
 * 		test 'basic 2', ->
 * 			ken.deepEq { a: 1, b: 2 }, { a: 1, b: 2 }
 * 		test 'basic 3', ->
 * 			ken.deepEq 1, 1
 * 	]
 * 	.filter (fn, index) -> index % 2
 * 	.map (fn) ->
 * 		# prefix all the messages with current file path
 * 		fn.msg = "#{__filename} - #{fn.msg}"
 * 		fn
 * ).then ({ failed }) ->
 * 	process.exit failed
 * ```
###
ken = (opts = {}) ->
	_.defaults opts, {
		isBail: true
		isExitOnUnhandled: true,
		logPass: (msg) ->
			console.log br.green('o'), br.grey(msg)
		logFail: (msg, err) ->
			console.error br.red('x'), br.grey(msg), err.message
		logFinal: (passed, failed) ->
			console.log """
			#{br.grey '----------------'}
			pass #{br.green passed}
			fail #{br.red failed}
			"""
	}

	if opts.isExitOnUnhandled
		onUnhandledRejection = Promise.onUnhandledRejection
		Promise.onUnhandledRejection = (reason, p) ->
			onUnhandledRejection reason, p
			process.exit 1

	passed = 0
	failed = 0

	test = (msg, fn) ->
		tsetFn = ->
			Promise.resolve()
			.then fn
			.then ->
				passed++
				opts.logPass tsetFn.msg
			, (err) ->
				failed++
				opts.logFail tsetFn.msg, err
				Promise.reject err if opts.isBail

		tsetFn.msg = msg

		tsetFn

	onFinal = ->
		opts.logFinal passed, failed
		return { passed, failed }

	_.extend test, {
		async: ->
			kit.async.apply 0, arguments
			.then onFinal, onFinal
		sync: ->
			kit.flow.apply(0, arguments)()
			.then onFinal, onFinal
	}

wrap = (fn) -> ->
	try
		Promise.resolve fn.apply(0, arguments)
	catch err
		Promise.reject err

module.exports = _.extend ken, {
	eq: wrap assert.strictEqual

	deepEq: wrap assert.deepEqual
}
