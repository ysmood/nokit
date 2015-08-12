## Hindley-Milner Function Type Notation

We use all lower cased string to represent a type varialble, it represents any class. For example `a`, `b`, `test`, `low_bit`.
We use pascal cased string to represent a class. For example `String`, `Number`, `Human`, `NumCounter`.


- `foo :: a -> a`: The `foo` receives type `a` and return type `a`. For example, if `foo` receive a string it must return a string, if it receive a number it must return a number.

  ```js
  function foo (n) { return n + 1; }
  ```

- `foo :: a -> b`: Same as above, but receives any type and can return any type.

  ```js
  function foo (str) { return [str]; }
  ```

- `foo :: (String a) => a -> a`: Here the `a` is String type, the `foo` receives type String and return type String.

  ```js
  function foo (str) { return str + 'suffix'; }
  ```

- `foo :: (String a, Number | String b) => a -> b -> a`: Here the `a` is String type, `b` is Number or String type, the `foo` receives type String, type Number and return type String.

  ```js
  function foo (str, i) { return str[i]; }
  ```


## DSL

```js

var foo = T({}, 'a', ['a']);

var bar = T({ a: String, b: Number }, 'a', 'b', { id: 'a', val: ['b'], foo: foo });

// a can be String or Number
var bar = T({ a: [String, Number] }, 'a', ['a']);

```
