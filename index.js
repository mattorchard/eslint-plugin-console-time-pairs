/**
 * @typedef {Object} EsLintNode
 *
 * @typedef {{
 *  label: string,
 *  labelSourceCode: string,
 *  isStaticString: boolean,
 *  objectName: string,
 *  edge: 'start' | 'end',
 *  node: EsLintNode,
 *  scope: EsLintNode | null
 * }} Timer
 *
 * @typedef {{
 *  scope: 'File' | 'SameFunction' | 'SameRootFunction'
 * objectNames: string[]
 * }} PluginOptions
 */

/**
 * @param {EsLintNode} node
 * @returns {string | null}
 */
function getStringLiteralValue(node) {
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0].value.raw;
  }
  return null;
}

/**
 * @param {Object} startingNode
 * @param {boolean} stopAtFirst
 * @returns {EsLintNode | null}
 */
function findAncestralFunctionBlock(startingNode, stopAtFirst) {
  let ancestor = null;
  let node = startingNode;
  while (node && node.parent) {
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "ArrowFunctionExpression"
    ) {
      ancestor = node;
      if (stopAtFirst) return ancestor;
    }
    node = node.parent;
  }
  return ancestor;
}

/** @type {Record<PluginOptions['scope'], (EsLintNode) => void>} */
const ScopeFinders = {
  File: () => null,
  SameFunction: (node) => findAncestralFunctionBlock(node, true),
  SameRootFunction: (node) => findAncestralFunctionBlock(node, false),
};

const rules = {
  "console-time-pairs": {
    meta: {
      type: "problem",
      schema: [
        {
          type: "object",
          properties: {
            objectNames: {
              description: `Objects to check for calls to time/timeEnd under (defaults to ["console"])`,
              type: "array",
              items: {
                type: "string",
              },
            },
            scope: {
              type: "string",
              description: "How far to check for matching pairs",
              enum: ["File", "SameFunction", "SameRootFunction"],
            },
          },
        },
      ],
    },
    create: function (context) {
      /** @type {PluginOptions} */
      const options = {
        objectNames: ["console"],
        scope: "File",
        allowDuplicates: false,
        ...context.options[0],
      };
      const objectNamesToCheck = new Set(options.objectNames);
      const findScope = ScopeFinders[options.scope];

      /** @type {Timer[]} */
      const timers = [];

      const handleTimeFnCallExpression =
        (/** @type {'start' | 'end'} */ edge) =>
        (/** @type {EsLintNode} */ node) => {
          if (node.arguments.length === 0) return;
          const objectName = node.callee.object.name;
          if (!objectNamesToCheck.has(objectName)) return;

          const firstArgument = node.arguments[0];
          const labelSourceCode = context.sourceCode.getText(firstArgument);
          const literalValue = getStringLiteralValue(firstArgument);
          const isStaticString = literalValue !== null;
          const label = isStaticString ? literalValue : labelSourceCode;
          timers.push({
            label,
            labelSourceCode,
            node,
            isStaticString,
            objectName,
            edge,
            scope: findScope(node),
          });
        };

      return {
        'CallExpression[callee.property.name="time"]':
          handleTimeFnCallExpression("start"),
        'CallExpression[callee.property.name="timeEnd"]':
          handleTimeFnCallExpression("end"),
        "Program:exit": () => {
          for (const timer of timers) {
            const hasPair = timers.some(
              (otherTimer) =>
                timer !== otherTimer &&
                timer.scope === otherTimer.scope &&
                timer.edge !== otherTimer.edge &&
                timer.isStaticString === otherTimer.isStaticString &&
                timer.label === otherTimer.label &&
                timer.objectName === otherTimer.objectName,
            );
            if (!hasPair) {
              context.report({
                node: timer.node,
                message:
                  timer.edge === "start"
                    ? "{{objectName}}.time({{labelSourceCode}}) has no matching {{objectName}}.timeEnd({{labelSourceCode}})"
                    : "{{objectName}}.timeEnd({{labelSourceCode}}) has no matching {{objectName}}.time({{labelSourceCode}})",
                data: {
                  labelSourceCode: timer.labelSourceCode,
                  objectName: timer.objectName,
                },
              });
            }
          }
        },
      };
    },
  },
};

module.exports = {
  rules,
};
