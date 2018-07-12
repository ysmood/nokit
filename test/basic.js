const kit = require('../lib/kit');
const http = require('http');
const net = require('net');
const {
	_,
	Promise
} = kit;
kit.require('drives');

const createRandomServer = function (handler, fn) {
	const server = http.createServer(handler);

	const listen = kit.promisify(server.listen, server);

	return listen(0).then(() => fn(server.address().port)).then(function (res) {
		server.close();
		return res;
	}, function (err) {
		server.close();
		return Promise.reject(err);
	});
};

const getPort = function () {
	const proxy = kit.require('proxy');
	const app = proxy.flow();
	let port = 0;

	return app.listen(port).then(function () {
		({
			port
		} = app.server.address());
		return app.close();
	}).then(() => port);
};

const unixSep = p => p.replace(/\\/g, '/');

const tempPath = () => `test/temp/${Date.now()}${(Math.random() + '').slice(2)}`;

kit.removeSync('test/temp');
kit.mkdirsSync('test/temp');

module.exports = function (it) {
	it('brush', function () {
		const br = kit.require('brush');
		return it.eq(br.red('ok'), '\u001b[31mok\u001b[39m');
	});

	it('brush disable', function () {
		const br = kit.require('brush');
		br.isEnabled = false;
		const ret = br.green('ok');
		br.isEnabled = true;
		return it.eq(ret, 'ok');
	});

	it('log', function () {
		kit.logs('a', 'b', 'c');
		return kit.log('%s + %s + %s', ['red'.red, 'green'.green, 'blue'.blue]);
	});

	it('log err', function () {
		kit.errs('a', 'b', 'c');
		return kit.err('%s + %s + %s', ['red'.red, 'green'.green, 'blue'.blue]);
	});

	it('monitorApp', after => new Promise(function (resolve) {
		const p = tempPath() + '/monitorApp-test.coffee';
		kit.copySync('test/fixtures/monitorApp.coffee', p);
		var {
			stop
		} = kit.monitorApp({
			bin: 'coffee',
			args: [p],
			onRestart(path) {
				resolve(it.eq(path, kit.path.resolve(p)));
				return stop();
			}
		});
		const tmr = setInterval(() => kit.outputFileSync(p, 'process.exit 0'), 1000);

		return after(() => clearInterval(tmr));
	}));

	it('parseComment coffee', function () {
		const path = 'test/fixtures/comment.coffee';
		return kit.readFile(path, 'utf8')
			.then(function (str) {
				const array = kit.parseComment(str),
					obj = array[0],
					[tag] = Array.from(obj.tags);

				return Promise.all([
					it.eq(tag.type, 'Int'),
					it.eq(tag.name, 'limit')
				]);
			});
	});

	it('parseComment js', function () {
		const path = 'test/fixtures/comment.js';
		return kit.readFile(path, 'utf8')
			.then(function (str) {
				const array = kit.parseComment(str),
					obj = array[0],
					{
						name
					} = obj,
					[tag] = Array.from(obj.tags);

				return Promise.all([
					it.eq(name, 'as_ync1'),
					it.eq(tag.type, 'Int'),
					it.eq(tag.name, 'limit')
				]);
			});
	});

	it('parseComment js 2', function () {
		const path = 'test/fixtures/comment.js';
		return kit.readFile(path, 'utf8')
			.then(function (str) {
				const parsed = kit.parseComment(str);
				const [n0, { // eslint-disable-line
					name
				}] = Array.from(parsed);

				return it.eq(name, 'indent');
			});
	});

	it('crypto', function () {
		const en = kit.encrypt('123', 'test');
		return it.eq(kit.decrypt(en, 'test').toString(), '123');
	});

	it('regexReduce', function () {
		const out = kit.regexReduce(/\w(\d+)/g, 'a1, b10, c3', function (ret, ms) {
			ret.push(ms[1]);
			return ret;
		}, []);

		return it.eq(['1', '10', '3'], out);
	});

	it('regexMap', function () {
		const out = kit.regexMap(/\w(\d+)/g, 'a1, b10, c3', 1);
		return it.eq(['1', '10', '3'], out);
	});

	it('replace async 01', function () {
		const out = kit.replace('test', /t/g, () => kit.sleep(100).then(() => 'x'));

		return it.eq(out, 'xesx');
	});

	it('replace async 02', function () {
		const out = kit.replace('test', /^t/g, m => kit.sleep(_.random(0, 100)).then(() => `x${m}x`));

		return it.eq(out, 'xtxest');
	});

	it('replace async 03', function () {
		const out = kit.replace('test', /e(s)/g, (m, p1) => p1);

		return it.eq(out, 'tst');
	});

	it('replaceSync async 01', function () {
		const out = kit.replaceSync('test', /t/g, () => kit.sleep(100).then(() => 'x'));

		return it.eq(out, 'xesx');
	});

	it('replaceSync async 02', function () {
		const out = kit.replace('test', /^t/g, m => kit.sleep(_.random(0, 100)).then(() => `x${m}x`));

		return it.eq(out, 'xtxest');
	});

	it('replaceSync async 03', function () {
		const out = kit.replaceSync('test', /e(s)/g, (m, p1) => p1);

		return it.eq(out, 'tst');
	});

	it('request', function () {
		const info = 'ok';

		return createRandomServer((req, res) => res.end(info), port =>
			kit.request({
				url: {
					protocol: 'http:',
					hostname: '127.0.0.1',
					port
				}
			})
			.then(body => it.eq(body + '', info))
		);
	});

	it('request timeout', () =>
		createRandomServer((req, res) =>
			kit.sleep(60).then(() => res.end())

			,
			function (port) {
				const promise = kit.request({
					url: `127.0.0.1:${port}`,
					timeout: 50
				});

				return promise.catch(err => it.eq(err.message, 'timeout'));
			})
	);

	it('request reqPipe', function () {
		const path = 'nofile.js';
		const info = kit.fs.readFileSync(path, 'utf8');

		return createRandomServer(function (req, res) {
			let data = '';
			req.on('data', chunk => data += chunk);
			return req.on('end', () => res.end(data));
		}, function (port) {
			const file = kit.fs.createReadStream(path);
			const {
				size
			} = kit.fs.statSync(path);
			return kit.request({
					url: `127.0.0.1:${port}`,
					headers: {
						'content-length': size
					},
					reqPipe: file
				})
				.then(body => it.eq(body + '', info));
		});
	});

	it('request form-data', () =>
		createRandomServer(function (req, res) {
				const form = new require('formidable').IncomingForm();

				return form.parse(req, (err, fields) => res.end(fields['f.md'].length.toString()));
			}

			,
			function (port) {
				const form = new(require('form-data'));

				const buffer = kit.fs.readFileSync('nofile.js');

				form.append('a.txt', 'content');
				form.append('f.md', buffer);

				return kit.request({
						url: `127.0.0.1:${port}`,
						headers: form.getHeaders(),
						setTE: true,
						reqPipe: form
					})
					.then(body => it.eq(+body, buffer.length));
			})
	);

	it('exec', function () {
		const p = kit.exec('echo exec_ok');
		return p.then(({
				stdout
			}) =>
			p.process.then(proc =>
				Promise.all([
					it.eq(proc.pid > 0, true),
					it.eq(stdout.indexOf('exec_ok\n') > -1, true)
				])));
	});

	it('parseDependency', () =>
		kit.parseDependency('test/fixtures/depMain.coffee')
		.then(paths =>
			it.eq(paths.sort(), [
				'test/fixtures/dep1.coffee',
				'test/fixtures/dep2.coffee',
				'test/fixtures/dep3.coffee',
				'test/fixtures/depDir/dep4.js',
				'test/fixtures/depDir/dep5.coffee',
				'test/fixtures/depDir/dep6.coffee',
				'test/fixtures/depDir/imported1.coffee',
				'test/fixtures/depDir/imported2.coffee',
				'test/fixtures/depDir/imported3.coffee',
				'test/fixtures/depDir/lib/index.js',
				'test/fixtures/depMain.coffee'
			]))
	);

	it('indent', () => it.eq(kit.indent('a\nb', 2), '  a\n  b'));

	it('depsCache cache newer', function () {
		const cacheDir = tempPath();
		const file = 'test/fixtures/depsCache.txt';
		const dest = tempPath() + '/' + file + '.dest';
		kit.outputFileSync(dest, 'out');
		return kit.depsCache({
				deps: [file],
				dests: [dest],
				cacheDir
			})
			.then(() =>
				kit.depsCache({
					deps: [file],
					cacheDir
				})
				.then(cache => it.eq(cache.isNewer, true))
			);
	});

	it('warp map', function () {
		const tmp = tempPath();
		const cacheDir = tempPath();

		const counter = function (info) {
			info.dest.ext = '.coffee';
			return info.set(info.contents.length);
		};

		return kit.warp('test/fixtures/depDir/**/*.js')
			.load(kit.drives.reader({
				cacheDir
			}))
			.load(counter)
			.run(tmp)
			.then(() => kit.glob(tmp + '/**/*.coffee')).then(paths =>
				it.eq(paths.map(unixSep), [
					`${tmp}/dep4.coffee`,
					`${tmp}/lib/index.coffee`
				]));
	});

	it('warp custom reader', function () {
		const tmp = tempPath();

		const myReader = _.extend(function () {
			return kit.readFile(this.path, 'utf8')
				.then(str => {
					return this.set(str.replace(/\r\n/g, '\n'));
				});
		}, {
			isReader: true
		});

		return kit.warp('test/fixtures/**/*.js')
			.load(myReader)
			.run(tmp)
			.then(() => kit.readFile(tmp + '/comment.js', 'utf8')).then(str => it.eq(str.slice(0, 11), "/**\n\t * An "));
	});

	it('warp concat', function () {
		const out = tempPath();
		const file = 'warp_all.coffee';
		const cacheDir = tempPath();

		return kit.warp('test/fixtures/depDir/**/*.coffee')
			.load(kit.drives.reader({
				cacheDir
			}))
			.load(kit.drives.concat(file))
			.run(out)
			.then(() => kit.readFile(out + '/' + file, 'utf8')).then(str => it.eq(str.indexOf("require './lib'") > 0, true));
	});

	it('warp auto', function () {
		const dir = tempPath();
		const path = dir + '/compiler.all';
		const cacheDir = tempPath();

		return kit.warp('test/fixtures/compiler/*')
			.load(kit.drives.reader({
				cacheDir
			}))
			.load(kit.drives.auto('lint'))
			.load(kit.drives.auto('compile'))
			.load(kit.drives.auto('compress'))
			.load(kit.drives.concat('compiler.all'))
			.run(dir)
			.then(function () {
				const str = kit.readFileSync(path, 'utf8');
				return it.eq(_.trim(str).split('\n').sort(), [
					'.test .bar{color:red}',
					'.test{color:red}',
					'var a;a=function(){return console.log("OK")};',
					'var a=function(n){return n};',
					'var table1;table1=[{id:1,name:"george"},{id:2}];'
				]);
			});
	});

	it('task deps', function () {
		const seq = [];

		kit.task('default', {
			deps: ['one'],
			description: '0'
		}, function () {
			seq.push('default');
			return seq;
		});

		kit.task('one', {
			deps: ['two']
		}, () => seq.push('one'));

		kit.task('two', {
			description: '2'
		}, () => seq.push('two'));

		return kit.task.run()
			.then(function (...args) {
				let seq;
				[seq] = Array.from(args[0]);
				return it.eq(seq, ['two', 'one', 'default']);
			});
	});

	it('task sequential', function () {
		const seq = [];

		kit.task('default', {
			deps: ['one', 'two'],
			isSequential: true
		}, () => seq.push(3));

		kit.task('one', () =>
			new Promise(function (r) {
				return setTimeout(function () {
					seq.push(1);
					return r();
				}, 5);
			})
		);

		kit.task('two', {
			description: '2'
		}, () => seq.push(2));

		return kit.task.run('default')
			.then(() => it.eq(seq, [1, 2, 3]));
	});

	it('defaultArgs', function () {
		const fn = function () {};
		return it.eq((kit.defaultArgs(['c', fn], {
			str1: {
				String: '0'
			},
			fn: {
				Function() {
					return 'test';
				}
			},
			str2: {
				String: '1'
			}
		})), {
			str1: 'c',
			fn,
			str2: '1'
		});
	});

	it('defaultArgs2', function () {
		const fn = function () {};
		return it.eq((kit.defaultArgs(['c', fn, 'd', undefined], {
			str1: {
				String: '0'
			},
			fn: {
				Function() {
					return 'test';
				}
			},
			str2: {
				String: '1'
			}
		})), {
			str1: 'c',
			fn,
			str2: 'd'
		});
	});

	it('fuzzySearch', function () {
		const ret = kit.fuzzySearch('ys', [
			'sy', 'yxs', 'ysbb', 'xys', 'ysx', 'ysb', 'syx'
		]);
		return it.eq(ret, 'ysx');
	});

	it('fuzzySearch order', function () {
		const ret = kit.fuzzySearch('b', [
			'lb', 'build'
		]);
		return it.eq(ret, 'build');
	});

	it('fuzzySearch not found', () =>
		it.eq(kit.fuzzySearch('ys', [
			'ss', 'ab'
		]), undefined)
	);

	it('proxy url', function () {
		const proxy = kit.require('proxy');

		return createRandomServer(proxy.flow([
				proxy.select(/\/site$/, $ => $.body = `site${$.req.headers.proxy}`),

				proxy.select(/\/proxy$/, proxy.url({
					url: '/site',
					bps: 1024 * 10,
					handleReqHeaders(headers) {
						headers['proxy'] = '-proxy';
						return headers;
					},
					handleResHeaders(headers) {
						headers['x'] = '-ok';
						return headers;
					},
					handleResBody(body) {
						return body + '-body';
					}
				}))
			]), port =>
			kit.request({
				url: `http://127.0.0.1:${port}/proxy`,
				body: false
			})
		).then(({
			headers,
			body
		}) => it.eq('site-proxy-body-ok', body + headers.x));
	});

	it('proxy url handleReqData', function () {
		const proxy = kit.require('proxy');
		const now = Date.now() + '';

		return createRandomServer(proxy.flow([
				proxy.body(),

				proxy.select('/site', $ => $.body = $.reqBody),

				proxy.select('/proxy', proxy.url({
					url: '/site',
					handleReqData(req) {
						return req.body;
					}
				}))
			]), port =>
			kit.request({
				url: `http://127.0.0.1:${port}/proxy`,
				reqData: now
			})
		).then(body => it.eq(body + '', now));
	});

	it('proxy flow handler', function () {
		const proxy = kit.require('proxy');

		const routes = [
			$ => new Promise(function (r) {
				return $.req.on('data', function (data) {
					$.body = `echo: ${data}`;
					return r();
				});
			})
		];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request({
				url: `http://127.0.0.1:${port}`,
				reqData: 'test'
			})
			.then(body => it.eq('echo: test', body))
		);
	});

	it('proxy flow string middleware', function () {
		const proxy = kit.require('proxy');

		return createRandomServer(proxy.flow(['string works']), port =>
			kit.request({
				url: `http://127.0.0.1:${port}`
			})
			.then(body => it.eq('string works', body))
		);
	});

	it('proxy flow body', function () {
		const proxy = kit.require('proxy');

		const routes = [
			proxy.body({
				memoryLimit: 5
			}),
			$ => $.body = $.reqBody + 'ok'
		];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request({
				url: `http://127.0.0.1:${port}`,
				reqData: '12345678901234567890'
			})
			.then(body => it.eq(body, '12345678901234567890ok'))
		);
	});

	it('proxy flow van', function () {
		const proxy = kit.require('proxy');

		const routes = [
			proxy.van,
			({
				van
			}) => van('ok')
		];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request(`http://127.0.0.1:${port}`)
			.then(body => it.eq(body, 'ok'))
		);
	});

	it('proxy flow url', function () {
		const proxy = kit.require('proxy');

		const routes = [proxy.select({
			url: /\/items\/(\d+)/
		}, $ => $.body = $.url[1])];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request(`http://127.0.0.1:${port}/items/123`)
			.then(body => it.eq(body, '123'))
		);
	});

	it('proxy flow url string', function () {
		const proxy = kit.require('proxy');

		const routes = [proxy.select('/items', $ => $.body = $.url)];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request(`http://127.0.0.1:${port}/items/123`)
			.then(body => it.eq(body, '/123'))
		);
	});

	it('proxy flow headers', function () {
		const proxy = kit.require('proxy');

		const routes = [proxy.select({
			headers: {
				'x': /ok/
			}
		}, $ => $.body = $.headers.x)];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request({
				url: `http://127.0.0.1:${port}`,
				headers: {
					x: 'ok'
				}
			})
			.then(body => it.eq('["ok"]', body))
		);
	});

	it('proxy flow headers not match', function () {
		const proxy = kit.require('proxy');

		const routes = [proxy.select({
			headers: {
				'x': /test/
			}
		}, $ => $.body = $.headers.x)];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request({
				url: `http://127.0.0.1:${port}`,
				headers: {
					x: 'ok'
				},
				body: false
			})
			.then(res => it.eq(404, res.statusCode))
		);
	});

	it('proxy flow 404', function () {
		const proxy = kit.require('proxy');

		const routes = [proxy.select({
			url: /\/items\/(\d+)/
		}, $ => $.body = $.url[1])];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request(`http://127.0.0.1:${port}/itemx`)
			.then(body => it.eq('Not Found', body))
		);
	});

	it('proxy flow promise', function () {
		const proxy = kit.require('proxy');

		const routes = [$ => $.body = kit.readFile('.gitignore')];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request(`http://127.0.0.1:${port}`)
			.then(body => it.eq(kit.readFileSync('.gitignore', 'utf8'), body + ''))
		);
	});

	it('proxy flow url match', function () {
		const proxy = kit.require('proxy');

		const routes = [proxy.select({
			url: proxy.match('/:page.html')
		}, $ => $.body = $.url.page)];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request(`http://127.0.0.1:${port}/index.html?a=10`)
			.then(body => it.eq('index', body))
		);
	});

	it('proxy flow post', function () {
		const proxy = kit.require('proxy');

		const routes = [proxy.select({
			method: 'POST'
		}, $ => $.body = $.method)];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request({
				method: 'POST',
				url: `http://127.0.0.1:${port}`
			})
			.then(body => it.eq('POST', body))
		);
	});

	it('proxy flow static', function () {
		const proxy = kit.require('proxy');

		const routes = [
			proxy.select({
				url: '/st'
			}, proxy.static('test/fixtures'))
		];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request(encodeURI(`http://127.0.0.1:${port}/st/ひまわり.txt`))
			.then(function (body) {
				const str = kit.readFileSync('test/fixtures/ひまわり.txt', 'utf8');
				return it.eq(str, body);
			})
		);
	});

	it('proxy flow etag', function () {
		const proxy = kit.require('proxy');

		const routes = [
			proxy.etag(),
			$ => $.body = 'test'
		];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request({
				url: `http://127.0.0.1:${port}`,
				body: false
			})
			.then(res => it.eq('349o', res.headers.etag))
		);
	});

	it('proxy flow midToFlow', function () {
		const proxy = kit.require('proxy');
		const bodyParser = require('body-parser');

		const routes = [
			proxy.midToFlow(bodyParser.json()),
			$ => $.body = $.req.body
		];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request({
				url: `http://127.0.0.1:${port}/`,
				reqData: '{"a": 10}',
				headers: {
					'Content-Type': 'application/json'
				}
			})
			.then(body => it.eq({
				a: 10
			}, JSON.parse(body)))
		);
	});

	it('proxy flow midToFlow no next', function () {
		const proxy = kit.require('proxy');

		const routes = [
			proxy.midToFlow((req, res) => res.end(req.url)),

			$ => $.body = 'no'
		];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request(`http://127.0.0.1:${port}/ok`)
			.then(body => it.eq(body + '', '/ok'))
		);
	});

	it('proxy flow midToFlow error', function () {
		const proxy = kit.require('proxy');

		const routes = [
			$ =>
			$.next().catch(() => $.body = 'ok'),

			proxy.midToFlow(() => a()) // eslint-disable-line
		];

		return createRandomServer(proxy.flow(routes), port =>
			kit.request(`http://127.0.0.1:${port}/`)
			.then(body => it.eq(body, 'ok'))
		);
	});

	it('proxy flow flowToMid', function (after) {
		const proxy = kit.require('proxy');
		const express = require('express');

		const app = express();
		const server = http.createServer(app);

		after(() => server.close());

		const fn = $ =>
			kit.sleep(200).then(() => $.body = "ok");

		app.use(proxy.flowToMid(fn));
		app.use((req, res) => res.end('no'));

		return kit.promisify(server.listen, server)(0)
			.then(() => kit.request(`http://127.0.0.1:${server.address().port}`)).then(data => it.eq(data, 'ok'));
	});

	it('proxy flow flowToMid next', function (after) {
		const proxy = kit.require('proxy');
		const express = require('express');

		const app = express();
		const server = http.createServer(app);

		after(() => server.close());

		const fn = $ => $.next();

		app.use(proxy.flowToMid(fn));
		app.use((req, res) => res.end('ok'));

		return kit.promisify(server.listen, server)(0)
			.then(() => kit.request(`http://127.0.0.1:${server.address().port}`)).then(data => it.eq(data + '', 'ok'));
	});

	it('proxy flow flowToMid error', function (after) {
		const proxy = kit.require('proxy');
		const express = require('express');

		const app = express();
		const server = http.createServer(app);

		after(() => server.close());

		const fn = function () {
			throw 'err';
		};

		app.use(proxy.flowToMid(fn));
		app.use((err, req, res) => res.end(err));

		return kit.promisify(server.listen, server)(0)
			.then(() => kit.request(`http://127.0.0.1:${server.address().port}`)).then(data => it.eq(data, 'err'));
	});

	it('proxy flow flowToMid error #2', function (after) {
		const proxy = kit.require('proxy');
		const express = require('express');

		const app = express();
		const server = http.createServer(app);

		after(() => server.close());

		const fn = () =>
			kit.sleep(200).then(() => Promise.reject('err'));

		app.use(proxy.flowToMid(fn));
		app.use((err, req, res) => res.end(err));

		return kit.promisify(server.listen, server)(0)
			.then(() => kit.request(`http://127.0.0.1:${server.address().port}`)).then(data => it.eq(data, 'err'));
	});

	it('proxy tcpFrame string', function (after) {
		const proxy = kit.require('proxy');

		const frame = 'ok';

		return new Promise(function (resolve) {
			const server = net.createServer(function (sock) {
				proxy.tcpFrame(sock);

				sock.setEncoding('utf8');
				return sock.on('frame', function (data) {
					resolve(it.eq(data, frame));
					return sock.end();
				});
			});

			after(() => server.close());

			return server.listen(0, function () {
				let sock;
				return sock = net.connect(server.address().port, '127.0.0.1', function () {
					proxy.tcpFrame(sock);
					sock.setDefaultEncoding('utf8');
					return sock.writeFrame(frame);
				});
			});
		});
	});

	it('proxy tcpFrame large frame', function (after) {
		const proxy = kit.require('proxy');

		const frame = Buffer.alloc(1000000);

		return new Promise(function (resolve) {
			const server = net.createServer(function (sock) {
				proxy.tcpFrame(sock);

				return sock.on('frame', function (data) {
					resolve(it.eq(data, frame));
					return sock.end();
				});
			});

			after(() => server.close());

			return server.listen(0, function () {
				let sock;
				return sock = net.connect(server.address().port, '127.0.0.1', function () {
					proxy.tcpFrame(sock);

					return sock.writeFrame(frame);
				});
			});
		});
	});

	it('proxy tcpFrame multiple write', function (after) {
		const proxy = kit.require('proxy');

		const frame = 'test';

		return new Promise(function (resolve) {
			const server = net.createServer(function (sock) {
				proxy.tcpFrame(sock);

				const list = [];
				return sock.on('frame', function (data) {
					list.push(data.toString());

					if (list.length === 2) {
						resolve(it.eq(list, [frame, frame]));
						return sock.end();
					}
				});
			});

			after(() => server.close());

			return server.listen(0, function () {
				let sock;
				return sock = net.connect(server.address().port, '127.0.0.1', function () {
					proxy.tcpFrame(sock);

					sock.writeFrame(frame);
					return sock.writeFrame(frame);
				});
			});
		});
	});

	it('proxy tcpFrame frames', function (after) {
		const proxy = kit.require('proxy');

		const frames = [];
		frames.push(Buffer.alloc(1024 * 67));
		frames.push(Buffer.alloc(1024 * 128));
		frames.push(Buffer.alloc(37));
		frames.push(Buffer.alloc(10));
		frames.push(Buffer.alloc(1));
		frames.push(Buffer.alloc(1024 * 64)); // The max tcp package size
		frames.push(Buffer.alloc(1));

		return new Promise(function (resolve, reject) {
			const server = net.createServer(function (sock) {
				proxy.tcpFrame(sock);

				return sock.on('frame', data =>
					it.eq(data, frames.pop())
					.then(function () {
						if (frames.length === 0) {
							sock.end();
							return resolve();
						} else {
							return sock.writeFrame('ok');
						}
					}).catch(function () {
						sock.end();
						return reject();
					})
				);
			});

			after(() => server.close());

			return server.listen(0, function () {
				let sock;
				return sock = net.connect(server.address().port, '127.0.0.1', function () {
					proxy.tcpFrame(sock);

					sock.on('frame', () => sock.writeFrame(_.last(frames)));

					return sock.writeFrame(_.last(frames));
				});
			});
		});
	});

	it('proxy tcpFrame max size', function (after) {
		const proxy = kit.require('proxy');

		const frame = Buffer.alloc(129);

		return new Promise(function (resolve) {
			const server = net.createServer(function (sock) {
				proxy.tcpFrame(sock, {
					maxSize: 128
				});

				return sock.on('error', function (err) {
					resolve(it.eq(err.message, 'frame exceeded the limit'));
					return sock.end();
				});
			});

			after(() => server.close());

			return server.listen(0, function () {
				let sock;
				return sock = net.connect(server.address().port, '127.0.0.1', function () {
					proxy.tcpFrame(sock);
					return sock.writeFrame(frame);
				});
			});
		});
	});

	it('proxy tcpFrame wrong version', function (after) {
		const proxy = kit.require('proxy');

		return new Promise(function (resolve) {
			const server = net.createServer(function (sock) {
				proxy.tcpFrame(sock);

				return sock.on('error', function (err) {
					resolve(it.eq(err.message, 'wrong protocol version'));
					return sock.end();
				});
			});

			after(() => server.close());

			return server.listen(0, function () {
				let sock;
				return sock = net.connect(server.address().port, '127.0.0.1', () => sock.write(Buffer.from([2, 2, 50, 50])));
			});
		});
	});

	it('proxy file write', function (after) {
		const proxy = kit.require('proxy');
		const path = tempPath() + '/proxy.file.write.txt';

		const app = proxy.flow();

		app.push(proxy.file());

		after(() => app.close());

		return app.listen(0).then(() => kit.remove(path)).then(() =>
				proxy.fileRequest({
					url: `127.0.0.1:${app.server.address().port}`,
					type: 'write',
					path,
					data: 'test'
				}))
			.then(() => it.eq(kit.readFile(path, 'utf8'), 'test'));
	});

	it('proxy file read file', function (after) {
		const proxy = kit.require('proxy');
		const path = tempPath() + '/proxy.file.read.file.txt';
		kit.outputFileSync(path, 'ok');

		const app = proxy.flow();

		app.push(proxy.file());

		after(() => app.close());

		return app.listen(0).then(() =>
				proxy.fileRequest({
					url: `127.0.0.1:${app.server.address().port}`,
					type: 'read',
					path
				}))
			.then(data =>
				it.eq(data, {
					type: 'file',
					data: Buffer.from('ok')
				}));
	});

	it('proxy file read dir', function (after) {
		const proxy = kit.require('proxy');
		const path = 'test/fixtures/site';

		const app = proxy.flow();

		app.push(proxy.file());

		after(() => app.close());

		return app.listen(0).then(() =>
				proxy.fileRequest({
					url: `127.0.0.1:${app.server.address().port}`,
					type: 'read',
					path
				}))
			.then(data =>
				it.eq(data, {
					type: 'directory',
					data: [
						'a.js',
						'b.css',
						'index.html'
					]
				}));
	});

	it('proxy file remove file', function (after) {
		const proxy = kit.require('proxy');
		const path = 'test/fixtures/proxy.file.remove.file.txt';

		kit.outputFileSync(path, 'test');

		const app = proxy.flow();

		app.push(proxy.file());

		after(() => app.close());

		return app.listen(0).then(() =>
				proxy.fileRequest({
					url: `127.0.0.1:${app.server.address().port}`,
					type: 'remove',
					path
				}))
			.then(() => it.eq(kit.fileExists(path), false));
	});

	it('proxy relay', function (after) {
		const proxy = kit.require('proxy');

		const app = proxy.flow();
		const relay = proxy.flow();
		let client = null;
		app.push('ok');

		after(function () {
			app.close();
			relay.close();
			return client.close();
		});

		return app.listen(0).then(function () {
			relay.server.on('connect', proxy.relayConnect({
				allowedHosts: [`127.0.0.1:${app.server.address().port}`]
			}));

			return relay.listen(0);
		}).then(() =>
			proxy.relayClient({
				host: '0.0.0.0:0',
				relayHost: `127.0.0.1:${relay.server.address().port}`,
				hostTo: `127.0.0.1:${app.server.address().port}`
			})).then(function (c) {
			client = c;
			return kit.request(`http://127.0.0.1:${c.address().port}`);
		}).then(data => it.eq(data, 'ok'));
	});

	it('noe', function (after) {
		const proxy = kit.require('proxy');
		const defer = kit.Deferred();
		let ps = null;
		const app = proxy.flow();
		const path = tempPath() + '.js';

		after(function () {
			app.close();
			return ps.kill('SIGINT');
		});

		app.push(() => defer.resolve());

		kit.outputFileSync(path, '');

		app.listen(0).then(function () {
			ps = kit.spawn('node', [
				'bin/noe.js',
				'--',
				path
			]).process;

			return kit.sleep(1000).then(() =>
				kit.outputFile(path, `\
var kit = require('../../lib/kit');
kit.request('http://127.0.0.1:' + ${app.server.address().port})\
`)
			);
		});

		return defer.promise;
	});

	return it('nos', function (after) {
		const defer = kit.Deferred();
		let ps = null;

		after(() => ps.kill('SIGINT'));

		getPort().then(function (port) {
			ps = kit.spawn('node', [
				'bin/nos.js',
				'-p', port,
				'--openBrowser', 'off',
				'test/fixtures'
			]).process;

			return kit.sleep(1000, port);
		}).then(port =>
			kit.request(`http://127.0.0.1:${port}/page`).then(body => it.eq(body.indexOf('nokit') > 0, true)).then(() =>
				kit.request(`http://127.0.0.1:${port}/page/main.js`).then(body => defer.resolve(it.eq(body.indexOf('ok') > 0, true)))
			)
		);

		return defer.promise;
	});
};