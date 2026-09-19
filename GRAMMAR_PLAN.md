# Ink Grammar Improvement Plan

This plan compares the grammar with ink's upstream authoring documentation and
current compiler behavior through ink 1.2.1. It is intentionally broader than
the first implementation pass: each checkbox is a candidate reviewable slice,
and syntax-tree changes should be committed separately from unrelated tooling
or query changes.

## Goals

- Parse valid ink without hangs or avoidable `ERROR` nodes.
- Expose executable ink as useful syntax nodes instead of opaque text.
- Preserve line-oriented error recovery for incomplete editor buffers.
- Match upstream lexical details, including identifiers, escapes, comments,
  tags, and significant newlines.
- Keep generated parser files, node types, corpus fixtures, and queries in sync.
- Document intentional permissiveness where the grammar accepts incomplete ink.

## Current Baseline

The grammar currently handles knots, stitches, functions, weave markers,
labels, basic diverts and threads, glue, comments, simple declarations, simple
tags, balanced brace blocks, Unicode prose, and broad error recovery.

The largest current limitations are:

- `//` at end of file without a newline can hang the external scanner.
- Code after `~` and logic inside braces are opaque text.
- `VAR` and `CONST` initializers accept only a narrow subset of values.
- Knot and stitch parameters and divert/thread arguments are absent.
- `INCLUDE`, `EXTERNAL`, and `TODO` statements are not represented.
- Tags, choices, tunnels, lists, escapes, and identifiers are incomplete.
- The generated tree has no semantic fields.
- Highlight queries contain incorrect and overly broad captures.
- The standard package test command does not run the corpus.

## Slice 1: Scanner Safety And Lexical Correctness

- [ ] Stop line-comment scanning at EOF.
- [ ] Test empty and non-empty line comments at EOF with no final newline.
- [ ] Test comments before LF, CRLF, and CR line endings.
- [ ] Decide whether block comments should match upstream non-nesting behavior;
      the current grammar accepts nested block comments.
- [ ] Keep newlines inside block comments observable enough for correct source
      positions.
- [ ] Rename misspelled scanner helpers such as `check_commment_start`.
- [ ] Remove unused scanner helpers and includes.
- [ ] Ensure failed scanner probes never consume input in a way that impairs
      recovery.

## Slice 2: Paired Delimiters And Recovery

- [ ] Require function parameter parentheses as a pair.
- [ ] Require parentheses around initially active list items as a pair.
- [ ] Add malformed-input corpus cases for missing opening and closing tokens.
- [ ] Keep incomplete editor input recoverable with explicit `ERROR` or missing
      tokens rather than silently accepting malformed declarations.
- [ ] Apply the same paired-delimiter policy to labels, list values, calls, and
      parameter lists as those constructs are added.

## Slice 3: Source Directives

- [ ] Parse `INCLUDE` and capture the complete filename through end of line.
- [ ] Permit dots, path separators, spaces, and non-ASCII filename characters.
- [ ] Parse `EXTERNAL name(parameters)` declarations, including zero arguments.
- [ ] Parse `TODO` author warnings with an optional colon.
- [ ] Distinguish directives from ordinary text only at a physical line start.
- [ ] Test keyword prefixes such as `INCLUDED`, `EXTERNALITY`, and `TODOLIST` as
      ordinary content.
- [ ] Decide whether to accept declarations in nested flows for recovery even
      though upstream authoring guidance treats them as global.
- [ ] Do not support deprecated `~ include`; recover it as invalid code.

## Slice 4: Flow Headers And Parameters

- [ ] Add knot parameter lists: `=== knot(a, b) ===`.
- [ ] Add stitch parameter lists: `= stitch(a)`.
- [ ] Reuse parameter parsing for functions, knots, stitches, and externals.
- [ ] Parse ordinary value parameters.
- [ ] Parse reference parameters: `ref value`.
- [ ] Parse divert-target parameters: `-> target`.
- [ ] Parse reference divert-target parameters: `ref -> target`.
- [ ] Support empty parameter lists where upstream permits them.
- [ ] Add `name` and `parameters` fields while introducing these nodes.
- [ ] Test trailing commas according to upstream compiler behavior rather than
      accepting them accidentally.

## Slice 5: Diverts, Tunnels, And Threads

- [ ] Parse arguments on diverts: `-> target(a, b)`.
- [ ] Parse arguments on threads: `<- target(a, b)`.
- [ ] Parse argument expressions, including divert targets.
- [ ] Preserve qualified targets such as `knot.stitch.label`.
- [ ] Represent `END` and `DONE` as special destinations or well-documented
      target identifiers.
- [ ] Parse divert targets as values in declarations and expressions.
- [ ] Support tunnel calls and chains: `-> first -> second -> destination`.
- [ ] Support tunnel return: `->->`.
- [ ] Support tunnel return overrides: `->-> destination`.
- [ ] Support variable tunnel return destinations.
- [ ] Keep a bare `->` valid only as an explicit fallback choice marker.
- [ ] Add `target` and `arguments` fields to navigation nodes.

## Slice 6: Choices And Weaves

- [ ] Preserve once-only `*` and sticky `+` choice kinds as distinct nodes or a
      named marker value.
- [ ] Preserve structural depth for compact and spaced markers (`***`, `* * *`).
- [ ] Reject or recover mixed marker kinds at one choice depth.
- [ ] Parse choice labels before conditions.
- [ ] Support a newline between a choice label and its text, added in ink 1.2.0.
- [ ] Parse multiple adjacent choice conditions.
- [ ] Support conditions and choice content split across lines.
- [ ] Represent choice text partitions before, inside, and after `[...]`.
- [ ] Support empty hidden text `[]`.
- [ ] Support fallback choices and fallback choices with bodies.
- [ ] Support tags in shared, choice-only, and output-only partitions.
- [ ] Parse diverts at the end of choice text.
- [ ] Add fields for marker, depth, label, conditions, displayed text, output
      text, and target where practical.
- [ ] Preserve gather depth for compact and spaced `-` markers.
- [ ] Parse gather labels and divert-only gathers.
- [ ] Distinguish weave gathers from branch dashes inside brace blocks.
- [ ] Test directly nested gathers and options at arbitrary depth.

## Slice 7: Tags

- [ ] Support multiple tags on a content line.
- [ ] Support standalone tag-only lines.
- [ ] Accept arbitrary tag text rather than only `identifier[: remainder]`.
- [ ] Preserve spaces, punctuation, slashes, and additional colons in tag text.
- [ ] Parse dynamic inline expressions inside tags.
- [ ] Stop one tag at the next unescaped `#` or the relevant content boundary.
- [ ] Respect escaped hashes as literal text.
- [ ] Reject or recover tags inside string expressions, where ink forbids them.
- [ ] Cover global tags, knot tags, choice tags, and multiple dynamic tags.

## Slice 8: Identifiers, Paths, And Escapes

- [ ] Match upstream's explicit supported Unicode ranges instead of accepting
      arbitrary Unicode letters and numbers.
- [ ] Add CJK, Hiragana, Katakana, Hangul, Arabic, Hebrew, Armenian, Cyrillic,
      Greek, and Latin range fixtures.
- [ ] Permit identifiers beginning with digits.
- [ ] Reject identifiers made entirely of digits.
- [ ] Reject hyphens in identifiers while continuing to permit them in prose.
- [ ] Test combining marks and document whether upstream accepts them.
- [ ] Parse qualified identifier paths of arbitrary depth.
- [ ] Distinguish declarations, references, calls, list items, and flow paths in
      the syntax tree.
- [ ] Parse backslash as an escape of the immediately following character.
- [ ] Support escapes in prose, choices, tags, and strings.
- [ ] Cover escaped whitespace before a choice-leading alternative.
- [ ] Do not interpret escapes as C-style sequences such as newline escapes.

## Slice 9: Literals And Expression Foundation

- [ ] Parse integer literals.
- [ ] Parse decimal floating-point literals.
- [ ] Keep hexadecimal, binary, exponent, and numeric separators invalid.
- [ ] Parse `true` and `false` as boolean literals.
- [ ] Parse quoted strings and escaped characters.
- [ ] Parse references and qualified paths.
- [ ] Parse parenthesized expressions.
- [ ] Parse zero-argument and argument-bearing function calls.
- [ ] Parse divert-target values.
- [ ] Parse empty, single-item, and multi-item list values.
- [ ] Resolve the syntax ambiguity between `(expression)` and one-item list
      values without making common incomplete input unstable.
- [ ] Allow dynamic ink content inside runtime string expressions where valid.
- [ ] Restrict global constant-like string initializers according to upstream
      semantics only if that can be represented syntactically without harming
      recovery; otherwise document it as semantic validation.

## Slice 10: Operators And Precedence

- [ ] Parse unary `-`, `!`, and `not`.
- [ ] Parse logical `&&`, `and`, `||`, and `or`.
- [ ] Parse comparison `==`, `!=`, `<`, `<=`, `>`, and `>=`.
- [ ] Parse containment/list operators `?`, `has`, `!?`, and `hasnt`.
- [ ] Parse list intersection `^`.
- [ ] Parse arithmetic `+`, `-`, `*`, `/`, `%`, and `mod`.
- [ ] Reproduce upstream precedence, including its distinct precedence levels
      for `+` versus `-`, `*` versus `/`, and `%`/`mod`.
- [ ] Require word operators to have valid token boundaries.
- [ ] Keep postfix `++` and `--` out of general expressions.
- [ ] Add ambiguity and associativity fixtures for every precedence boundary.

## Slice 11: Logic Statements

- [ ] Replace opaque `code_text` with structured logic statements.
- [ ] Parse assignment `=`.
- [ ] Parse compound assignment `+=` and `-=`.
- [ ] Parse standalone increment and decrement.
- [ ] Parse `temp` declarations with and without initializers as upstream allows.
- [ ] Parse `return` with and without a value.
- [ ] Parse function-call statements.
- [ ] Recover unsupported bare expressions after `~` without treating them as
      ordinary story prose.
- [ ] Reuse expression nodes in `VAR` and `CONST` initializers.
- [ ] Preserve an opaque fallback temporarily if needed during migration, then
      remove it once representative upstream fixtures parse structurally.

## Slice 12: Inline Output And Conditional Text

- [ ] Parse `{expression}` inline output.
- [ ] Parse `{condition:true text}`.
- [ ] Parse `{condition:true text|false text}`.
- [ ] Support nested inline conditions.
- [ ] Support inline logic within ordinary prose, choices, tags, and strings in
      contexts where upstream permits it.
- [ ] Distinguish a choice condition from an alternative that starts choice text.
- [ ] Preserve escaped whitespace as the documented disambiguation mechanism.
- [ ] Remove opaque `inline_block` fallbacks once equivalent recovery exists.

## Slice 13: Multiline Conditions And Switches

- [ ] Parse simple multiline `if` blocks.
- [ ] Parse `else` and else-if branches as named nodes.
- [ ] Parse query-less multibranch conditionals.
- [ ] Parse switch-like blocks with an initial query expression.
- [ ] Support empty branches.
- [ ] Support choices and logic statements inside branches.
- [ ] Support nested conditional and sequence blocks.
- [ ] Prevent weave gathers from being accepted inside curly-brace blocks.
- [ ] Remove the current redundant nested `condition_block` wrapper.
- [ ] Add fields for query, condition, consequence, alternative, and branches.

## Slice 14: Sequences And Alternatives

- [ ] Parse stopping sequences, including the unmarked default form.
- [ ] Parse cycle `&`, once-only `!`, shuffle `~`, and explicit stopping `$`.
- [ ] Parse combined shuffle-once `~!` and shuffle-stopping `~$` forms.
- [ ] Parse blank alternatives, including leading and trailing blanks.
- [ ] Parse nested alternatives.
- [ ] Parse diverts inside alternatives.
- [ ] Parse multiline `stopping`, `cycle`, `once`, `shuffle`, `shuffle once`, and
      `shuffle stopping` blocks.
- [ ] Reject unsupported annotation combinations through syntax or documented
      semantic validation.
- [ ] Allow full block content in multiline sequence entries.

## Slice 15: Lists

- [ ] Parse list declarations with ordinary and initially active items.
- [ ] Parse explicit integer values on list items.
- [ ] Support all documented parenthesization forms for active valued items.
- [ ] Parse qualified list items.
- [ ] Parse empty, single-item, multi-item, and multi-origin list values.
- [ ] Parse list constructor calls with zero or one numeric argument.
- [ ] Parse list mutation through assignment and compound assignment.
- [ ] Cover comparison, containment, union, subtraction, intersection, and list
      stepping operations through the expression grammar.
- [ ] Cover built-ins `LIST_COUNT`, `LIST_MIN`, `LIST_MAX`, `LIST_RANDOM`,
      `LIST_VALUE`, `LIST_ALL`, `LIST_INVERT`, and `LIST_RANGE` as ordinary calls.
- [ ] Do not implement deprecated unary list inversion as valid syntax.

## Slice 16: Built-Ins And Reserved Names

- [ ] Parse built-ins as ordinary calls while optionally highlighting known names.
- [ ] Cover `CHOICE_COUNT`, `TURNS`, `TURNS_SINCE`, and `READ_COUNT`.
- [ ] Cover `RANDOM`, `SEED_RANDOM`, `MIN`, `MAX`, `POW`, `FLOOR`, `CEILING`,
      `INT`, and `FLOAT`.
- [ ] Cover all list built-ins.
- [ ] Test literal and variable divert-target arguments to flow queries.
- [ ] Decide whether reserved declarations should be syntactically rejected or
      left to semantic tooling.

## Slice 17: Newlines And Blank Lines

- [ ] Make one `line_end` consume one physical ending, treating CRLF atomically.
- [ ] Decide whether blank lines should be named nodes, anonymous tokens, or
      discarded, then implement only that model.
- [ ] Remove the generated anonymous node whose type is an empty string.
- [ ] Test LF, CRLF, and CR throughout declarations, comments, and flow bodies.
- [ ] Decide whether U+2028 and U+2029 are line endings or unsupported input;
      do not classify them as ordinary spaces while claiming line significance.
- [ ] Keep indentation non-semantic.
- [ ] Verify incremental reparsing around inserted and deleted newlines.
- [ ] Isolate this slice because it will update broad corpus snapshots.

## Slice 18: Syntax-Tree API

- [ ] Add `name` fields to declarations and flow headers.
- [ ] Add `value` fields to declarations and assignments.
- [ ] Add `body` fields to knots, stitches, functions, and block branches.
- [ ] Add `target` and `arguments` fields to diverts and threads.
- [ ] Add choice/gather fields introduced alongside their structural rewrite.
- [ ] Prefer stable named nodes over aliases with empty or misleading names.
- [ ] Document intentional node-shape compatibility breaks.
- [ ] Avoid a standalone compatibility layer unless an actual downstream user
      requires one.

## Slice 19: Queries And Editor Support

- [ ] Fix the `@commment` typo.
- [ ] Stop highlighting every identifier as a function.
- [ ] Avoid whole-line captures that include line endings.
- [ ] Highlight declarations, references, calls, flow names, labels, operators,
      strings, numbers, comments, tags, and keywords contextually.
- [ ] Add query tests or snapshots.
- [ ] Consider locals queries after references and scopes are represented.
- [ ] Consider folds for knots, stitches, functions, and multiline blocks.
- [ ] Consider indentation queries for weave and brace nesting.
- [ ] Document client-specific captures such as `@ui.text` if retained.

## Slice 20: Test And Release Workflow

- [ ] Make `npm test` run corpus and binding tests.
- [ ] Add a binding smoke test that parses representative ink.
- [ ] Add focused corpus files by feature instead of extending one large file
      indefinitely.
- [ ] Keep real-story fixtures as non-error integration tests.
- [ ] Add scanner regression tests for EOF and incremental edits.
- [ ] Add malformed syntax fixtures where recovery behavior is part of the API.
- [ ] Run `tree-sitter generate` after every grammar shape change.
- [ ] Verify `tree-sitter test` after every slice.
- [ ] Verify all available language bindings before release.
- [ ] Record the supported ink version and known semantic-only validations.

## Recommended Delivery Order

1. Scanner EOF safety.
2. Paired delimiters and malformed-input recovery.
3. `INCLUDE`, `EXTERNAL`, and `TODO` directives.
4. Shared flow parameter lists.
5. Divert and thread arguments plus tunnel return targets.
6. Repeated and dynamic tags.
7. Identifier and escape correctness.
8. Expression atoms and literals.
9. Operators and logic statements.
10. Choice structure and choice conditions.
11. Inline conditional text and alternatives.
12. Multiline conditionals, switches, and sequences.
13. Complete list syntax.
14. Newline and blank-line redesign.
15. Syntax-tree fields, queries, and editor support as each relevant node family
    stabilizes.

## Per-Slice Acceptance Criteria

Every implementation slice should:

- add focused positive and recovery corpus cases;
- regenerate `src/grammar.json`, `src/node-types.json`, and `src/parser.c` when
  grammar rules change;
- run `tree-sitter test` successfully;
- run relevant binding or build tests;
- avoid unrelated formatting or generated changes;
- update this plan's checkboxes and README support claims when behavior changes;
- land as one independently understandable commit.
