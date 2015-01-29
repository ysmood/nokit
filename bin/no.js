#!/usr/bin/env node

try {
	require('../dist/no')();
} catch (err) {
	if (err.source === 'nokit') {
		kit = require('../dist/kit');
		kit.err(('[Error] ' + err.message).red, { isShowTime: false });
	} else {
		throw err;
	}
}
