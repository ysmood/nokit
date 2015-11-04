kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
{ Promise } = kit
# require '../lib/proxy'

setInterval ->
    kit.logs("OK")
, 2000
