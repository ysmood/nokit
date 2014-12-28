assert = require 'assert'
kit = require '../lib/kit'
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
		http = require 'http'

		info = 'ok'

		server = http.createServer (req, res) ->
			res.end info

		server.listen 0, ->
			{ port } = server.address()

			kit.request {
				url: '0.0.0.0:' + port
			}
			.then (body) ->
				server.close()

				try
					assert.equal body, info
					tdone()
				catch err
					tdone err

	it 'request timeout', (tdone) ->
		http = require 'http'

		server = http.createServer()

		server.listen 0, ->
			{ port } = server.address()

			promise = kit.request {
				url: '0.0.0.0:' + port
				timeout: 50
			}

			{ req } = promise

			promise.catch (err) ->
				try
					assert.equal err.message, 'timeout'
					tdone()
				catch err
					tdone err
			.then ->
				server.close()
