kit = require './kit'
{ _, Promise } = kit
br = kit.require 'brush'

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
 * it = ken()
 *
 * # Async tests
 * it.async [
 * 	it 'basic 1', ->
 * 		it.eq 'ok', 'ok'
 * 	it 'basic 2', ->
 * 		it.eq { a: 1, b: 2 }, { a: 1, b: 2 }
 *
 * 	# Sync tests
 * 	kit.flow [
 * 		it 'basic 3', ->
 * 			it.eq 'ok', 'ok'
 * 		it 'basic 4', ->
 * 			it.eq 'ok', 'ok'
 * 	]
 * ]
 * .then ({ failed }) ->
 * 	process.exit failed
 * ```
 * @example
 * Filter the tests, only it the odd ones.
 * ```coffeescript
 * ken = kit.require 'ken'
 * it = ken()
 *
 * # Async tests
 * it.async(
 * 	[
 * 		it 'basic 1', ->
 * 			it.eq 'ok', 'ok'
 * 		it 'basic 2', ->
 * 			it.eq { a: 1, b: 2 }, { a: 1, b: 2 }
 * 		it 'basic 3', ->
 * 			it.eq 1, 1
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
	title = br.underline br.grey 'ken >'
	_.defaults opts, {
		isBail: true
		isExitOnUnhandled: true,
		logPass: (msg) ->
			console.log title, br.green('o'), msg
		logFail: (msg, err) ->
			console.error title, br.red('x'), msg, '\n' + kit.indent(err.stack, 2)
		logFinal: (passed, failed) ->
			console.log """
			#{title} pass #{br.green passed}
			#{title} fail #{br.red failed}
			"""
	}

	if opts.isExitOnUnhandled
		onUnhandledRejection = Promise.onUnhandledRejection
		Promise.onUnhandledRejection = (reason, p) ->
			onUnhandledRejection reason, p
			process.exit 1

	passed = 0
	failed = 0

	it = (msg, fn) ->
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

	_.extend it, {
		async: ->
			kit.async.apply 0, arguments
			.then onFinal, onFinal
		sync: ->
			kit.flow.apply(0, arguments)()
			.then onFinal, onFinal

		eq: (actual, expected) ->
			if _.eq actual, expected
				Promise.resolve()
			else
				Promise.reject new Error """
				\n#{br.magenta "<<<<<<< actual"}
				#{kit.xinspect actual}
				#{br.magenta "======="}
				#{kit.xinspect expected}
				#{br.magenta ">>>>>>> expected"}
				"""
	}

module.exports = ken
