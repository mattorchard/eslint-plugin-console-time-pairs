# eslint-plugin-console-time-pairs

Ensure `console.timeEnd` is called for each `console.time`.

## Why?

Finding out at runtime that you've typoed a label, or forgot to call `time` or `timeEnd` is not fun.
This plugin makes sure every call to `time` has a matching call to `timeEnd` (and vice versa) so you can catch those mistakes at lint-time instead of run-time.

```ts
function() {
  console.time("Some long operation");
  // ...
  console.timeEnd("Some looong operation"); // Generates a warning!
}
```

## Installation

```shell
# npm
npm install eslint-plugin-console-time-pairs --save-dev
# yarn
yarn add eslint-plugin-console-time-pairs --dev
```

In your `.estlintrc.js` add `"console-time-pairs"` to the plugin list.

```js
plugins: [
  "console-time-pairs",
],
```

Then in the rules section set `"console-time-pairs/console-time-pairs"`
pass the log level (either `"error"` or `"warning"`).

```js
rules: {
  "console-time-pairs/console-time-pairs": "error",
},
```

## Configuration (Optional)

### Object names

By default only `console.time` and `console.timeEnd` will be scanned.
To also scan calls like `logger.time` specify `"logger"` in the `objectNames` array.

```js
rules: {
  "console-time-pairs/console-time-pairs": ["error", {
    "objectNames": ["console", "logger", "myCustomTimerUtil"],
  }],
},
```

### Scope

By default the entire file will be checked for matching `time`/`timeEnd` calls.
But this behavior can be customized with the `scope` option:

- `SameFunction`: the calls must be made from inside the same function definition
- `SameRootFunction`: the calls must be defined in some shared encapsulating function definition
- `File` **(default)**: the calls can be made anywhere in the same file

```js
rules: {
  "console-time-pairs/console-time-pairs": ["error", {
    "scope": "SameFunction" | "SameRootFunction" | "File",
  }],
},
```

#### Example

```js
console.time("A"); // Will always produce a warning

function() {
  console.time("B"); //    Will produce a warning with "SameFunction", "SameRootFunction"
}
function() {
  console.timeEnd("B"); // Will produce a warning with "SameFunction", "SameRootFunction"
}
function() {
  setTimeout(() => console.time("C"), 100); //    Will only produce a warning with "SameFunction"
  setTimeout(() => console.timeEnd("C"), 200); // Will only produce a warning with "SameFunction"
}
function() {
  console.time("D"); //    Will never produce a warning
  console.timeEnd("D"); // Will never produce a warning
}
```

## Limitations

If the label argument is **not** a string literal the plugin will attempt to match using the text of the source code.
This handles many cases, such as: using a shared label variable, using identical string-template expressions, concatenating strings in the same way, etc.

However, it can still generate false positives if the expressions are not identical.
In those cases using lint-skips, or extracting out a variable for the timer label should resolve the issue.
