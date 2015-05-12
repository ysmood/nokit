'use strict'

module.exports = _ =

    extend: (to, from) ->
        for k of from
            to[k] = from[k]
        to

    defaults: (to, from) ->
        for k of from
            if to[k] == undefined
                to[k] = from[k]
        to

    isString: (val) -> typeof val == 'string'

    isFunction: (val) -> typeof val == 'function'

    all: (arr, fn) ->
        for el, i in arr
            if fn(el, i) == false
                return false

        return true

    any: (arr, fn) ->
        for el, i in arr
            if fn(el, i) == true
                return true

        return false
