kit = require '../lib/kit'
http = require 'http'
net = require 'net'
{ _, Promise } = kit
kit.require 'drives'
regPattern = new RegExp process.argv[2]

createRandomServer = (handler, fn) ->
	server = http.createServer handler

	listen = kit.promisify server.listen, server

	listen(0).then ->
		fn(server.address().port)
	.then (res) ->
		server.close()
		res
	, (err) ->
		server.close()
		Promise.reject err

getPort = ->
	proxy = kit.require 'proxy'
	app = proxy.flow()
	port = 0

	app.listen(port).then ->
		port = app.server.address().port;
		app.close()
	.then ->
		port

unixSep = (p) -> p.replace /\\/g, '\/'

tempPath = ->
    'test/temp/' + Date.now() + (Math.random() + '').slice(2);

kit.removeSync('test/temp');
kit.mkdirsSync('test/temp');

module.exports = (it) ->
	it 'brush', ->
		br = kit.require 'brush'
		it.eq br.red('ok'), '\u001b[31mok\u001b[39m'

	it 'brush disable', ->
		br = kit.require 'brush'
		br.isEnabled = false
		ret = br.green('ok')
		br.isEnabled = true
		it.eq ret, 'ok'

	it 'log', ->
		kit.logs 'a', 'b', 'c'
		kit.log '%s + %s + %s', ['red'.red, 'green'.green, 'blue'.blue]

	it 'log err', ->
		kit.errs 'a', 'b', 'c'
		kit.err '%s + %s + %s', ['red'.red, 'green'.green, 'blue'.blue]

	it 'monitorApp', (after) -> new Promise (resolve) ->
		p = tempPath() + '/monitorApp-test.coffee'
		kit.copySync 'test/fixtures/monitorApp.coffee', p
		{ stop } = kit.monitorApp {
			bin: 'coffee'
			args: [p]
			onRestart: (path) ->
				resolve it.eq path, kit.path.resolve(p)
				stop()
		}
		tmr = setInterval ->
			kit.outputFileSync p, 'process.exit 0'
		, 1000

		after -> clearInterval tmr

	it 'parseComment coffee', ->
		path = 'test/fixtures/comment.coffee'
		kit.readFile path, 'utf8'
		.then (str) ->
			[ { tags: [tag] } ] = kit.parseComment str

			Promise.all [
				it.eq tag.type, 'Int'
				it.eq tag.name, 'limit'
			]

	it 'parseComment js', ->
		path = 'test/fixtures/comment.js'
		kit.readFile path, 'utf8'
		.then (str) ->
			[ { name, tags: [tag] } ] = kit.parseComment str

			Promise.all [
				it.eq name, 'as_ync1'
				it.eq tag.type, 'Int'
				it.eq tag.name, 'limit'
			]

	it 'parseComment js 2', ->
		path = 'test/fixtures/comment.js'
		kit.readFile path, 'utf8'
		.then (str) ->
			parsed = kit.parseComment str
			[ n0, { name } ] = parsed

			it.eq name, 'indent'

	it 'crypto', ->
		en = kit.encrypt '123', 'test'
		it.eq kit.decrypt(en, 'test').toString(), '123'

	it 'regexReduce', ->
		out = kit.regexReduce /\w(\d+)/g, 'a1, b10, c3', (ret, ms) ->
			ret.push ms[1]
			ret
		, []

		it.eq ['1', '10', '3'], out

	it 'regexMap', ->
		out = kit.regexMap /\w(\d+)/g, 'a1, b10, c3', 1
		it.eq ['1', '10', '3'], out

	it 'replace async 01', ->
		out = kit.replace 'test', /t/g, () ->
			kit.sleep(100).then -> 'x'

		it.eq out, 'xesx'

	it 'replace async 02', ->
		out = kit.replace 'test', /^t/g, (m) ->
			kit.sleep(_.random(0, 100)).then -> 'x' + m + 'x'

		it.eq out, 'xtxest'

	it 'replace async 03', ->
		out = kit.replace 'test', /e(s)/g, (m, p1) -> p1

		it.eq out, 'tst'

	it 'replaceSync async 01', ->
		out = kit.replaceSync 'test', /t/g, () ->
			kit.sleep(100).then -> 'x'

		it.eq out, 'xesx'

	it 'replaceSync async 02', ->
		out = kit.replace 'test', /^t/g, (m) ->
			kit.sleep(_.random(0, 100)).then -> 'x' + m + 'x'

		it.eq out, 'xtxest'

	it 'replaceSync async 03', ->
		out = kit.replaceSync 'test', /e(s)/g, (m, p1) -> p1

		it.eq out, 'tst'

	it 'request', ->
		info = 'ok'

		createRandomServer (req, res) ->
			res.end info
		, (port) ->
			kit.request {
				url:
					protocol: 'http:'
					hostname: '127.0.0.1'
					port: port
			}
			.then (body) ->
				it.eq body, info

	it 'request timeout', ->
		createRandomServer (req, res) ->
			kit.sleep(60).then ->
				res.end()
		, (port) ->
			promise = kit.request {
				url: '127.0.0.1:' + port
				timeout: 50
			}

			{ req } = promise

			promise.catch (err) ->
				it.eq err.message, 'timeout'

	it 'request reqPipe', ->
		path = 'nofile.coffee'
		info = kit.fs.readFileSync path, 'utf8'

		createRandomServer (req, res) ->
			data = ''
			req.on 'data', (chunk) -> data += chunk
			req.on 'end', ->
				res.end data
		, (port) ->
			file = kit.fs.createReadStream path
			{ size } = kit.fs.statSync path
			kit.request {
				url: '127.0.0.1:' + port
				headers: {
					'content-length': size
				}
				reqPipe: file
			}
			.then (body) ->
				it.eq body, info

	it 'request form-data', ->
		createRandomServer (req, res) ->
			form = new require('formidable').IncomingForm()

			form.parse req, (err, fields, files) ->
				res.end fields['f.md'].length.toString()

		, (port) ->
			form = new (require 'form-data')

			buffer = kit.fs.readFileSync 'nofile.coffee'

			form.append 'a.txt', 'content'
			form.append 'f.md', buffer

			kit.request {
				url: '127.0.0.1:' + port
				headers: form.getHeaders()
				setTE: true
				reqPipe: form
			}
			.then (body) ->
				it.eq +body, buffer.length

	it 'exec', ->
		p = kit.exec 'echo exec_ok'
		p.then ({ stdout }) ->
			p.process.then (proc) ->
				Promise.all [
					it.eq proc.pid > 0, true
					it.eq stdout.indexOf('exec_ok\n') > -1, true
				]

	it 'parseDependency', ->
		kit.parseDependency 'test/fixtures/depMain.coffee'
		.then (paths) ->
			it.eq paths.sort(), [
				'test/fixtures/dep1.coffee'
				'test/fixtures/dep2.coffee'
				'test/fixtures/dep3.coffee'
				'test/fixtures/depDir/dep4.js'
				'test/fixtures/depDir/dep5.coffee'
				'test/fixtures/depDir/dep6.coffee'
				'test/fixtures/depDir/lib/index.js'
				'test/fixtures/depMain.coffee'
			]

	it 'indent', ->
		it.eq kit.indent('a\nb', 2), '  a\n  b'

	it 'depsCache cache newer', ->
		cacheDir = tempPath()
		file = 'test/fixtures/depsCache.txt'
		cacheFile = cacheDir + '/1345816117-depsCache.txt'
		dest = tempPath() + '/' + file + '.dest'
		kit.outputFileSync dest, 'out'
		kit.depsCache {
			deps: [file]
			dests: [dest]
			cacheDir
		}
		.then ->
			kit.depsCache {
				deps: [file]
				cacheDir
			}
			.then (cache) ->
				it.eq cache.isNewer, true

	it 'warp map', ->
		tmp = tempPath()
		cacheDir = tempPath()

		counter = (info) ->
			info.dest.ext = '.coffee'
			info.set info.contents.length

		kit.warp 'test/fixtures/depDir/**/*.js'
		.load kit.drives.reader { cacheDir }
		.load counter
		.run tmp
		.then ->
			kit.glob tmp + '/**/*.coffee'
		.then (paths) ->
			it.eq paths.map(unixSep) , [
				"#{tmp}/dep4.coffee"
				"#{tmp}/lib/index.coffee"
			]

	it 'warp custom reader', ->
		tmp = tempPath()
		cacheDir = tempPath()

		myReader = _.extend (info) ->
			kit.readFile @path, 'utf8'
			.then (str) =>
				@set str.replace /\r\n/g, '\n'
		, isReader: true

		kit.warp 'test/fixtures/**/*.js'
		.load myReader
		.run tmp
		.then ->
			kit.readFile tmp + '/comment.js', 'utf8'
		.then (str) ->
			it.eq str[0..10], "/**\n\t * An "

	it 'warp concat', ->
		out = tempPath()
		file = 'warp_all.coffee'
		cacheDir = tempPath()

		kit.warp 'test/fixtures/depDir/**/*.coffee'
		.load kit.drives.reader { cacheDir }
		.load kit.drives.concat file
		.run out
		.then ->
			kit.readFile(out + '/' + file, 'utf8')
		.then (str) ->
			it.eq str.indexOf("require './lib'") > 0, true

	it 'warp auto', ->
		dir = tempPath()
		path = dir + '/compiler.all'
		cacheDir = tempPath()

		kit.warp 'test/fixtures/compiler/*'
			.load kit.drives.reader { cacheDir }
			.load kit.drives.auto 'lint'
			.load kit.drives.auto 'compile'
			.load kit.drives.auto 'compress'
			.load kit.drives.concat 'compiler.all'
		.run dir
		.then ->
			str = kit.readFileSync path, 'utf8'
			it.eq _.trim(str).split('\n').sort(), [
				'.test .bar{color:red}'
				'.test{color:red}'
				'var a;a=function(){return console.log("OK")};'
				'var a=function(n){return n};'
				'var table1;table1=[{id:1,name:"george"},{id:2}];'
			]

	it 'task deps', ->
		seq = []

		kit.task 'default', { deps: ['one'], description: '0' } , ->
			seq.push 'default'
			seq

		kit.task 'one', { deps: ['two'] } , ->
			seq.push 'one'

		kit.task 'two', { description: '2' } , ->
			seq.push 'two'

		kit.task.run()
		.then ([seq]) ->
			it.eq seq, [ 'two', 'one', 'default' ]

	it 'task sequential', ->
		seq = []

		kit.task 'default', { deps: ['one', 'two'], isSequential: true } , () ->
		    seq.push 3

		kit.task 'one', () ->
		    new Promise (r) ->
		        setTimeout ->
		            seq.push 1
		            r()
		        , 5

		kit.task 'two', { description: '2' } , () ->
		    seq.push 2

		kit.task.run 'default'
		.then ->
			it.eq seq, [1, 2, 3]

	it 'defaultArgs', ->
		fn = ->
		it.eq (kit.defaultArgs ['c', fn], {
			str1: { String: '0' }
			fn: { Function: -> 'test' }
			str2: { String: '1' }
		}), {
			str1: 'c', fn: fn, str2: '1'
		}

	it 'defaultArgs2', ->
		fn = ->
		it.eq (kit.defaultArgs ['c', fn, 'd', undefined], {
			str1: { String: '0' }
			fn: { Function: -> 'test' }
			str2: { String: '1' }
		}), {
			str1: 'c', fn: fn, str2: 'd'
		}

	it 'fuzzySearch', ->
		ret = kit.fuzzySearch('ys', [
			'sy', 'yxs', 'ysbb', 'xys', 'ysx', 'ysb', 'syx'
		])
		it.eq ret, 'ysx'

	it 'fuzzySearch order', ->
		ret = kit.fuzzySearch('b', [
			'lb', 'build'
		])
		it.eq ret, 'build'

	it 'fuzzySearch not found', ->
		it.eq kit.fuzzySearch('ys', [
			'ss', 'ab'
		]), undefined

	it 'proxy url', ->
		proxy = kit.require 'proxy'

		createRandomServer(proxy.flow([
			proxy.select /\/site$/, ($) ->
				$.body = 'site' + $.req.headers.proxy

			proxy.select /\/proxy$/, proxy.url {
				url: '/site'
				bps: 1024 * 10
				handleReqHeaders: (headers) ->
					headers['proxy'] = '-proxy'
					headers
				handleResHeaders: (headers) ->
					headers['x'] = '-ok'
					headers
				handleResBody: (body) ->
					body + '-body'
			}
		]), (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}/proxy"
				body: false
			}
		).then ({ headers, body }) ->
			it.eq 'site-proxy-body-ok', body + headers.x

	it 'proxy url handleReqBody', ->
		proxy = kit.require 'proxy'
		now = Date.now() + ''

		createRandomServer(proxy.flow([
			proxy.body()

			proxy.select '/site', ($) -> $.body = $.reqBody

			proxy.select '/proxy', proxy.url({
				url: '/site'
				handleReqData: (req) -> req.body
			})
		]), (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}/proxy"
				reqData: now
			}
		).then (body) ->
			it.eq body, now

	it 'proxy flow handler', ->
		proxy = kit.require 'proxy'

		routes = [
			($) -> new Promise (r) ->
				$.req.on 'data', (data) ->
					$.body = 'echo: ' + data
					r()
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}"
				reqData: 'test'
			}
			.then (body) ->
				it.eq 'echo: test', body

	it 'proxy flow string middleware', ->
		proxy = kit.require 'proxy'

		createRandomServer proxy.flow(['string works'])
		, (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}"
			}
			.then (body) ->
				it.eq 'string works', body

	it 'proxy flow body', ->
		proxy = kit.require 'proxy'

		routes = [
			proxy.body(),
			proxy.body(),
			($) -> $.body = $.reqBody + 'ok'
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}"
				reqData: 'ok'
			}
			.then (body) ->
				it.eq body, 'okok'

	it 'proxy flow van', ->
		proxy = kit.require 'proxy'

		routes = [
			proxy.van
			({ van }) -> van('ok')
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request "http://127.0.0.1:#{port}"
			.then (body) ->
				it.eq body, 'ok'

	it 'proxy flow url', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select url: /\/items\/(\d+)/, ($) ->
			$.body = $.url[1]
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request "http://127.0.0.1:#{port}/items/123"
			.then (body) ->
				it.eq body, '123'

	it 'proxy flow url string', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select '/items', ($) ->
			$.body = $.url
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request "http://127.0.0.1:#{port}/items/123"
			.then (body) ->
				it.eq body, '/123'

	it 'proxy flow headers', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select headers: { 'x': /ok/ }, ($) ->
			$.body = $.headers.x
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}"
				headers: { x: 'ok' }
			}
			.then (body) ->
				it.eq '["ok"]', body

	it 'proxy flow headers not match', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select headers: { 'x': /test/ }, ($) ->
			$.body = $.headers.x
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}"
				headers: { x: 'ok' }
				body: false
			}
			.then (res) ->
				it.eq 404, res.statusCode

	it 'proxy flow 404', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select url: /\/items\/(\d+)/, ($) ->
			$.body = $.url[1]
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request "http://127.0.0.1:#{port}/itemx"
			.then (body) ->
				it.eq 'Not Found', body

	it 'proxy flow promise', ->
		proxy = kit.require 'proxy'

		routes = [($) ->
			$.body = kit.readFile '.gitignore'
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request "http://127.0.0.1:#{port}"
			.then (body) ->
				it.eq kit.readFileSync('.gitignore', 'utf8'), body

	it 'proxy flow url match', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select url: proxy.match('/:page.html'), ($) ->
			$.body = $.url.page
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request "http://127.0.0.1:#{port}/index.html?a=10"
			.then (body) ->
				it.eq 'index', body

	it 'proxy flow post', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select method: 'POST', ($) ->
			$.body = $.method
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request {
				method: 'POST'
				url: "http://127.0.0.1:#{port}"
			}
			.then (body) ->
				it.eq 'POST', body

	it 'proxy flow static', ->
		proxy = kit.require 'proxy'

		routes = [
			proxy.select url: '/st', proxy.static 'test/fixtures'
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request encodeURI "http://127.0.0.1:#{port}/st/ひまわり.txt"
			.then (body) ->
				str = kit.readFileSync 'test/fixtures/ひまわり.txt', 'utf8'
				it.eq str, body

	it 'proxy flow etag', ->
		proxy = kit.require 'proxy'

		routes = [
			proxy.etag()
			($) -> $.body = 'test'
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request { url: "http://127.0.0.1:#{port}", body: false }
			.then (res) ->
				it.eq '349o', res.headers.etag

	it 'proxy flow midToFlow', ->
		proxy = kit.require 'proxy'
		bodyParser = require 'body-parser'

		routes = [
			proxy.midToFlow(bodyParser.json())
			($) ->
				$.body = $.req.body
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}/"
				reqData: '{"a": 10}'
				headers: {
					'Content-Type': 'application/json'
				}
			}
			.then (body) ->
				it.eq {a: 10}, JSON.parse(body)

	it 'proxy flow midToFlow no next', ->
		proxy = kit.require 'proxy'

		routes = [
			proxy.midToFlow (req, res) ->
				res.end req.url

			($) ->
				$.body = 'no'
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request "http://127.0.0.1:#{port}/ok"
			.then (body) ->
				it.eq body, '/ok'

	it 'proxy flow midToFlow error', ->
		proxy = kit.require 'proxy'

		routes = [
			($) ->
				$.next().catch ->
					$.body = 'ok'

			proxy.midToFlow () ->
				a()
		]

		createRandomServer proxy.flow(routes)
		, (port) ->
			kit.request "http://127.0.0.1:#{port}/"
			.then (body) ->
				it.eq body, 'ok'

	it 'proxy flow flowToMid', (after) ->
		proxy = kit.require 'proxy'
		express = require 'express'

		app = express()
		server = http.createServer app

		after ->
			server.close();

		fn = ($) ->
			kit.sleep(200).then ->
				$.body = "ok"

		app.use proxy.flowToMid(fn)
		app.use (req, res) -> res.end 'no'

		kit.promisify(server.listen, server)(0)
		.then ->
			kit.request("http://127.0.0.1:#{server.address().port}")
		.then (data) ->
			it.eq data, 'ok'

	it 'proxy flow flowToMid next', (after) ->
		proxy = kit.require 'proxy'
		express = require 'express'

		app = express()
		server = http.createServer app

		after ->
			server.close();

		fn = ($) ->
			return $.next()

		app.use proxy.flowToMid(fn)
		app.use (req, res) ->
			res.end 'ok'

		kit.promisify(server.listen, server)(0)
		.then ->
			kit.request("http://127.0.0.1:#{server.address().port}")
		.then (data) ->
			it.eq data, 'ok'

	it 'proxy flow flowToMid error', (after) ->
		proxy = kit.require 'proxy'
		express = require 'express'

		app = express()
		server = http.createServer app

		after ->
			server.close();

		fn = ($) ->
			throw 'err'

		app.use proxy.flowToMid(fn)
		app.use (err, req, res, next) ->
			res.end err

		kit.promisify(server.listen, server)(0)
		.then ->
			kit.request("http://127.0.0.1:#{server.address().port}")
		.then (data) ->
			it.eq data, 'err'

	it 'proxy flow flowToMid error #2', (after) ->
		proxy = kit.require 'proxy'
		express = require 'express'

		app = express()
		server = http.createServer app

		after ->
			server.close();

		fn = ($) ->
			kit.sleep(200).then ->
				Promise.reject 'err'

		app.use proxy.flowToMid(fn)
		app.use (err, req, res, next) ->
			res.end err

		kit.promisify(server.listen, server)(0)
		.then ->
			kit.request("http://127.0.0.1:#{server.address().port}")
		.then (data) ->
			it.eq data, 'err'

	it 'proxy tcpFrame string', (after) ->
		proxy = kit.require 'proxy'

		frame = 'ok'

		new Promise (resolve) ->
			server = net.createServer (sock) ->
				proxy.tcpFrame sock

				sock.setEncoding 'utf8'
				sock.on 'frame', (data) ->
					resolve it.eq data, frame
					sock.end()

			after -> server.close()

			server.listen 0, ->
				sock = net.connect server.address().port, '127.0.0.1', ->
					proxy.tcpFrame sock
					sock.setDefaultEncoding 'utf8'
					sock.writeFrame frame

	it 'proxy tcpFrame large frame', (after) ->
		proxy = kit.require 'proxy'

		frame = new Buffer 1000000

		new Promise (resolve) ->
			server = net.createServer (sock) ->
				proxy.tcpFrame sock

				sock.on 'frame', (data) ->
					resolve it.eq data, frame
					sock.end()

			after -> server.close()

			server.listen 0, ->
				sock = net.connect server.address().port, '127.0.0.1', ->
					proxy.tcpFrame sock

					sock.writeFrame frame

	it 'proxy tcpFrame multiple write', (after) ->
		proxy = kit.require 'proxy'

		frame = 'test'

		new Promise (resolve) ->
			server = net.createServer (sock) ->
				proxy.tcpFrame sock

				list = []
				sock.on 'frame', (data) ->
					list.push data.toString()

					if list.length == 2
						resolve it.eq list, [frame, frame]
						sock.end()

			after -> server.close()

			server.listen 0, ->
				sock = net.connect server.address().port, '127.0.0.1', ->
					proxy.tcpFrame sock

					sock.writeFrame frame
					sock.writeFrame frame

	it 'proxy tcpFrame frames', (after) ->
		proxy = kit.require 'proxy'

		frames = []
		frames.push new Buffer(1024 * 67)
		frames.push new Buffer(1024 * 128)
		frames.push new Buffer(37)
		frames.push new Buffer(10)
		frames.push new Buffer(0)
		frames.push new Buffer(1024 * 64) # The max tcp package size
		frames.push new Buffer(0)

		new Promise (resolve, reject) ->
			server = net.createServer (sock) ->
				proxy.tcpFrame sock

				sock.on 'frame', (data) ->
					it.eq(data, frames.pop())
					.then ->
						if frames.length == 0
							sock.end()
							resolve()
						else
							sock.writeFrame 'ok'
					.catch ->
						sock.end()
						reject()

			after -> server.close()

			server.listen 0, ->
				sock = net.connect server.address().port, '127.0.0.1', ->
					proxy.tcpFrame sock

					sock.on 'frame', ->
						sock.writeFrame _.last(frames)

					sock.writeFrame _.last(frames)

	it 'proxy file write', (after) ->
		proxy = kit.require 'proxy'
		path = tempPath() + '/proxy.file.write.txt'

		app = proxy.flow()

		app.push proxy.file()

		after ->
			app.close()

		app.listen(0).then ->
			kit.remove path
		.then ->
			proxy.fileRequest {
				url: '127.0.0.1:' + app.server.address().port
				type: 'write'
				path: path
				data: 'test'
			}
		.then ->
			it.eq kit.readFile(path, 'utf8'), 'test'

	it 'proxy file read file', (after) ->
		proxy = kit.require 'proxy'
		path = tempPath() + '/proxy.file.read.file.txt'
		kit.outputFileSync path, 'ok'

		app = proxy.flow()

		app.push proxy.file()

		after ->
			app.close()

		app.listen(0).then ->
			proxy.fileRequest {
				url: '127.0.0.1:' + app.server.address().port
				type: 'read'
				path: path
			}
		.then (data) ->
			it.eq data, {
				type: 'file'
				data: new Buffer('ok')
			}

	it 'proxy file read dir', (after) ->
		proxy = kit.require 'proxy'
		path = 'test/fixtures/site'

		app = proxy.flow()

		app.push proxy.file()

		after -> app.close()

		app.listen(0).then ->
			proxy.fileRequest {
				url: '127.0.0.1:' + app.server.address().port
				type: 'read'
				path: path
			}
		.then (data) ->
			it.eq data, {
				type: 'directory'
				data: [
					'a.js'
					'b.css'
					'index.html'
				]
			}

	it 'proxy file remove file', (after) ->
		proxy = kit.require 'proxy'
		path = 'test/fixtures/proxy.file.remove.file.txt'

		kit.outputFileSync path, 'test'

		app = proxy.flow()

		app.push proxy.file()

		after -> app.close()

		app.listen(0).then ->
			proxy.fileRequest {
				url: '127.0.0.1:' + app.server.address().port
				type: 'remove'
				path: path
			}
		.then (data) ->
			it.eq kit.fileExists(path), false

	it 'proxy relay', (after) ->
		proxy = kit.require 'proxy'

		app = proxy.flow()
		relay = proxy.flow()
		client = null
		app.push('ok')

		after ->
			app.close()
			relay.close()
			client.close()

		app.listen(0).then ->
			relay.server.on 'connect', proxy.relayConnect({
				allowedHosts: ['127.0.0.1:' + app.server.address().port]
			})

			relay.listen(0)
		.then ->
			proxy.relayClient({
				host: '0.0.0.0:0'
				relayHost: '127.0.0.1:' + relay.server.address().port
				hostTo: '127.0.0.1:' + app.server.address().port
			})
		.then (c) ->
			client = c
			kit.request 'http://127.0.0.1:' + c.address().port
		.then (data) ->
			it.eq data, 'ok'

	it 'noe', (after) ->
		proxy = kit.require 'proxy'
		defer = kit.Deferred();
		ps = null;
		app = proxy.flow();

		after ->
			app.close();
			ps.kill('SIGINT')

		app.push () ->
			defer.resolve()

		app.listen(0).then ->
			ps = kit.spawn('node', [
				'bin/noe.js'
				'--',
				'test/fixtures/noe/index.js'
			]).process

			kit.sleep(1000).then ->
				kit.outputFile 'test/fixtures/noe/index.js', """
					var kit = require('../../../dist/kit');
					kit.request('http://127.0.0.1:' + #{app.server.address().port})
				"""

		defer.promise

	it 'nos', (after) ->
		proxy = kit.require 'proxy'
		defer = kit.Deferred();
		ps = null;

		after ->
			ps.kill('SIGINT')

		getPort().then (port) ->
			ps = kit.spawn('node', [
				'bin/nos.js'
				'-p', port
				'--openBrowser', 'off'
				'test/fixtures'
			]).process

			kit.sleep 1000, port
		.then (port) ->
			kit.request("http://127.0.0.1:#{port}/page").then (body) ->
				it.eq(body.indexOf('nokit') > 0, true)
			.then ->
				kit.request("http://127.0.0.1:#{port}/page/main.js").then (body) ->
					defer.resolve it.eq(body.indexOf('ok') > 0, true)

		defer.promise
