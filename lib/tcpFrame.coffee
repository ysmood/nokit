
weightList = [0, 1, 2, 3, 4, 5].map (i) -> Math.pow(2, i * 7)

###*
 * The algorithm is supports nearly infinity size message.
 * Each message has two parts, "header" and "body":
 *
 * | header | body |
 *
 * The size of the header is dynamically decided by the header itself.
 * Each byte (8 bits) in the header has two parts, "continue" and "fraction":
 *
 * | continue |   fraction    |
 * |    0     | 1 2 3 4 5 6 7 |
 *
 * If the "continue" is 0, the header ends.
 * If the "continue" is 1, then the followed byte should also be part of the header.
 *
 * Sum all the fractions together, we will get the size of the message.
 *
 * For example:
 *
 * |                      header                         | body |
 * | continue |   fraction    | continue |   fraction    |      |
 * |    0     | 1 0 0 0 0 0 0 |    1     | 1 1 0 1 0 0 0 | ...  |
 *
 *  So the size of the body is b10000001101000 bytes.
 *
 * @param  {Number} len
 * @return {Buffer}
###
genSizeBuf = (len) ->
    sizeList = []
    digit = 0

    while len > 0
        digit = len % 128
        len = (len - digit) / 128

        if (len > 0)
            sizeList.push(digit | 0b10000000)
        else
            sizeList.push digit

    new Buffer sizeList

getWeight = (n) ->
    if (n < weightList.length)
        weightList[n]
    else
        Math.pow(2, n * 7)

module.exports = (sock, opts = {}) ->

    readEncoding = undefined
    writeEncoding = undefined
    sock.setEncoding = (encoding) -> readEncoding = encoding
    sock.setDefaultEncoding = (encoding) -> writeEncoding = encoding
    maxSize = opts.maxSize || 1024 * 1024 # 1MB

    { cipher, decipher } = opts

    if cipher
        cipher.pipe sock

    sock.writeFrame = (data, encoding, cb) ->
        if typeof encoding == 'function'
            cb = encoding
            encoding = undefined

        encoding ?= writeEncoding

        if not Buffer.isBuffer(data)
            data = new Buffer data, encoding

        sizeBuf = genSizeBuf data.length

        if (cipher)
            cipher.write sizeBuf, cb
            cipher.write data, cb
        else
            sock.write sizeBuf, cb
            sock.write data, cb

    buf = new Buffer 0
    msgSize = 0 # byte
    headerSize = 0 # byte
    isContinue = true

    reset = () ->
        msgSize = 0
        headerSize = 0
        isContinue = true

    parseHeader = () ->
        while isContinue && headerSize < buf.length
            digit = buf[headerSize]
            isContinue = (digit & 0b10000000) == 128
            msgSize += (digit & 0b01111111) * getWeight(headerSize)
            headerSize++

        return

    # cases
    # [x x 0 0 0 0 | x x 0 0 0]
    # [ | x x 0 0 0 0 x x 0 0 0]
    # [x x 0 0 | 0 0 x x 0 0 0]
    # [x x 0 0 0 0 x | x 0 0 0]
    # [x x 0 0 0 0 x x 0 0 0]
    frameEvent = (chunk) ->
        buf = Buffer.concat [buf, chunk]

        if buf.length > maxSize
            buf = new Buffer 0
            reset()
            sock.emit 'error', new Error('frame exceeded the limit')
            return;

        if buf.length > 0
            parseHeader()
        else
            return

        while buf.length >= msgSize + headerSize
            buf = buf.slice headerSize

            if readEncoding
                sock.emit 'frame', buf.slice(0, msgSize).toString(readEncoding)
            else
                sock.emit 'frame', buf.slice(0, msgSize)

            buf = buf.slice msgSize

            reset()

            if buf.length > 0
                parseHeader()
            else
                return

        return

    if opts.head && opts.head.length > 0
        frameEvent opts.head

    if decipher
        sock.pipe(decipher).on 'data', frameEvent
    else
        sock.on 'data', frameEvent
