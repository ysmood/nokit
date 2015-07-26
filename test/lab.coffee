kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
{ Promise } = kit
# require '../lib/proxy'

ken = require '../lib/ken'
test = ken()

ken.all [
    test 'basic 1', ->
        test.eq 'ok', 'ok'
    test 'basic 2', ->
        test.eq 'ok', 'ok1'
]
