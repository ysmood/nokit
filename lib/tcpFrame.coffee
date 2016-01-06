{ _ } = require './kit';

weightList = [
    Math.pow 2, 0
    Math.pow 2, 8
    Math.pow 2, 16
    Math.pow 2, 24
]

headerSize = 4

getLen = (buf) ->
    i = 0
    len = 0

    while i < headerSize
        len += buf[i] * weightList[i]
        i++

    len

genSizeBuf = (len) ->
    sizeBuf = new Buffer headerSize
    digit = 0
    i = 0

    while i < headerSize
        if len > 0
            digit = len % 256
            len = (len - digit) / 256
            sizeBuf[i] = digit
        else
            sizeBuf[i] = 0

        i++

    sizeBuf

module.exports = (sock, opts = {}) ->

    readEncoding = undefined
    writeEncoding = undefined
    sock.setEncoding = (encoding) -> readEncoding = encoding
    sock.setDefaultEncoding = (encoding) -> writeEncoding = encoding

    sock.writeFrame = (data, encoding, cb) ->
        if _.isFunction encoding
            cb = encoding
            encoding = undefined

        encoding ?= writeEncoding

        if not Buffer.isBuffer(data)
            data = new Buffer data, encoding

        sizeBuf = genSizeBuf data.length

        sock.write Buffer.concat([sizeBuf, data]), cb

    buf = new Buffer 0

    # cases
    # [x x 0 0 0 0 | x x 0 0 0]
    # [ | x x 0 0 0 0 x x 0 0 0]
    # [x x 0 0 | 0 0 x x 0 0 0]
    # [x x 0 0 0 0 x | x 0 0 0]
    # [x x 0 0 0 0 x x 0 0 0]
    frameEvent = (chunk) ->
        buf = Buffer.concat [buf, chunk]

        while buf.length >= headerSize
            len = getLen buf

            if buf.length >= len + headerSize
                buf = buf.slice headerSize
                if readEncoding
                    sock.emit 'frame', buf.slice(0, len).toString(readEncoding)
                else
                    sock.emit 'frame', buf.slice(0, len)

                buf = buf.slice len
            else
                return

    if opts.head && opts.head.length > 0
        frameEvent opts.head

    sock.on 'data', frameEvent
