/**
	 * An throttle version of `Q.all`, it runs all the tasks under
	 * a concurrent limitation.
	 * @param  {Int} limit The max task to run at the same time. It's optional.
	 * Default is Infinity.
	 * @param  {Array | Function} list
	 * If the list is an array, it should be a list of functions or promises. And each function will return a promise.
	 * If the list is a function, it should be a iterator that returns a promise,
	 * when it returns `undefined`, the iteration ends.
	 * @param {Boolean} save_resutls Whether to save each promise's result or not.
	 * @return {Promise} You can get each round's results by using the `promise.progress`.
 */
var as_ync1 = function(limit, list, save_resutls) {
  var defer, from, is_iter_done, iter, iter_index, list_len, resutls, running;
  if (save_resutls == null) {
    save_resutls = true;
  }
  from = 0;
  resutls = [];
  iter_index = 0;
  running = 0;
  is_iter_done = false;
  defer = Q.defer();
  if (!_.isNumber(limit)) {
    save_resutls = list;
    list = limit;
    limit = Infinity;
  }
  if (_.isArray(list)) {
    list_len = list.length - 1;
    return iter = function(i) {
      if (i > list_len) {
        return;
      }
      if (_.isFunction(list[i])) {
        return list[i](i);
      } else {
        return list[i];
      }
    };
  } else if (_.isFunction(list)) {
    return iter = list;
  } else {
    throw new Error('unknown list type: ' + typeof list);
  }
};


/**
   * Indent a text block.
   * @param {String} text
   * @param {Int} num
   * @param {String} char
   * @param {RegExp} reg Default is `/^/mg`.
   * @return {String} The indented text block.
   * @example
   * ```coffee
   * # Increase
   * kit.indent "one\ntwo", 2
   * # => "  one\n  two"
   *
   * # Decrease
   * kit.indent "--one\n--two", 0, '', /^--/mg
   * # => "one\ntwo"
   * ```
 */
let indent = function(text, num, char, reg) {
  var prefix;
  if (num == null) {
    num = 0;
  }
  if (char == null) {
    char = ' ';
  }
  if (reg == null) {
    reg = /^/mg;
  }
  prefix = _.times(num, function() {
    return char;
  }).join('');
  return text.replace(reg, prefix);
};

/**
	 * Indent a text block.
	 * @param {String} text
	 * @param {Int} num
	 * @param {String} char
	 * @param {RegExp} reg Default is `/^/mg`.
	 * @return {String} The indented text block.
	 * @example
	 * ```coffee
	 * # Increase
	 * kit.indent "one\ntwo", 2
	 * # => "  one\n  two"
	 *
	 * # Decrease
	 * kit.indent "--one\n--two", 0, '', /^--/mg
	 * # => "one\ntwo"
	 * ```
 */
function indent (text, num, char, reg) {
  var prefix;
  if (num == null) {
    num = 0;
  }
  if (char == null) {
    char = ' ';
  }
  if (reg == null) {
    reg = /^/mg;
  }
  prefix = _.times(num, function() {
    return char;
  }).join('');
  return text.replace(reg, prefix);
};
