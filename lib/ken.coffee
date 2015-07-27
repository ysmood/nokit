kit = require './kit'
{ _, Promise } = kit
cs = kit.require 'colors/safe'
assert = require 'assert'

###*
 * A simple promise based test module.
 * @param  {Object} opts Defaults:
 * ```coffeescript
 * {
 * 	isBail: true
 * 	logPass: (msg) ->
 * 		console.log cs.green('o'), msg
 * 	logFail: (err) ->
 * 		console.error cs.red('x'), err
 * 	logFinal: (all, passed, failed) ->
 * 		console.log """
 * 		#{cs.grey '----------------'}
 * 		tests #{cs.cyan all}
 * 		pass  #{cs.green passed}
 * 		fail  #{cs.red failed}
 * 		"""
 * 	onEnd: (all, passed, failed) ->
 * 		if failed
 * 			process.exit 1
 * }
 * ```
 * @return {Promise}
 * @example
 * ```coffeescript
 * ken = kit.require 'ken'
 * test = ken {
 *     isBail: true
 * }
 *
 * test.sync [
 *     test 'basic 1', ->
 *         ken.eq 'ok', 'ok'
 *     test 'basic 2', ->
 *         ken.deepEq { a: 1, b: 2 }, { a: '1', b: 2 }
 *
 *     kit.flow [
 *         test 'basic 3', ->
 *             ken.eq 'ok', 'ok'
 *         test 'basic 4', ->
 *             ken.eq 'ok', 'ok'
 *     ]
 * ]
 * ```
###
ken = (opts = {}) ->
	_.defaults opts, {
		isBail: true
		logPass: (msg) ->
			console.log cs.green('o'), msg
		logFail: (err) ->
			console.error cs.red('x'), err
		logFinal: (all, passed, failed) ->
			console.log """
			#{cs.grey '----------------'}
			tests #{cs.cyan all}
			pass  #{cs.green passed}
			fail  #{cs.red failed}
			"""
		onEnd: (all, passed, failed) ->
			if failed
				process.exit 1
	}

	all = 0
	passed = 0
	failed = 0

	test = (msg, fn) ->
		all++
		->
			Promise.resolve()
			.then fn
			.then ->
				passed++
				opts.logPass msg
			, (err) ->
				failed++
				opts.logFail err
				Promise.reject err if opts.isBail

	onFinal = ->
		opts.logFinal all, passed, failed
		opts.onEnd all, passed, failed

	_.extend test, {
		async: ->
			kit.async.apply 0, arguments
			.then onFinal, onFinal
		sync: ->
			kit.flow.apply(0, arguments)()
			.then onFinal, onFinal
	}

_.extend module.exports, {
	eq: assert.strictEqual
	deepEq: assert.deepEqual
}
