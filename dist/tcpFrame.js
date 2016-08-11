var genSizeBuf, getWeight, weightList;

weightList = [0, 1, 2, 3, 4, 5].map(function(i) {
  return Math.pow(2, i * 7);
});


/**
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
 */

genSizeBuf = function(len) {
  var digit, sizeList;
  sizeList = [];
  digit = 0;
  while (len > 0) {
    digit = len % 128;
    len = (len - digit) / 128;
    if (len > 0) {
      sizeList.push(digit | 0x80);
    } else {
      sizeList.push(digit);
    }
  }
  return new Buffer(sizeList);
};

getWeight = function(n) {
  if (n < weightList.length) {
    return weightList[n];
  } else {
    return Math.pow(2, n * 7);
  }
};

module.exports = function(sock, opts) {
  var buf, frameEvent, headerSize, isContinue, msgSize, parseHeader, readEncoding, writeEncoding;
  if (opts == null) {
    opts = {};
  }
  readEncoding = void 0;
  writeEncoding = void 0;
  sock.setEncoding = function(encoding) {
    return readEncoding = encoding;
  };
  sock.setDefaultEncoding = function(encoding) {
    return writeEncoding = encoding;
  };
  sock.writeFrame = function(data, encoding, cb) {
    var sizeBuf;
    if (typeof encoding === 'function') {
      cb = encoding;
      encoding = void 0;
    }
    if (encoding == null) {
      encoding = writeEncoding;
    }
    if (!Buffer.isBuffer(data)) {
      data = new Buffer(data, encoding);
    }
    sizeBuf = genSizeBuf(data.length);
    return sock.write(Buffer.concat([sizeBuf, data]), cb);
  };
  buf = new Buffer(0);
  msgSize = 0;
  headerSize = 0;
  isContinue = true;
  parseHeader = function() {
    var digit;
    while (isContinue && headerSize < buf.length) {
      digit = buf[headerSize];
      isContinue = (digit & 0x80) === 128;
      msgSize += (digit & 0x7f) * getWeight(headerSize);
      headerSize++;
    }
  };
  frameEvent = function(chunk) {
    buf = Buffer.concat([buf, chunk]);
    if (buf.length > 0) {
      parseHeader();
    } else {
      return;
    }
    while (buf.length >= msgSize + headerSize) {
      buf = buf.slice(headerSize);
      if (readEncoding) {
        sock.emit('frame', buf.slice(0, msgSize).toString(readEncoding));
      } else {
        sock.emit('frame', buf.slice(0, msgSize));
      }
      buf = buf.slice(msgSize);
      msgSize = 0;
      headerSize = 0;
      isContinue = true;
      if (buf.length > 0) {
        parseHeader();
      } else {
        return;
      }
    }
  };
  if (opts.head && opts.head.length > 0) {
    frameEvent(opts.head);
  }
  return sock.on('data', frameEvent);
};
