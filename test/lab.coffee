kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
# require '../lib/proxy'

ken = require '../lib/test'

ken 'main', ((ken) -> Promise.all [
	ken 'basic 1', (ken) ->
		kit.sleep(100).then ->
			ken.eq 1, 1

	ken 'basic 2', (ken) ->
		ken.eq 10, 1
])
.catch ->
    # process.exit 1
