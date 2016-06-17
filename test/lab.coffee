yaml = require('js-yaml');

yamlify = require('../lib/yamlify')

str = yamlify({
    b: {
        a: 1,
        b: 'asdfk\nasl\ndjkf'
        c: [1, 2, 3]
    }
})
str = yamlify('asdfk\nasl\ndjkf')

# console.log(str)

console.dir(yaml.load('|4\n    asd\n    asd'))
