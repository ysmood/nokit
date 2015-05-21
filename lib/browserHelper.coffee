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
        es = new EventSource(opts.host + '/nokit-sse')

        isConnected = false

        es.addEventListener 'connect', (e) ->
            # If already connected, reload the page.
            if isConnected
                location.reload()

            data = JSON.parse e.data
            if data == 'ok'
                isConnected = true

        es.addEventListener 'fileModified', (e) ->
            msg = JSON.parse(e.data)

            console.log(">> fileModified: " + msg.reqPath)

            reloadElem = (el, key) ->
                if el[key].indexOf('?') == -1
                    el[key] += '?nbAutoReload=0'
                else
                    if el[key].indexOf('nbAutoReload') > -1
                        el[key] = el[key].replace(
                            /nbAutoReload=(\d+)/
                            (m, p) ->
                                'nbAutoReload=' + (+p + 1)
                        )
                    else
                        el[key] += '&nbAutoReload=0'

                # Fix the Chrome renderer bug.
                body = document.body
                body.style.display = 'none'
                # no need to store this anywhere, the reference is enough.
                body.offsetHeight
                setTimeout ->
                    body.style.display = 'block'
                , 50

            each = (qs, handler) ->
                elems = document.querySelectorAll(qs)
                [].slice.apply(elems).forEach(handler)

            if not msg.reqPath
                location.reload()
                return

            switch msg.extBin
                when '.js'
                    each 'script', (el) ->
                        # Only reload the page if the page has included
                        # the href.
                        if el.src.indexOf(msg.reqPath) > -1
                            location.reload()

                when '.css'
                    each 'link', (el) ->
                        if el.href.indexOf(msg.reqPath) > -1
                            reloadElem el, 'href'

                when '.jpg', '.gif', '.png'
                    each 'img', (el) ->
                        if el.src.indexOf(msg.reqPath) > -1
                            reloadElem el, 'src'

                else
                    location.reload()

    init()

    self
