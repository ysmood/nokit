var genHeader, getWeight, weightList;

weightList = [0, 1, 2, 3, 4, 5].map(function(i) {
  return Math.pow(2, i * 7);
});


/**
 * The algorithm is supports nearly infinity size of message.
 * Each message has three parts, "version", "header" and "body":
 *
 * | version | header | body |
 *
 * All the rest part of the doc use big-endian order.
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
 */

genHeader = function(len) {
  var digit, header;
  header = [0];
  digit = 0;
  while (len > 0) {
    digit = len % 128;
    len = (len - digit) / 128;
    if (len > 0) {
      header.push(digit | 0x80);
    } else {
      header.push(digit);
    }
  }
  return new Buffer(header);
};

getWeight = function(n) {
  n--;
  if (n < weightList.length) {
    return weightList[n];
  } else {
    return Math.pow(2, n * 7);
  }
};

module.exports = function(sock, opts) {
  var buf, cipher, decipher, error, frameEvent, headerSize, isContinue, maxSize, msgSize, parseHeader, readEncoding, reset, version, writeEncoding;
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
  maxSize = opts.maxSize || 1024 * 1024;
  cipher = opts.cipher, decipher = opts.decipher;
  if (cipher) {
    cipher.pipe(sock);
  }
  sock.writeFrame = function(data, encoding, cb) {
    var header;
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
    header = genHeader(data.length);
    if (cipher) {
      cipher.write(header, cb);
      return cipher.write(data, cb);
    } else {
      sock.write(header, cb);
      return sock.write(data, cb);
    }
  };
  buf = new Buffer(0);
  version = null;
  msgSize = 0;
  headerSize = 0;
  isContinue = true;
  reset = function() {
    version = null;
    msgSize = 0;
    headerSize = 0;
    return isContinue = true;
  };
  error = function(msg) {
    buf = new Buffer(0);
    reset();
    return sock.emit('error', new Error(msg));
  };
  parseHeader = function() {
    var digit;
    if (version === null) {
      version = buf[0];
      headerSize = 1;
    }
    switch (version) {
      case 0:
        while (isContinue && headerSize < buf.length) {
          digit = buf[headerSize];
          isContinue = (digit & 0x80) === 128;
          msgSize += (digit & 0x7f) * getWeight(headerSize);
          headerSize++;
        }
        return true;
      default:
        error('wrong protocol version');
        return false;
    }
    return false;
  };
  frameEvent = function(chunk) {
    buf = Buffer.concat([buf, chunk]);
    if (buf.length > maxSize) {
      error('frame exceeded the limit');
      return;
    }
    if (buf.length > 0) {
      if (!parseHeader()) {
        return;
      }
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
      reset();
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
  if (decipher) {
    return sock.pipe(decipher).on('data', frameEvent);
  } else {
    return sock.on('data', frameEvent);
  }
};
