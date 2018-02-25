/*
	For help info run "npm run no -- -h"
*/

const kit = require('./lib/kit');

module.exports = function (task, option) {

	option('-a, --all', 'rebuild with dependencies');
	task('default build b', ['clean', 'lint'], 'build project', function () {
		kit.require('drives');

		kit.warp('lib/*.js')
		.load(kit.drives.comment2md({
			h: 2,
			tpl: 'doc/readme.jst.md'
		})).run()
	});

	option('-d, --debug', 'enable node debug mode');
	option('-p, --port [8283]', 'node debug mode', 8283);
	task('lab l', 'run and monitor "test/lab.js"', function (opts) {
		const args = ['test/lab.js'];

		if (opts.debug) {
			args.splice(0, 0, '--nodejs', 'debug');
		}

		return kit.monitorApp({
			bin: 'node',
			args,
			watchList: ['test/*', 'lib/**']
		});
	});

	task('lint', () => {
		return kit.spawn('eslint', ['--cache', '.'])
	})

	task('clean', 'clean cache', function (opts) {
		if (opts.all) {
			return kit.all([
				kit.remove('.nokit')
			]);
		}
	});

	option('-g, --grep <pattern>', 'test pattern', '');
	return task('test t', ['build'], 'unit tests', opts =>
		kit.spawn('junit', [
			'-g', opts.grep,
			'-t', 1000 * 20,
			'test/basic.js'
		])
	);
};