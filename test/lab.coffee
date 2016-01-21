kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
{ Promise } = kit

app = proxy.flow()


h = proxy.url()

app.push ($) ->
    h($)


app.server.on('connect', proxy.connect())

app.listen(8123)