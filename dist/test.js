var Promise, TestError, _, assert, cs, helpers, ken, kit,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

kit = require('./kit');

_ = kit._, Promise = kit.Promise;

cs = kit.require('colors/safe');

assert = require('assert');

helpers = {
  eq: assert.strictEqual
};

TestError = (function(superClass) {
  extend(TestError, superClass);

  function TestError(msg) {
    this.details = msg;
    TestError.__super__.constructor.call(this, msg);
  }

  return TestError;

})(Error);

module.exports = ken = function(msg, opts) {
  return opts = _.assign({
    logPass: function(msg) {
      return console.log(cs.green('o'), cs.cyan(msg));
    },
    logFail: function(msg, err) {
      return console.error(cs.red('x'), cs.yellow(msg), err && err.stack);
    }
  }, opts, opts);
};
