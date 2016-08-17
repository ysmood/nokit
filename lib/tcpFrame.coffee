
weightList = [0, 1, 2, 3, 4, 5].map (i) -> Math.pow(2, i * 7)

###*
 * The algorithm is supports nearly infinity size of message.
 * Each message has three parts, "version", "header" and "body":
 *
 * | verion | header | body |
 *
 * The size of version is fixed with 1 byte.
 * The size of the header is dynamically decided by the header itself.
 * The size of the body is decided by the header.
 *
 * # Version 0 #
 *
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
genHeader = (len) ->
    # The first byte is for versioning.
    # So now is version 0
    header = [0]

    digit = 0

    while len > 0
        digit = len % 128
        len = (len - digit) / 128

        if (len > 0)
            header.push(digit | 0b10000000)
        else
            header.push digit

    new Buffer header

getWeight = (n) ->
    n--

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

        header = genHeader data.length

        if (cipher)
            cipher.write header, cb
            cipher.write data, cb
        else
            sock.write header, cb
            sock.write data, cb

    buf = new Buffer 0
    version = null
    msgSize = 0 # byte
    headerSize = 0 # byte
    isContinue = true

    reset = () ->
        version = null
        msgSize = 0
        headerSize = 0
        isContinue = true

    error = (msg) ->
        buf = new Buffer 0
        reset()
        sock.emit 'error', new Error(msg)

    parseHeader = () ->
        if version == null
            version = buf[0];
            headerSize = 1;

        switch version
            when 0
                while isContinue && headerSize < buf.length
                    digit = buf[headerSize]

                    #            |   get continue   |
                    isContinue = (digit & 0b10000000) == 128

                    #          |   get fraction   |
                    msgSize += (digit & 0b01111111) * getWeight(headerSize)

                    headerSize++
                return true
            else
                error 'wrong protocol version'
                return false

        return false

    # cases
    # [x x 0 0 0 0 | x x 0 0 0]
    # [ | x x 0 0 0 0 x x 0 0 0]
    # [x x 0 0 | 0 0 x x 0 0 0]
    # [x x 0 0 0 0 x | x 0 0 0]
    # [x x 0 0 0 0 x x 0 0 0]
    frameEvent = (chunk) ->
        buf = Buffer.concat [buf, chunk]

        if buf.length > maxSize
            error 'frame exceeded the limit'
            return;

        if buf.length > 0
            if not parseHeader()
                return
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
