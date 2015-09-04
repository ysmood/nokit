kit = require '../lib/kit'
http = require 'http'
{ _, Promise } = kit
kit.require 'drives'
ken = kit.require 'ken'
it = ken()

cacheDir = 'test/fixtures/cacheDir'

createRandomServer = (fn) ->
	server = http.createServer fn

	listen = kit.promisify server.listen, server

	listen(0).then ->
		server.address().port

unixSep = (p) -> p.replace /\\/g, '\/'

it.async [

	it 'ken all passed', ->
		ken = kit.require 'ken'
		test = ken()

		# Async tests
		test.async [
			test 'basic 1', ->
				ken.eq 'ok', 'ok'
			test 'basic 2', ->
				ken.deepEq { a: 1, b: 2 }, { a: 1, b: 2 }

			# Sync tests
			kit.flow [
				test 'basic 3', ->
					ken.eq 'ok', 'ok'
				test 'basic 4', ->
					ken.eq 'ok', 'ok'
			]
		]
		.then ({ passed }) ->
			ken.eq 4, passed

	it 'ken failed', ->
		ken = kit.require 'ken'
		test = ken()

		# Async tests
		test.async [
			test 'basic 1', ->
				ken.eq 'ok', 'ok'
			test 'basic 2', ->
				ken.eq 'ok', 'ok1'
			test 'basic 3', ->
				ken.deepEq { a: 1, b: 2 }, { a: 1, b: 2 }
		]
		.then ({ failed }) ->
			ken.eq 1, failed

	it 'brush', ->
		br = kit.require 'brush'
		ken.eq br.red('ok'), '\u001b[31mok\u001b[39m'

	it 'brush disable', ->
		br = kit.require 'brush'
		br.isEnabled = false
		ret = br.green('ok')
		br.isEnabled = true
		ken.eq ret, 'ok'

	it 'log', ->
		kit.logs 'a', 'b', 'c'
		kit.log '%s + %s + %s', ['red'.red, 'green'.green, 'blue'.blue]

	it 'parseComment coffee', ->
		path = 'test/fixtures/comment.coffee'
		kit.readFile path, 'utf8'
		.then (str) ->
			[ { tags: [tag] } ] = kit.parseComment str

			Promise.all [
				ken.eq tag.type, 'Int'
				ken.eq tag.name, 'limit'
			]

	it 'parseComment js', ->
		path = 'test/fixtures/comment.js'
		kit.readFile path, 'utf8'
		.then (str) ->
			[ { tags: [tag] } ] = kit.parseComment str

			Promise.all [
				ken.eq tag.type, 'Int'
				ken.eq tag.name, 'limit'
			]

	it 'crypto', ->
		en = kit.encrypt '123', 'test'
		ken.eq kit.decrypt(en, 'test').toString(), '123'

	it 'regexReduce', ->
		out = kit.regexReduce /\w(\d+)/g, 'a1, b10, c3', (ret, ms) ->
			ret.push ms[1]
			ret
		, []

		ken.deepEq [1, 10, 3], out

	it 'regexMap', ->
		out = kit.regexMap /\w(\d+)/g, 'a1, b10, c3', 1
		ken.deepEq [1, 10, 3], out

	it 'request', ->
		info = 'ok'

		createRandomServer (req, res) ->
			res.end info
		.then (port) ->
			kit.request {
				url:
					protocol: 'http:'
					hostname: '127.0.0.1'
					port: port
			}
			.then (body) ->
				ken.eq body, info

	it 'request timeout', ->
		createRandomServer (req, res) ->
			kit.sleep(60).then ->
				res.end()
		.then (port) ->
			promise = kit.request {
				url: '127.0.0.1:' + port
				timeout: 50
			}

			{ req } = promise

			promise.catch (err) ->
				ken.eq err.message, 'timeout'

	it 'request reqPipe', ->
		path = 'nofile.coffee'
		info = kit.fs.readFileSync path, 'utf8'

		createRandomServer (req, res) ->
			data = ''
			req.on 'data', (chunk) -> data += chunk
			req.on 'end', ->
				res.end data
		.then (port) ->
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
				ken.eq body, info

	it 'request form-data', ->
		createRandomServer (req, res) ->
			form = new require('formidable').IncomingForm()

			form.parse req, (err, fields, files) ->
				res.end fields['f.md'].length.toString()

		.then (port) ->
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
				ken.eq +body, buffer.length

	it 'monitorApp', -> new Promise (resolve) ->
		p = 'test/fixtures/monitorApp-test.coffee'
		kit.copySync 'test/fixtures/monitorApp.coffee', p
		promise = kit.monitorApp {
			bin: 'coffee'
			args: [p]
			onErrorExit: ({ code, signal }) ->
				resolve ken.eq code, 10
				promise.stop()
		}
		setTimeout ->
			kit.outputFileSync p, 'process.exit 10'
		, 500

	it 'exec', ->
		p = kit.exec 'echo exec_ok'
		p.then ({ stdout }) ->
			p.process.then (proc) ->
				Promise.all [
					ken.eq proc.pid > 0, true
					ken.eq stdout.indexOf('exec_ok\n') > -1, true
				]

	it 'parseDependency', ->
		kit.parseDependency 'test/fixtures/depMain.coffee', {
			depRoots: ['test/fixtures/depDir']
		}
		.then (paths) ->
			ken.deepEq paths.sort(), [
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
		ken.eq kit.indent('a\nb', 2), '  a\n  b'

	it 'depsCache cache newer', ->
		file = 'test/fixtures/depsCache.txt'
		cacheFile = 'test/fixtures/cacheDir/1345816117-depsCache.txt'
		dest = file + '.dest'
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
				ken.eq cache.isNewer, true

	it 'depsCache file newer', ->
		file = 'test/fixtures/depsCacheFileNewer.txt'
		file1 = 'test/fixtures/depsCacheFileNewer1.txt'
		cacheDir = 'test/fixtures/cacheDir'
		dest = file + '.dest'
		dest1 = file + '.dest1'
		cacheFile = 'test/fixtures/cacheDir/1862933060-depsCacheFileNewer.txt'

		kit.outputFileSync file1, 'test'
		kit.outputFileSync dest, 'out'
		kit.outputFileSync dest1, 'out1'

		kit.depsCache {
			deps: [file, file1]
			dests: [dest, dest1]
			cacheDir
		}
		.then -> kit.sleep(1000)
		.then ->
			kit.outputFileSync file1, 'txt'

			kit.depsCache {
				deps: [file1]
				cacheDir
			}
			.then (cache) ->
				cache.contents = kit.readFileSync cache.dests[dest1], 'utf8'

				delete cache.deps
				out =
					contents: 'out1'
					dests: {}
					isNewer: false

				cache.dests[dest] = unixSep cache.dests[dest]
				cache.dests[dest1] = unixSep cache.dests[dest1]

				out.dests[dest] ='test/fixtures/cacheDir/3779283019-depsCacheFileNewer.txt.dest'
				out.dests[dest1] ='test/fixtures/cacheDir/3263598758-depsCacheFileNewer.txt.dest1'
				ken.deepEq cache, out

	it 'warp map', ->
		tmp = 'test/fixtures/warp'

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
			ken.deepEq paths.map(unixSep) , [
				"test/fixtures/warp/dep4.coffee"
				"test/fixtures/warp/lib/index.coffee"
			]

	it 'warp custom reader', ->
		tmp = 'test/fixtures/warp-custom-reader'

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
			ken.eq str[0..10], "/**\n\t * An "

	it 'warp concat', ->
		tmp = 'test/fixtures/warp_all.coffee'

		kit.warp 'test/fixtures/depDir/**/*.coffee'
		.load kit.drives.reader { cacheDir }
		.load kit.drives.concat 'warp_all.coffee'
		.run 'test/fixtures'
		.then ->
			kit.readFile tmp, 'utf8'
		.then (str) ->
			ken.eq str.indexOf("require './lib'") > 0, true

	it 'warp auto', ->
		path = 'test/fixtures/compiler.all'
		kit.warp 'test/fixtures/compiler/*'
			.load kit.drives.reader { cacheDir }
			.load kit.drives.auto 'lint'
			.load kit.drives.auto 'compile'
			.load kit.drives.auto 'compress'
			.load kit.drives.concat 'compiler.all'
		.run 'test/fixtures'
		.then ->
			str = kit.readFileSync path, 'utf8'
			ken.deepEq _.trim(str).split('\n').sort(), [
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
			ken.deepEq seq, [ 'two', 'one', 'default' ]

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
			ken.deepEq seq, [1, 2, 3]

	it 'defaultArgs', ->
		fn = ->
		ken.deepEq (kit.defaultArgs ['c', fn], {
			str1: { String: '0' }
			fn: { Function: -> 'test' }
			str2: { String: '1' }
		}), {
			str1: 'c', fn: fn, str2: '1'
		}

	it 'defaultArgs2', ->
		fn = ->
		ken.deepEq (kit.defaultArgs ['c', fn, 'd'], {
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
		ken.eq ret, 'ysx'

	it 'fuzzySearch order', ->
		ret = kit.fuzzySearch('b', [
			'lb', 'build'
		])
		ken.eq ret, 'build'

	it 'fuzzySearch not found', ->
		ken.eq kit.fuzzySearch('ys', [
			'ss', 'ab'
		]), undefined

	it 'proxy url', ->
		proxy = kit.require 'proxy'

		createRandomServer proxy.flow([
			proxy.select url: /\/site$/, ($) ->
				$.body = 'site' + $.req.headers.proxy

			proxy.select url: /\/proxy$/, proxy.url {
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
		])
		.then (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}/proxy"
				body: false
			}
		.then ({ headers, body }) ->
			ken.eq 'site-proxy-body-ok', body + headers.x

	it 'proxy flow handler', ->
		proxy = kit.require 'proxy'

		routes = [
			($) -> new Promise (r) ->
				$.req.on 'data', (data) ->
					$.body = 'echo: ' + data
					r()
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}"
				reqData: 'test'
			}
			.then (body) ->
				ken.eq 'echo: test', body

	it 'proxy flow string middleware', ->
		proxy = kit.require 'proxy'

		createRandomServer proxy.flow(['string works'])
		.then (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}"
			}
			.then (body) ->
				ken.eq 'string works', body

	it 'proxy flow url', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select url: /\/items\/(\d+)/, ($) ->
			$.body = $.url[1]
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request "http://127.0.0.1:#{port}/items/123"
			.then (body) ->
				ken.eq '123', body

	it 'proxy flow headers', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select headers: { 'x': /ok/ }, ($) ->
			$.body = $.headers.x
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}"
				headers: { x: 'ok' }
			}
			.then (body) ->
				ken.eq '["ok"]', body

	it 'proxy flow headers not match', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select headers: { 'x': /test/ }, ($) ->
			$.body = $.headers.x
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}"
				headers: { x: 'ok' }
				body: false
			}
			.then (res) ->
				ken.eq 404, res.statusCode

	it 'proxy flow 404', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select url: /\/items\/(\d+)/, ($) ->
			$.body = $.url[1]
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request "http://127.0.0.1:#{port}/itemx"
			.then (body) ->
				ken.eq 'Not Found', body

	it 'proxy flow sub route', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select url: '/sub', proxy.flow [
				proxy.select url: '/sub/home', ($) ->
					$.body = $.url
			]
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request "http://127.0.0.1:#{port}/sub/home/test"
			.then (body) ->
				ken.eq '/test', body

	it 'proxy flow sub route 404', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select url: '/sub', proxy.flow [
				proxy.select url: /\/home$/, ($) ->
					$.body = $.url
			]
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}/sub/homex"
				body: false
			}
			.then (res) ->
				ken.eq '404Not Found', res.statusCode + res.body

	it 'proxy flow sub route next', ->
		proxy = kit.require 'proxy'

		routes = [
			proxy.select url: '/sub', ($) -> $.next()
			proxy.select(url: '/sub', proxy.flow [
				proxy.select url: proxy.match('/home'), ($) ->
					$.body = $.url
			])
			proxy.select url: '/sub', ($) -> $.body = 'next'
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request "http://127.0.0.1:#{port}/sub/home/test"
			.then (body) ->
				ken.eq 'next', body

	it 'proxy flow sub route error', ->
		proxy = kit.require 'proxy'

		routes = [
			($) ->
				$.next().catch (err) ->
					$.res.statusCode = 501
					$.body = err.message
			proxy.select url: '/sub', proxy.flow [
				proxy.select url: '/sub/home', ($) -> a()
			]
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}/sub/home/test"
				body: false
			}
			.then (res) ->
				ken.eq '501 a is not defined', res.statusCode + ' ' + res.body

	it 'proxy flow promise', ->
		proxy = kit.require 'proxy'

		routes = [($) ->
			$.body = kit.readFile '.gitignore'
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request "http://127.0.0.1:#{port}"
			.then (body) ->
				ken.eq kit.readFileSync('.gitignore', 'utf8'), body

	it 'proxy flow url match', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select url: proxy.match('/items/:id'), ($) ->
			$.body = $.url.id
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request "http://127.0.0.1:#{port}/items/123"
			.then (body) ->
				ken.eq '123', body

	it 'proxy flow post', ->
		proxy = kit.require 'proxy'

		routes = [proxy.select method: 'POST', ($) ->
			$.body = $.method
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request {
				method: 'POST'
				url: "http://127.0.0.1:#{port}"
			}
			.then (body) ->
				ken.eq 'POST', body

	it 'proxy flow static', ->
		proxy = kit.require 'proxy'

		routes = [
			proxy.select url: '/st', proxy.static 'test/fixtures'
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request encodeURI "http://127.0.0.1:#{port}/st/ひまわり.txt"
			.then (body) ->
				str = kit.readFileSync 'test/fixtures/ひまわり.txt', 'utf8'
				ken.eq str, body

	it 'proxy flow etag', ->
		proxy = kit.require 'proxy'

		routes = [
			proxy.etag()
			($) -> $.body = 'test'
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request { url: "http://127.0.0.1:#{port}", body: false }
			.then (res) ->
				ken.eq '349o', res.headers.etag

	it 'proxy flow midToFlow', ->
		proxy = kit.require 'proxy'
		bodyParser = require 'body-parser'

		routes = [
			proxy.midToFlow(bodyParser.json())
			($) ->
				$.body = $.req.body
		]

		createRandomServer proxy.flow(routes)
		.then (port) ->
			kit.request {
				url: "http://127.0.0.1:#{port}/"
				reqData: '{"a": 10}'
				headers: {
					'Content-Type': 'application/json'
				}
			}
			.then (body) ->
				console.log body
				ken.deepEq {a: 10}, JSON.parse(body)

]
.then ({ failed }) ->
	process.exit failed