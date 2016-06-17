yaml = require('js-yaml');

yamlify = require('../lib/yamlify')

str = yamlify({
    b: {
        a: 1,
        b: 'asdfk\nasl\ndjkf'
        c: ['-', 2, 3, true],
        d: 'asdflj'
    }
})
# str = yamlify('asdfk\nasl\ndjkf')

console.log(str)

console.dir(yaml.load(str))
