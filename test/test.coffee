assert = require 'assert'
kit = require '../lib/kit'
http = require 'http'
{ _ } = kit

describe 'Kit:', ->

	it 'kit.parseComment', (tdone) ->
		path = 'test/fixtures/comment.coffee'
		kit.readFile path, 'utf8'
		.done (str) ->
			comments = kit.parseComment 'nobone', str, path
			assert.equal comments[0].path, path
			assert.equal comments[0].tags[0].type, 'Int'
			assert.equal comments[0].tags[0].name, 'limit'
			tdone()

	it 'glob sync', (tdone) ->
		kit.glob 'test/fixtures/*', { sync: true }
		.then (paths) ->
			assert.equal paths.length > 0, true
			tdone()

	it 'walk', (tdone) ->
		pathCache = []
		kit.walk 'test/fixtures/*', (path) ->
			pathCache.push path
		.then (paths) ->
			assert.equal paths.length, pathCache.length
			tdone()

	it 'async progress', (tdone) ->
		len = kit.fs.readFileSync(__filename).length
		iter = (i) ->
			if i == 10
				return
			kit.readFile __filename

		kit.async 3, iter, false, (ret) ->
			assert.equal ret.length, len
		.done (rets) ->
			assert.equal rets, undefined
			tdone()

	it 'async results', (tdone) ->
		len = kit.fs.readFileSync(__filename).length

		kit.async(3, _.times 10, ->
			(i) ->
				assert.equal typeof i, 'number'
				kit.readFile __filename
		, (ret) ->
			assert.equal ret.length, len
		).done (rets) ->
			assert.equal rets.length, 10
			tdone()

	it 'crypto', ->
		en = kit.encrypt '123', 'test'
		assert.equal kit.decrypt(en, 'test').toString(), '123'

	it 'request', (tdone) ->
		info = 'ok'

		server = http.createServer (req, res) ->
			res.end info

		server.listen 0, ->
			{ port } = server.address()

			kit.request {
				url: '127.0.0.1:' + port
			}
			.then (body) ->
				try
					assert.equal body, info
					tdone()
				catch err
					tdone err
			.catch tdone

	it 'request timeout', (tdone) ->
		server = http.createServer()

		server.listen 0, ->
			{ port } = server.address()

			promise = kit.request {
				url: '127.0.0.1:' + port
				timeout: 50
			}

			{ req } = promise

			promise.catch (err) ->
				try
					assert.equal err.message, 'timeout'
					tdone()
				catch err
					tdone err
			.catch tdone

	it 'request reqPipe', (tdone) ->
		path = 'Cakefile'
		info = kit.fs.readFileSync path, 'utf8'

		server = http.createServer (req, res) ->
			data = ''
			req.on 'data', (chunk) -> data += chunk
			req.on 'end', ->
				res.end data

		server.listen 0, ->
			{ port } = server.address()
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
				try
					assert.equal body, info
					tdone()
				catch err
					tdone err
			.catch tdone

	it 'request form-data', (tdone) ->
		server = http.createServer (req, res) ->
			form = new require('formidable').IncomingForm()

			form.parse req, (err, fields, files) ->
				res.end fields['f.md'].length.toString()

		server.listen 0, ->
			{ port } = server.address()
			form = new (require 'form-data')

			buffer = kit.fs.readFileSync 'Cakefile'

			form.append 'a.txt', 'content'
			form.append 'f.md', buffer

			kit.request {
				url: '127.0.0.1:' + port
				headers: form.getHeaders()
				setTE: true
				reqPipe: form
			}
			.then (body) ->
				try
					assert.equal +body, buffer.length
					tdone()
				catch err
					tdone err
			.catch tdone

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

	it 'exec', (tdone) ->
		kit.exec 'echo ok'
		.then ({ stdout }) ->
			assert.equal stdout, 'ok\n'
			tdone()
		.catch tdone

	it 'parseDependency', (tdone) ->
		kit.parseDependency 'test/fixtures/depMain.coffee', {
			depRoots: ['test/fixtures/depDir']
		}
		.then (paths) ->
			assert.deepEqual paths.sort(), [
				'test/fixtures/dep1.coffee'
				'test/fixtures/dep2.coffee'
				'test/fixtures/dep3.coffee'
				'test/fixtures/depDir/dep4.js'
				'test/fixtures/depDir/dep5.coffee'
				'test/fixtures/depDir/dep6.coffee'
				'test/fixtures/depDir/lib/index.js'
				'test/fixtures/depMain.coffee'
			]
			tdone()
		.catch tdone
