// Expose global helpers.

var kit = require('./dist/kit');

kit._.extend(global, {
	_: kit._,
	kit: kit,
	Promise: kit.Promise,
	warp: kit.warp,
	drives: kit.require('drives')
});
