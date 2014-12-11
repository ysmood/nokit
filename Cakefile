process.env.NODE_ENV = 'development'
process.chdir __dirname

kit = require './lib/kit'
{ _ } = kit

task 'build', 'Build project.', build = ->
	compileCoffee = ->
		kit.spawn 'coffee', [
			'-o', 'dist'
			'-cb', 'lib'
		]

	createDoc = ->
		kit.compose([
			kit.readFile 'lib/kit.coffee', 'utf8'
			(code) ->
				kit.parseComment 'kit', code, 'lib/kit.coffee'
			(kitModule) ->
				ejs = require 'ejs'

				indent = (str, num = 0) ->
					s = _.range(num).reduce ((s) -> s + ' '), ''
					s + str.trim().replace(/\n/g, '\n' + s)

				modsApi = ''

				for modName, mod of { kit: kitModule }
					modsApi += """### #{modName}\n\n"""
					for method in mod
						method.name = method.name.replace 'self.', ''
						sourceLink = "#{method.path}?source#L#{method.line}"
						methodStr = indent """
							- #### <a href="#{sourceLink}" target="_blank"><b>#{method.name}</b></a>
						"""
						methodStr += '\n\n'
						if method.description
							methodStr += indent method.description, 1
							methodStr += '\n\n'

						if _.any(method.tags, { tagName: 'private' })
							continue

						for tag in method.tags
							tname = if tag.name then "`#{tag.name}`" else ''
							ttype = if tag.type then "{ _#{tag.type}_ }" else ''
							methodStr += indent """
								- **<u>#{tag.tagName}</u>**: #{tname} #{ttype}
							""", 1
							methodStr += '\n\n'
							if tag.description
								methodStr += indent tag.description, 4
								methodStr += '\n\n'

						modsApi += methodStr

				kit.outputFile 'readme.md', modsApi
		])()

	start = kit.compose [
		compileCoffee
		createDoc
	]

	start().done()

task 'clean', 'Remove temp files.', clean = ->
	kit.remove 'kit.js'

task 'test', 'Test', ->
	kit.spawn('mocha', [
		'-t', '5000'
		'-r', 'coffee-script/register'
		'-R', 'spec'
		'test/test.coffee'
	]).process.on 'exit', (code) ->
		if code != 0
			process.exit code
