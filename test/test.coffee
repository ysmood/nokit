assert = require 'assert'
kit = require '../kit'
{ _ } = kit

kit.lang_load 'test/lang'

describe 'Kit:', ->

	it 'kit.parse_comment', (tdone) ->
		path = 'test/fixtures/comment.coffee'
		kit.readFile path, 'utf8'
		.done (str) ->
			comments = kit.parse_comment 'kit', str, path
			comment = comments[0]
			assert.equal comment.path, path
			assert.equal comment.tags[0].type, 'Int'
			assert.equal comment.tags[0].name, 'limit'
			tdone()

	it 'async progress', (tdone) ->
		len = kit.fs.readFileSync(__filename).length
		iter = (i) ->
			if i == 10
				return
			kit.readFile __filename

		kit.async 3, iter, false
		.progress (ret) ->
			assert.equal ret.length, len
		.done (rets) ->
			assert.equal rets, undefined
			tdone()

	it 'async results', (tdone) ->
		len = kit.fs.readFileSync(__filename).length

		kit.async 3, _.times 10, ->
			(i) ->
				assert.equal typeof i, 'number'
				kit.readFile __filename
		.progress (ret) ->
			assert.equal ret.length, len
		.done (rets) ->
			assert.equal rets.length, 10
			tdone()

	it 'lang normal', ->
		str = kit.lang 'test', 'cn'
		assert.equal str, '测试'

	it 'lang alter', ->
		assert.equal 'test|0'.l, 'test'

	it 'crypto', ->
		en = kit.encrypt '123', 'test'
		assert.equal kit.decrypt(en, 'test').toString(), '123'
