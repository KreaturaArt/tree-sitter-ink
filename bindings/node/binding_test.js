const assert = require("node:assert");
const { test } = require("node:test");

const Parser = require("tree-sitter");

test("can load grammar", () => {
  const parser = new Parser();
  assert.doesNotThrow(() => parser.setLanguage(require(".")));
});

test("parses inline tags without consuming alternatives", () => {
  const parser = new Parser();
  parser.setLanguage(require("."));
  const root = parser.parse("{true: yes #tag|no}\n").rootNode;
  assert.equal(root.hasError, false);
  assert.match(root.toString(), /\(inline_tag \(inline_tag_text\)\)/);
  assert.match(root.toString(), /alternative: \(inline_content/);
});
