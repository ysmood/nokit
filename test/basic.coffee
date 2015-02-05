assert = require 'assert'
kit = require '../lib/kit'
http = require 'http'
{ _, Promise } = kit
kit.require 'drives'

cacheDir = 'test/fixtures/cacheDir'

shouldEqual = (args...) ->
	try
		assert.strictEqual.apply assert, args
	catch err
		Promise.reject err

shouldDeepEqual = (args...) ->
	try
		assert.deepEqual.apply assert, args
	catch err
		Promise.reject err

serverList = []
createRandomServer = (fn) ->
	server = http.createServer fn
	serverList.push server

	listen = kit.promisify server.listen, server

	listen(0).then ->
		server.address().port

unixSep = (p) -> p.replace /\\/g, '\/'

describe 'Kit:', ->
	after ->
		for s in serverList
			s.close()

	it 'parseComment coffee', ->
		path = 'test/fixtures/comment.coffee'
		kit.readFile path, 'utf8'
		.then (str) ->
			[ { tags: [tag] } ] = kit.parseComment str

			Promise.all [
				shouldEqual tag.type, 'Int'
				shouldEqual tag.name, 'limit'
			]

	it 'parseComment js', ->
		path = 'test/fixtures/comment.js'
		kit.readFile path, 'utf8'
		.then (str) ->
			[ { tags: [tag] } ] = kit.parseComment str

			Promise.all [
				shouldEqual tag.type, 'Int'
				shouldEqual tag.name, 'limit'
			]

	it 'async array', ->
		len = kit.fs.readFileSync(__filename).length
		list = [
			-> kit.fs.readFileSync(__filename)
			-> kit.fs.readFileSync(__filename)
			-> kit.fs.readFileSync(__filename)
		]

		kit.async 3, list, false, (ret) ->
			shouldEqual ret.length, len
		.then (rets) ->
			shouldEqual rets, undefined

	it 'async progress', ->
		len = kit.fs.readFileSync(__filename).length
		iter = ->
			i = 0
			->
				if i++ == 10
					return
				kit.readFile __filename

		kit.async 3, iter(), false, (ret) ->
			shouldEqual ret.length, len
		.then (rets) ->
			shouldEqual rets, undefined

	it 'async results', ->
		len = kit.fs.readFileSync(__filename).length

		kit.async(3, _.times 10, ->
			->
				kit.readFile __filename
		, (ret) ->
			shouldEqual ret.length, len
		).then (rets) ->
			shouldEqual rets.length, 10

	it 'crypto', ->
		en = kit.encrypt '123', 'test'
		assert.equal kit.decrypt(en, 'test').toString(), '123'

	it 'request', ->
		info = 'ok'

		createRandomServer (req, res) ->
			res.end info
		.then (port) ->
			kit.request '127.0.0.1:' + port
			.then (body) ->
				shouldEqual body, info

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
				shouldEqual err.message, 'timeout'

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
				shouldEqual body, info

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
				shouldEqual +body, buffer.length

	it 'monitorApp', (tdone) ->
		p = 'test/fixtures/monitorApp-test.coffee'
		kit.copySync 'test/fixtures/monitorApp.coffee', p
		kit.monitorApp {
			bin: 'coffee'
			args: [p]
			onErrorExit: ({ code, signal }) ->
				try
					assert.strictEqual code, 10
					tdone()
				catch err
					tdone err
		}
		setTimeout ->
			kit.outputFileSync p, 'process.exit 10'
		, 500

	it 'iter', ->
		assert.deepEqual kit.iter([1, 2, 3])(), { key: 0, value: 1 }
		assert.deepEqual kit.iter('test')(), { value: 'test' }

		iter = kit.iter({ a: 1, b: 2, c: 3 })
		iter()
		assert.deepEqual iter(), { key: 'b', value: 2 }

	it 'join', ->
		assert.deepEqual(
			kit.join([1, 2, 3, 4], 'sep')
			[1, 'sep', 2, 'sep', 3, 'sep', 4]
		)

		assert.deepEqual(
			kit.join([1, 2, 3, 4], -> 's')
			[1, 's', 2, 's', 3, 's', 4]
		)

	it 'exec', ->
		kit.exec 'echo exec_ok'
		.then ({ stdout }) ->
			shouldEqual stdout.indexOf('exec_ok\n') > -1, true

	it 'parseDependency', ->
		kit.parseDependency 'test/fixtures/depMain.coffee', {
			depRoots: ['test/fixtures/depDir']
		}
		.then (paths) ->
			shouldDeepEqual paths.sort(), [
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
		assert kit.indent('a\nb', 2), '  a\n  b'

	it 'depsCache cache newer', ->
		file = 'test/fixtures/depsCache.txt'
		cacheFile = 'test/fixtures/cacheDir/1345816117-depsCache.txt'
		contents = kit.readFileSync file, 'utf8'
		kit.depsCache {
			deps: [file]
			contents
			cacheDir
		}
		.then ->
			txt = Date.now() + ''
			kit.outputFileSync cacheFile, txt

			kit.depsCache {
				deps: [file]
				cacheDir
			}
			.then (cache) ->
				shouldEqual cache.contents, txt

	it 'depsCache file newer', ->
		file = 'test/fixtures/depsCacheFileNewer.txt'
		file1 = 'test/fixtures/depsCacheFileNewer1.txt'
		cacheDir = 'test/fixtures/cacheDir'
		cacheFile = 'test/fixtures/cacheDir/1862933060-depsCacheFileNewer.txt'

		kit.outputFileSync file1, 'test'

		contents = kit.readFileSync file, 'utf8'
		kit.depsCache {
			deps: [file, file1]
			contents
			cacheDir
		}
		.then -> kit.sleep(1000)
		.then ->
			txt = Date.now() + ''
			kit.outputFileSync file1, txt
			kit.outputFileSync cacheFile, txt

			kit.depsCache {
				deps: [file]
				cacheDir
			}
			.then (cache) ->
				shouldEqual cache.contents, undefined

	it 'warp map', ->
		tmp = 'test/fixtures/warp'

		counter = (info) ->
			info.dest.ext = '.coffee'
			info.set info.contents.length

		kit.warp 'test/fixtures/depDir/**/*.js', { cacheDir }
		.load counter
		.run tmp
		.then ->
			kit.glob tmp + '/**/*.coffee'
		.then (paths) ->
			shouldDeepEqual paths.map(unixSep) , [
				"test/fixtures/warp/dep4.coffee"
				"test/fixtures/warp/lib/index.coffee"
			]

	it 'warp custom reader', ->
		tmp = 'test/fixtures/warp-custom-reader'

		myReader = (info) ->
			kit.readFile @path, 'hex'
			.then @set
		myReader.isReader = true

		kit.warp 'test/fixtures/**/*.js', { cacheDir }
		.load myReader
		.run tmp
		.then ->
			kit.readFile tmp + '/comment.js', 'utf8'
		.then (str) ->
			shouldEqual str[0..10], '2f2a2a0a092'

	it 'warp concat', ->
		tmp = 'test/fixtures/warp_all.coffee'

		kit.warp 'test/fixtures/depDir/**/*.coffee', { cacheDir }
		.load kit.drives.concat 'warp_all.coffee'
		.run 'test/fixtures'
		.then ->
			kit.readFile tmp, 'utf8'
		.then (str) ->
			shouldEqual str.indexOf("require './lib'") > 0, true

	it 'warp auto', ->
		path = 'test/fixtures/compiler.all'
		kit.warp 'test/fixtures/compiler/*', { cacheDir }
			.load kit.drives.auto 'lint'
			.load kit.drives.auto 'compile'
			.load kit.drives.auto 'compress'
			.load kit.drives.concat 'compiler.all'
		.run 'test/fixtures'
		.then ->
			str = kit.readFileSync path, 'utf8'
			shouldDeepEqual _.trim(str).split('\n').sort(), [
				'.test .bar{color:red}'
				'.test{color:red}'
				'var a;a=function(){return console.log("OK")};'
				'var table1;table1=[{id:1,name:"george"},{id:2}];'
			]

	it 'task deps', ->
		seq = []

		kit.task 'default', { deps: ['one'], description: '0' } , ->
			seq.push 'default'
			seq

		kit.task 'one', { deps: ['two']} , ->
			seq.push 'one'

		kit.task 'two', { description: '2' } , ->
			seq.push 'two'

		kit.task.run()
		.then ([seq]) ->
			shouldDeepEqual seq, [ 'two', 'one', 'default' ]

	it 'task sequential', ->
		seq = []

		kit.task 'default', { deps: ['one', 'two'], isSequential: true } , (v) ->
			seq.push v
			seq

		kit.task 'one', (v) ->
			new Promise (r) ->
				setTimeout ->
					seq.push v
					r 2
				, 5

		kit.task 'two', { deps: 'one', description: '2' } , (v) ->
			seq.push v
			1

		kit.task.run 'default', { isSequential: true, init: 0 }
		.then (seq) ->
			shouldDeepEqual seq, [0, [2], 1]

	it 'defaultArgs', ->
		fn = ->
		shouldDeepEqual (kit.defaultArgs ['c', fn], {
			str1: { String: '0' }
			fn: { Function: -> 'test' }
			str2: { String: '1' }
		}), {
			str1: 'c', fn: fn, str2: '1'
		}

	it 'defaultArgs2', ->
		fn = ->
		shouldDeepEqual (kit.defaultArgs ['c', fn, 'd'], {
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
		shouldEqual ret, 'ysx'

	it 'fuzzySearch order', ->
		ret = kit.fuzzySearch('b', [
			'lb', 'build'
		])
		shouldEqual ret, 'build'

	it 'fuzzySearch not found', ->
		shouldEqual kit.fuzzySearch('ys', [
			'ss', 'ab'
		]), undefined
