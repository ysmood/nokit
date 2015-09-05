var Promise, _, assert, br, ken, kit, wrap;

kit = require('./kit');

_ = kit._, Promise = kit.Promise;

br = kit.require('brush');

assert = require('assert');


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
 */

ken = function(opts) {
  var failed, onFinal, onUnhandledRejection, passed, test, title;
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
      return console.error(title, br.red('x'), msg, br.red(err.message));
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
  test = function(msg, fn) {
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
  return _.extend(test, {
    async: function() {
      return kit.async.apply(0, arguments).then(onFinal, onFinal);
    },
    sync: function() {
      return kit.flow.apply(0, arguments)().then(onFinal, onFinal);
    }
  });
};

wrap = function(fn) {
  return function() {
    var err;
    try {
      return Promise.resolve(fn.apply(0, arguments));
    } catch (_error) {
      err = _error;
      return Promise.reject(err);
    }
  };
};

module.exports = _.extend(ken, {
  eq: wrap(assert.strictEqual),
  deepEq: wrap(assert.deepEqual)
});
