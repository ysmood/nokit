#!/usr/bin/env node
// This is the nofile entrace for project "nokit"

try {
	require('../lib/no')();
} catch (err) {
	if (err.source === 'nokit') {
		kit = require('../lib/kit');
		br = kit.require('brush');
		kit.err(br.red('[Error] ' + err.message), { isShowTime: false });
		process.exit(1);
	} else {
		throw err;
	}
}
