module.exports = function(opts) {
  'use strict';
  var init, initAutoReload, self;
  self = {};
  init = function() {
    return initAutoReload();
  };
  self.log = function(msg, action) {
    var req;
    if (action == null) {
      action = 'log';
    }
    console[action](msg);
    req = new XMLHttpRequest;
    req.open('POST', '/nokit-log');
    req.setRequestHeader('Content-Type', 'application/json');
    return req.send(JSON.stringify(msg));
  };
  initAutoReload = function() {
    self.es = new EventSource(opts.host + '/nokit-sse');
    return self.es.addEventListener('fileModified', function(e) {
      var each, isFound, m, path, reloadElem;
      path = JSON.parse(e.data);
      console.log(">> fileModified: " + path);
      reloadElem = function(el, key) {
        var body, scrollTop;
        if (el[key].indexOf('?') === -1) {
          el[key] += '?nokitAutoReload=0';
        } else {
          if (el[key].indexOf('nokitAutoReload') > -1) {
            el[key] = el[key].replace(/nokitAutoReload=(\d+)/, function(m, p) {
              return 'nokitAutoReload=' + (+p + 1);
            });
          } else {
            el[key] += '&nokitAutoReload=0';
          }
        }
        body = document.body;
        scrollTop = body.scrollTop;
        body.style.display = 'none';
        body.offsetHeight;
        return setTimeout(function() {
          body.style.display = 'block';
          return body.scrollTop = scrollTop;
        }, 50);
      };
      each = function(qs, handler) {
        var elems;
        elems = document.querySelectorAll(qs);
        return [].slice.apply(elems).forEach(handler);
      };
      if (!path) {
        location.reload();
        return;
      }
      m = path.match(/\.[^.]+$/);
      isFound = false;
      switch (m && m[0]) {
        case '.js':
          each('script', function(el) {
            if (el.src.indexOf(path) > -1) {
              isFound = true;
              return location.reload();
            }
          });
          break;
        case '.css':
          each('link', function(el) {
            if (el.href.indexOf(path) > -1) {
              isFound = true;
              return reloadElem(el, 'href');
            }
          });
          break;
        case '.jpg':
        case '.gif':
        case '.png':
          each('img', function(el) {
            if (el.src.indexOf(path) > -1) {
              isFound = true;
              return reloadElem(el, 'src');
            }
          });
      }
      if (!isFound) {
        return location.reload();
      }
    });
  };
  init();
  return self;
};
