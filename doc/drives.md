# Warp Drives

- ## **[Overview](lib/drives.coffee?source#L9)**

    The built-in plguins for warp. It's more like examples
    to show how to use nokit efficiently.

- ## **[coffee](lib/drives.coffee?source#L18)**

    coffee-script compiler

    - **<u>param</u>**: `opts` { _Object_ }

        Default is `{ bare: true }`.

    - **<u>return</u>**: { _Function_ }

- ## **[coffeelint](lib/drives.coffee?source#L40)**

    coffeelint processor

    - **<u>param</u>**: `opts` { _Object_ }

        Default is `{ colorize: true }`.

    - **<u>return</u>**: { _Function_ }

- ## **[concat](lib/drives.coffee?source#L69)**

    a batch file concat helper

    - **<u>param</u>**: `name` { _String_ }

        The output file path.

    - **<u>param</u>**: `dir` { _String_ }

        Optional. Override the dest of warp's.

    - **<u>return</u>**: { _Function_ }

- ## **[comment2md](lib/drives.coffee?source#L97)**

    Parse commment from a js or coffee file, and output a markdown string.

    - **<u>param</u>**: `path` { _String_ }

    - **<u>param</u>**: `opts` { _Object_ }

        Defaults:
        ```coffee
        {
        	parseComment: {}
        	formatComment: {
        		name: ({ name, line }) ->
        			name = name.replace 'self.', ''
        			link = "#{path}?source#L#{line}"
        			"- \#\#\# **[#{name}](#{link})**\n\n"
        	}
        }
        ```

    - **<u>return</u>**: { _Function_ }

- ## **[livescript](lib/drives.coffee?source#L130)**

    livescript compiler

    - **<u>param</u>**: `opts` { _Object_ }

        Default is `{ bare: true }`.

    - **<u>return</u>**: { _Function_ }

- ## **[uglify](lib/drives.coffee?source#L162)**

    uglify-js processor

    - **<u>param</u>**: `opts` { _Object_ }

        Defaults:
        ```coffee
        {
        	output:
        		comments: (node, comment) ->
        			text = comment.value
        			type = comment.type
        			if type == "comment2"
        				return /@preserve|@license|@cc_on/i.test text
        }
        ```

    - **<u>return</u>**: { _Function_ }

- ## **[reader](lib/drives.coffee?source#L177)**

    read file and set `contents`

- ## **[writer](lib/drives.coffee?source#L187)**

    output file by `contents` and `dest`

