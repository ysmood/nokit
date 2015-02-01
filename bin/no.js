#!/usr/bin/env node

try {
	require('../dist/no')();
} catch (err) {
	if (err.source === 'nokit') {
		kit = require('../dist/kit');
		cs = kit.require('colors/safe');
		kit.err(cs.red('[Error] ' + err.message), { isShowTime: false });
	} else {
		throw err;
	}
}
