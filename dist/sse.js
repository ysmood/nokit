
/**
 * A Server-Sent Event Manager.
 * For more info see [Using server-sent events](https://developer.mozilla.org/en-US/docs/Server-sentEvents/UsingServer-sentEvents).
 * It is used to implement the live-reload of web assets.
 * @param {Object} opts Defaults:
 * ```js
 * {
 *  // The reconnection time to use when attempting to send the event, unit is ms.
 *  retry: 1000
 * }
 * ```
 * @example
 * Your server side code may look like this:
 * ```js
 * let http = require('http');
 * let kit = require('nokit');
 * let sse = kit.require('sse');
 * let sseHandler = sse();
 *
 * http.createServer((req, res) => {
 *     if (req.url === '/sse')
 *         sseHandler(req, res);
 *     else
 *         res.end();
 * }).listen(8080, () =>
 *     setTimeout(() =>
 *         sseHandler.emit('test', { test: 'ok' })
 *     );
 * );
 * ```
 *
 * You browser code should be something like this:
 * ```js
 * let es = new EventSource('/sse');
 * es.addEventListener('test', (e) => {
 *     let msg = JSON.parse(e.data);
 *     console.log(msg); // => { test: 'ok' }
 * });
 * ```
 */
var sse;

sse = function(opts) {
  var self;
  if (opts == null) {
    opts = {};
  }

  /**
   * The sse middleware for http handler.
   * @param {http.IncomingMessage} req Also supports Express.js.
   * @param {http.ServerResponse} res Also supports Express.js.
   */
  self = function(req, res) {
    var session;
    session = self.create(req, res);
    return self.sessions.push(session);
  };
  if (opts.retry == null) {
    opts.retry = 1000;
  }

  /**
   * The sessions of connected clients.
   * @type {Array}
   */
  self.sessions = [];

  /**
   * Broadcast a event to all clients.
   * @param {String} event The event name.
   * @param {Object | String} msg The data you want to emit to session.
   * @param {String} [path] The namespace of target sessions. If not set,
   * broadcast to all clients.
   */
  self.emit = function(event, msg, path) {
    var el, i, len, ref, results;
    if (path == null) {
      path = '';
    }
    ref = self.sessions;
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      el = ref[i];
      if (!path) {
        results.push(el.emit(event, msg));
      } else if (el.req.path === path) {
        results.push(el.emit(event, msg));
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

  /**
   * Create a sse session.
   * @param {http.IncomingMessage} req Also supports Express.js.
   * @param {http.ServerResponse} res Also supports Express.js.
   * @return {SSESession}
   */
  self.create = function(req, res) {

    /**
     * A session object is something like:
     * ```js
     * {
     *  req,  // The http req object.
     *  res   // The http res object.
     * }
     * ```
     */
    var session;
    session = {
      req: req,
      res: res
    };
    req.socket.setTimeout(0);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    /**
     * Emit message to client.
     * @param  {String} event The event name.
     * @param  {Object | String} msg The message to send to the client.
     */
    session.emit = function(event, msg) {
      if (msg == null) {
        msg = '';
      }
      msg = JSON.stringify(msg);
      return res.write("id: " + (Date.now()) + "\nevent: " + event + "\nretry: " + opts.retry + "\ndata: " + msg + "\n\n");
    };
    req.on('close', function() {
      return self.sessions.splice(self.sessions.indexOf(session), 1);
    });
    session.emit('connect', 'ok');
    return session;
  };
  return self;
};

module.exports = sse;
