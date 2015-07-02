# The NoBone helper for browser

module.exports = (opts) ->
	'use strict'

	self = {}

	init = ->
		if opts.autoReload
			initAutoReload()

	self.log = (msg, action = 'log') ->
		console[action] msg
		req = new XMLHttpRequest
		req.open 'POST', '/nokit-log'
		req.setRequestHeader 'Content-Type', 'application/json'
		req.send JSON.stringify(msg)

	initAutoReload = ->
		self.es = new EventSource(opts.host + '/nokit-sse')

		self.es.addEventListener 'fileModified', (e) ->
			path = JSON.parse e.data

			console.log(">> fileModified: " + path)

			reloadElem = (el, key) ->
				if el[key].indexOf('?') == -1
					el[key] += '?nokitAutoReload=0'
				else
					if el[key].indexOf('nokitAutoReload') > -1
						el[key] = el[key].replace(
							/nokitAutoReload=(\d+)/
							(m, p) ->
								'nokitAutoReload=' + (+p + 1)
						)
					else
						el[key] += '&nokitAutoReload=0'

				# Fix the Chrome renderer bug.
				body = document.body
				scrollTop = body.scrollTop
				body.style.display = 'none'
				# no need to store this anywhere, the reference is enough.
				body.offsetHeight
				setTimeout ->
					body.style.display = 'block'
					body.scrollTop = scrollTop
				, 50

			each = (qs, handler) ->
				elems = document.querySelectorAll(qs)
				[].slice.apply(elems).forEach(handler)

			if not path
				location.reload()
				return

			m = path.match /\.[^.]+$/
			switch m and m[0]
				when '.js'
					each 'script', (el) ->
						# Only reload the page if the page has included
						# the href.
						if el.src.indexOf(path) > -1
							location.reload()

				when '.css'
					each 'link', (el) ->
						if el.href.indexOf(path) > -1
							reloadElem el, 'href'

				when '.jpg', '.gif', '.png'
					each 'img', (el) ->
						if el.src.indexOf(path) > -1
							reloadElem el, 'src'

				else
					location.reload()

	init()

	self
