var Promise, _, br, bufEq, ken, kit;

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
 * 	timeout: 5000
 * 	logPass: (msg, span) ->
 * 	logFail: (msg, err, span) ->
 * 	logFinal: (passed, failed) ->
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
  var failed, isEnd, it, onFinal, onUnhandledRejection, passed, title;
  if (opts == null) {
    opts = {};
  }
  title = br.underline(br.grey('ken >'));
  _.defaults(opts, {
    isBail: true,
    isExitOnUnhandled: true,
    timeout: 5000,
    logPass: function(msg, span) {
      return console.log(title, br.green('o'), msg, br.grey("(" + span + "ms)"));
    },
    logFail: function(msg, err, span) {
      return console.error(title, br.red('x'), msg, br.grey("(" + span + "ms)"), '\n' + kit.indent(err.stack, 2));
    },
    logFinal: function(passed, failed) {
      return console.log(title + " " + (br.cyan("passed")) + " " + (br.green(passed)) + "\n" + title + " " + (br.cyan("failed")) + " " + (br.red(failed)));
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
  isEnd = false;
  it = function(msg, fn) {
    var tsetFn;
    tsetFn = function() {
      var startTime, timeouter;
      timeouter = null;
      startTime = Date.now();
      return new Promise(function(resolve, reject) {
        resolve(fn());
        return timeouter = setTimeout(reject, opts.timeout, new Error("test_timeout"));
      }).then(function() {
        clearTimeout(timeouter);
        passed++;
        if (isEnd) {
          return;
        }
        return opts.logPass(tsetFn.msg, Date.now() - startTime);
      }, function(err) {
        clearTimeout(timeouter);
        failed++;
        if (isEnd) {
          return;
        }
        opts.logFail(tsetFn.msg, err, Date.now() - startTime);
        if (opts.isBail) {
          return Promise.reject(err);
        }
      });
    };
    tsetFn.msg = msg;
    return tsetFn;
  };
  onFinal = function() {
    isEnd = true;
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
      var eq;
      eq = actual instanceof Buffer || expected instanceof Buffer ? bufEq : _.eq;
      if (eq(actual, expected)) {
        return Promise.resolve();
      } else {
        return Promise.reject(new Error("\n" + (br.magenta("<<<<<<< actual")) + "\n" + (kit.xinspect(actual)) + "\n" + (br.magenta("=======")) + "\n" + (kit.xinspect(expected)) + "\n" + (br.magenta(">>>>>>> expected"))));
      }
    }
  });
};

bufEq = function(a, b) {
  if (Buffer.compare(a, b)) {
    return false;
  } else {
    return true;
  }
};

module.exports = ken;
