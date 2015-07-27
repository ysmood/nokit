var Promise, _, assert, cs, ken, kit;

kit = require('./kit');

_ = kit._, Promise = kit.Promise;

cs = kit.require('colors/safe');

assert = require('assert');


/**
 * A simple promise based test module.
 * @param  {Object} opts Defaults:
 * ```coffeescript
 * {
 * 	isBail: true
 * 	logPass: (msg) ->
 * 		console.log cs.green('o'), msg
 * 	logFail: (err) ->
 * 		console.error cs.red('x'), err
 * 	logFinal: (passed, failed) ->
 * 		console.log """
 * 		#{cs.grey '----------------'}
 * 		pass  #{cs.green passed}
 * 		fail  #{cs.red failed}
 * 		"""
 * 	onEnd: (passed, failed) ->
 * 		if failed
 * 			process.exit 1
 * }
 * ```
 * @return {Promise}
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
 * ```
 */

ken = function(opts) {
  var failed, onFinal, passed, test;
  if (opts == null) {
    opts = {};
  }
  _.defaults(opts, {
    isBail: true,
    logPass: function(msg) {
      return console.log(cs.green('o'), cs.grey(msg));
    },
    logFail: function(err) {
      return console.error(cs.red('x'), err);
    },
    logFinal: function(passed, failed) {
      return console.log((cs.grey('----------------')) + "\npass " + (cs.green(passed)) + "\nfail " + (cs.red(failed)));
    },
    onEnd: function(passed, failed) {
      if (failed) {
        return process.exit(1);
      }
    }
  });
  passed = 0;
  failed = 0;
  test = function(msg, fn) {
    return function() {
      return Promise.resolve().then(fn).then(function() {
        passed++;
        return opts.logPass(msg);
      }, function(err) {
        failed++;
        opts.logFail(err);
        if (opts.isBail) {
          return Promise.reject(err);
        }
      });
    };
  };
  onFinal = function() {
    opts.logFinal(passed, failed);
    return opts.onEnd(passed, failed);
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

module.exports = _.extend(ken, {
  eq: assert.strictEqual,
  deepEq: assert.deepEqual
});
