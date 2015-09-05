var Promise, _, br, ken, kit;

kit = require('./kit');

_ = kit._, Promise = kit.Promise;

br = kit.require('brush');


/**
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
 */

ken = function(opts) {
  var failed, it, onFinal, onUnhandledRejection, passed, title;
  if (opts == null) {
    opts = {};
  }
  title = br.underline(br.grey('ken >'));
  _.defaults(opts, {
    isBail: true,
    isExitOnUnhandled: true,
    logPass: function(msg) {
      return console.log(title, br.green('o'), msg);
    },
    logFail: function(msg, err) {
      return console.error(title, br.red('x'), msg, '\n' + kit.indent(err.stack, 2));
    },
    logFinal: function(passed, failed) {
      return console.log(title + " pass " + (br.green(passed)) + "\n" + title + " fail " + (br.red(failed)));
    }
  });
  if (opts.isExitOnUnhandled) {
    onUnhandledRejection = Promise.onUnhandledRejection;
    Promise.onUnhandledRejection = function(reason, p) {
      onUnhandledRejection(reason, p);
      return process.exit(1);
    };
  }
  passed = 0;
  failed = 0;
  it = function(msg, fn) {
    var tsetFn;
    tsetFn = function() {
      return Promise.resolve().then(fn).then(function() {
        passed++;
        return opts.logPass(tsetFn.msg);
      }, function(err) {
        failed++;
        opts.logFail(tsetFn.msg, err);
        if (opts.isBail) {
          return Promise.reject(err);
        }
      });
    };
    tsetFn.msg = msg;
    return tsetFn;
  };
  onFinal = function() {
    opts.logFinal(passed, failed);
    return {
      passed: passed,
      failed: failed
    };
  };
  return _.extend(it, {
    async: function() {
      return kit.async.apply(0, arguments).then(onFinal, onFinal);
    },
    sync: function() {
      return kit.flow.apply(0, arguments)().then(onFinal, onFinal);
    },
    eq: function(actual, expected) {
      if (_.eq(actual, expected)) {
        return Promise.resolve();
      } else {
        return Promise.reject(new Error("\n" + (br.magenta("<<<<<<< actual")) + "\n" + (kit.xinspect(actual)) + "\n" + (br.magenta("=======")) + "\n" + (kit.xinspect(expected)) + "\n" + (br.magenta(">>>>>>> expected"))));
      }
    }
  });
};

module.exports = ken;
