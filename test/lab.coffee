kit = require '../lib/kit'
{ _, Promise } = kit
proxy = kit.require 'proxy'
kit.require 'url'
http = require 'http'
{ Promise } = kit


kit.warp('test/fixtures/comment.coffee')
.load(kit.require('drives').comment2md({
    tpl: 'doc/readme.jst.md'
}))
.run('out');
