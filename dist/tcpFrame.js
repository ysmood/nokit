var _, genSizeBuf, getLen, headerSize, weightList;

_ = require('./kit')._;

weightList = [Math.pow(2, 0), Math.pow(2, 8), Math.pow(2, 16), Math.pow(2, 24)];

headerSize = 4;

getLen = function(buf) {
  var i, len;
  i = 0;
  len = 0;
  while (i < headerSize) {
    len += buf[i] * weightList[i];
    i++;
  }
  return len;
};

genSizeBuf = function(len) {
  var digit, i, sizeBuf;
  sizeBuf = new Buffer(headerSize);
  digit = 0;
  i = 0;
  while (i < headerSize) {
    if (len > 0) {
      digit = len % 256;
      len = (len - digit) / 256;
      sizeBuf[i] = digit;
    } else {
      sizeBuf[i] = 0;
    }
    i++;
  }
  return sizeBuf;
};

module.exports = function(sock, opts) {
  var buf, frameEvent, readEncoding, writeEncoding;
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
    if (_.isFunction(encoding)) {
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
  frameEvent = function(chunk) {
    var len;
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= headerSize) {
      len = getLen(buf);
      if (buf.length >= len + headerSize) {
        buf = buf.slice(headerSize);
        if (readEncoding) {
          sock.emit('frame', buf.slice(0, len).toString(readEncoding));
        } else {
          sock.emit('frame', buf.slice(0, len));
        }
        buf = buf.slice(len);
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
