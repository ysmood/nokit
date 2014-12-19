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
