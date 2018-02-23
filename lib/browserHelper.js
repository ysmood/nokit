module.exports = function (opts) {
	'use strict';

	const self = {};

	const init = () => initAutoReload();

	self.log = function (msg, action) {
		if (action == null) {
			action = 'log';
		}
		console[action](msg);
		const req = new XMLHttpRequest;
		req.open('POST', '/nokit-log');
		req.setRequestHeader('Content-Type', 'application/json');
		return req.send(JSON.stringify(msg));
	};

	var initAutoReload = function () {
		self.es = new EventSource(opts.host + '/nokit-sse');

		return self.es.addEventListener('fileModified', function (e) {
			const path = JSON.parse(e.data);

			console.log(`>> fileModified: ${path}`);

			const reloadElem = function (el, key) {
				if (el[key].indexOf('?') === -1) {
					el[key] += '?nokitAutoReload=0';
				} else {
					if (el[key].indexOf('nokitAutoReload') > -1) {
						el[key] = el[key].replace(
							/nokitAutoReload=(\d+)/,
							(m, p) => `nokitAutoReload=${+p + 1}`);
					} else {
						el[key] += '&nokitAutoReload=0';
					}
				}

				// Fix the Chrome renderer bug.
				const {
					body
				} = document;
				const {
					scrollTop
				} = body;
				body.style.display = 'none';
				// no need to store this anywhere, the reference is enough.
				body.offsetHeight;
				return setTimeout(function () {
					body.style.display = 'block';
					return body.scrollTop = scrollTop;
				}, 50);
			};

			const each = function (qs, handler) {
				const elems = document.querySelectorAll(qs);
				return [].slice.apply(elems).forEach(handler);
			};

			if (!path) {
				location.reload();
				return;
			}

			const m = path.match(/\.[^.]+$/);
			let isFound = false;

			switch (m && m[0]) {
				case '.js':
					each('script', function (el) {
						// Only reload the page if the page has included
						// the href.
						if (el.src.indexOf(path) > -1) {
							isFound = true;
							return location.reload();
						}
					});
					break;

				case '.css':
					each('link', function (el) {
						if (el.href.indexOf(path) > -1) {
							isFound = true;
							return reloadElem(el, 'href');
						}
					});
					break;

				case '.jpg':
				case '.gif':
				case '.png':
					each('img', function (el) {
						if (el.src.indexOf(path) > -1) {
							isFound = true;
							return reloadElem(el, 'src');
						}
					});
					break;
			}

			if (!isFound) {
				return location.reload();
			}
		});
	};

	init();

	return self;
};