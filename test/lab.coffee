kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
# require '../lib/proxy'

ken = require '../lib/test'


ken 'main', (ken, t) ->

    ken 'test 01', (t) ->
        t.eq 1, 2
