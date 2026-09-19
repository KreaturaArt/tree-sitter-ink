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

The largest remaining limitations are:

- Code after `~` and logic inside braces are opaque text.
- `VAR` and `CONST` initializers accept only a narrow subset of values.
- Choices, tunnels, lists, escapes, identifiers, and dynamic tags are incomplete.
- The generated tree has no semantic fields.
- Highlight queries contain incorrect and overly broad captures.
- The standard package test command does not run the corpus.

## Slice 1: Scanner Safety And Lexical Correctness

- [x] Stop line-comment scanning at EOF.
- [x] Test a non-empty line comment at EOF with no final newline.
- [x] Test an empty line comment at EOF with no final newline.
- [x] Test comments before LF and CRLF line endings.
- [x] Treat bare CR as unsupported recovery input, matching upstream.
- [x] Match upstream non-nesting block comments, which end at the first `*/`.
- [x] Keep newlines inside block comments observable enough for correct source
      positions.
- [x] Rename misspelled scanner helpers such as `check_commment_start`.
- [x] Remove unused scanner helpers and includes.
- [x] Ensure failed scanner probes never consume input in a way that impairs
      recovery.

## Slice 2: Paired Delimiters And Recovery

- [x] Require function parameter parentheses as a pair.
- [x] Require parentheses around initially active list items as a pair.
- [x] Add malformed-input binding cases for missing opening and closing tokens.
- [x] Keep incomplete editor input recoverable with explicit `ERROR` or missing
      tokens rather than silently accepting malformed declarations.
- [ ] Apply the same paired-delimiter policy to labels, list values, calls, and
      parameter lists as those constructs are added.

## Slice 3: Source Directives

- [x] Parse `INCLUDE` and capture the complete filename through end of line.
- [x] Permit dots, path separators, spaces, and non-ASCII filename characters.
- [x] Parse `EXTERNAL name(parameters)` declarations, including zero arguments.
- [x] Parse `TODO` author warnings with an optional colon.
- [x] Distinguish directives from ordinary text only at a physical line start.
- [x] Test the `INCLUDED` keyword prefix as ordinary content.
- [ ] Test `EXTERNALITY` and `TODOLIST` keyword prefixes as
      ordinary content.
- [x] Accept declarations and author warnings in nested flows, matching upstream
      statement parsing and preserving editor recovery.
- [ ] Do not support deprecated `~ include`; recover it as invalid code.

## Slice 4: Flow Headers And Parameters

- [x] Add knot parameter lists: `=== knot(a, b) ===`.
- [x] Add stitch parameter lists: `= stitch(a)`.
- [x] Reuse parameter parsing for functions, knots, stitches, and externals.
- [x] Parse ordinary value parameters.
- [x] Parse reference parameters: `ref value`.
- [x] Parse divert-target parameters: `-> target`.
- [x] Parse reference divert-target parameters: `ref -> target`.
- [x] Support empty parameter lists where upstream permits them.
- [x] Add `name` and `parameters` fields to flow headers and externals.
- [x] Test and accept trailing commas in parameter and call argument lists, matching upstream's
      `Interleave` parser behavior.

## Slice 5: Diverts, Tunnels, And Threads

- [x] Parse arguments on diverts: `-> target(a, b)`.
- [x] Parse arguments on threads: `<- target(a, b)`.
- [x] Parse argument expressions, including divert targets.
- [x] Preserve qualified targets such as `knot.stitch.label`.
- [ ] Represent `END` and `DONE` as special destinations or well-documented
      target identifiers.
- [x] Parse divert targets as values in declarations and expressions.
- [x] Support tunnel calls and chains: `-> first -> second -> destination`.
- [x] Support tunnel return: `->->`.
- [x] Support tunnel return overrides: `->-> destination`.
- [x] Support variable tunnel return destinations.
- [x] Keep a bare `->` valid only as an explicit fallback choice marker.
- [x] Add `target` and `arguments` fields to navigation nodes.

## Slice 6: Choices And Weaves

- [x] Preserve once-only `*` and sticky `+` choice kinds as distinct nodes or a
      named marker value.
- [x] Preserve structural depth for compact and spaced markers (`***`, `* * *`).
- [x] Reject or recover mixed marker kinds at one choice depth.
- [x] Parse choice labels before conditions.
- [ ] Support a newline between a choice label and its text, added in ink 1.2.0.
- [x] Parse multiple adjacent choice conditions on a physical choice line.
- [ ] Support conditions and choice content split across lines.
- [x] Represent choice text partitions before, inside, and after `[...]`.
- [x] Support empty hidden text `[]`.
- [x] Support fallback choices and fallback choices with bodies.
- [x] Support tags in shared, choice-only, and output-only partitions.
- [x] Parse diverts at the end of choice text.
- [x] Add fields for marker, label, conditions, shared/choice-only/output-only
      content, and target; marker child count represents depth.
- [x] Preserve gather depth for compact and spaced `-` markers.
- [x] Parse gather labels and divert-only gathers.
- [ ] Distinguish weave gathers from branch dashes inside brace blocks.
- [ ] Test directly nested gathers and options at arbitrary depth.

## Slice 7: Tags

- [x] Support multiple tags on a content line.
- [x] Support standalone tag-only lines.
- [x] Accept arbitrary tag text rather than only `identifier[: remainder]`.
- [x] Preserve spaces, punctuation, slashes, and additional colons in tag text.
- [ ] Parse dynamic inline expressions inside tags.
- [x] Stop one tag at the next `#` or physical line boundary.
- [ ] Stop one tag at escaped hashes and choice/content boundaries correctly.
- [ ] Respect escaped hashes as literal text.
- [ ] Reject or recover tags inside string expressions, where ink forbids them.
- [ ] Cover global tags, knot tags, choice tags, and multiple dynamic tags.

## Slice 8: Identifiers, Paths, And Escapes

- [x] Match upstream's explicit supported Unicode ranges instead of accepting
      arbitrary Unicode letters and numbers.
- [x] Add CJK, Hiragana, Katakana, Hangul, Arabic, Hebrew, Armenian, Cyrillic,
      Greek, and Latin range fixtures.
- [x] Permit identifiers beginning with digits.
- [x] Reject identifiers made entirely of digits.
- [x] Reject hyphens in identifiers while continuing to permit them in prose.
- [x] Test and reject generic combining marks outside upstream's explicit ranges.
- [x] Parse qualified identifier paths of arbitrary depth.
- [x] Distinguish declarations, references, calls, list items, and flow paths in
      the syntax tree.
- [x] Parse backslash as an escape of the immediately following character.
- [x] Support escapes in prose, choices, tags, and strings.
- [x] Cover escaped whitespace before a choice-leading alternative.
- [x] Do not interpret escapes as C-style sequences such as newline escapes.

## Slice 9: Literals And Expression Foundation

- [x] Parse integer literals.
- [x] Parse decimal floating-point literals.
- [x] Keep hexadecimal, binary, exponent, and numeric separators invalid.
- [x] Parse `true` and `false` as boolean literals.
- [x] Parse quoted strings with escaped characters.
- [x] Parse simple identifier values.
- [x] Parse parenthesized expressions.
- [x] Parse zero-argument and argument-bearing function calls.
- [x] Parse divert-target values.
- [x] Parse empty, single-item, and multi-item list values.
- [x] Resolve the syntax ambiguity between `(expression)` and one-item list
      values without making common incomplete input unstable.
- [ ] Allow dynamic ink content inside runtime string expressions where valid.
- [ ] Restrict global constant-like string initializers according to upstream
      semantics only if that can be represented syntactically without harming
      recovery; otherwise document it as semantic validation.

## Slice 10: Operators And Precedence

- [x] Parse unary `-`, `!`, and `not`.
- [x] Parse logical `&&`, `and`, `||`, and `or`.
- [x] Parse comparison `==`, `!=`, `<`, `<=`, `>`, and `>=`.
- [x] Parse containment/list operators `?`, `has`, `!?`, and `hasnt`.
- [x] Parse list intersection `^`.
- [x] Parse arithmetic `+`, `-`, `*`, `/`, `%`, and `mod`.
- [x] Reproduce upstream precedence, including its distinct precedence levels
      for `+` versus `-`, `*` versus `/`, and `%`/`mod`.
- [x] Require word operators to have valid token boundaries.
- [x] Parse postfix `++` and `--` on references, then restrict their valid use to
      logic-line contexts through grammar context or semantic validation.
- [ ] Add ambiguity and associativity fixtures for every precedence boundary.

## Slice 11: Logic Statements

- [x] Replace opaque `code_text` content with structured logic statements.
- [x] Parse assignment `=`.
- [x] Parse compound assignment `+=` and `-=`.
- [x] Parse standalone increment and decrement.
- [x] Parse `temp` declarations with and without initializers as upstream allows.
- [x] Parse `return` with and without a value.
- [x] Parse function-call statements.
- [x] Recover unsupported bare expressions after `~` without treating them as
      ordinary story prose.
- [x] Reuse expression nodes in `VAR` and `CONST` initializers.
- [x] Preserve an explicit invalid-logic fallback temporarily, then
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

- [x] Parse list declarations with ordinary and initially active items.
- [x] Parse explicit integer values on list items.
- [x] Support all documented parenthesization forms for active valued items.
- [x] Parse qualified list items.
- [x] Parse empty, single-item, multi-item, and multi-origin list values.
- [x] Parse list constructor calls as ordinary calls; argument-count validation is semantic.
- [x] Parse list mutation through assignment and compound assignment.
- [x] Cover comparison, containment, union, subtraction, intersection, and list
      stepping operations through the expression grammar.
- [x] Cover built-ins `LIST_COUNT`, `LIST_MIN`, `LIST_MAX`, `LIST_RANDOM`,
      `LIST_VALUE`, `LIST_ALL`, `LIST_INVERT`, and `LIST_RANGE` as ordinary calls.
- [x] Do not implement deprecated unary list inversion as valid syntax.

## Slice 16: Built-Ins And Reserved Names

- [x] Parse built-ins as ordinary calls while optionally highlighting known names.
- [x] Cover `CHOICE_COUNT`, `TURNS`, `TURNS_SINCE`, and `READ_COUNT` syntactically.
- [x] Cover `RANDOM`, `SEED_RANDOM`, `MIN`, `MAX`, `POW`, `FLOOR`, `CEILING`,
      `INT`, and `FLOAT`.
- [x] Cover all list built-ins as ordinary calls.
- [x] Test literal and variable divert-target arguments through shared call arguments.
- [x] Leave reserved declaration validation to semantic tooling.

## Slice 17: Newlines And Blank Lines

- [ ] Make one `line_end` consume one LF or CRLF ending atomically; bare CR is
      unsupported upstream and should be recovery input.
- [ ] Decide whether blank lines should be named nodes, anonymous tokens, or
      discarded, then implement only that model.
- [ ] Remove the generated anonymous node whose type is an empty string.
- [ ] Test LF, CRLF, and CR throughout declarations, comments, and flow bodies.
- [x] Treat U+2028 and U+2029 as unsupported input, not line endings or spaces.
- [ ] Keep indentation non-semantic.
- [ ] Verify incremental reparsing around inserted and deleted newlines.
- [ ] Isolate this slice because it will update broad corpus snapshots.

## Slice 18: Syntax-Tree API

- [x] Add `name` fields to declarations and flow headers.
- [x] Add `value` fields to declarations and assignments.
- [x] Add `body` fields to knots, stitches, and functions; block branches remain pending.
- [x] Add `target` and `arguments` fields to diverts and threads.
- [x] Add choice and gather fields alongside their structural rewrite.
- [ ] Prefer stable named nodes over aliases with empty or misleading names.
- [ ] Document intentional node-shape compatibility breaks.
- [ ] Avoid a standalone compatibility layer unless an actual downstream user
      requires one.

## Slice 19: Queries And Editor Support

- [x] Fix the `@commment` typo.
- [x] Stop highlighting every identifier as a function.
- [x] Avoid whole-line captures that include line endings.
- [x] Highlight declarations, calls, flow names, labels, operators,
      strings, numbers, comments, tags, and keywords contextually.
- [x] Compile highlight queries as part of `tree-sitter test`.
- [ ] Consider locals queries after references and scopes are represented.
- [ ] Consider folds for knots, stitches, functions, and multiline blocks.
- [ ] Consider indentation queries for weave and brace nesting.
- [x] Document client-specific captures such as `@ui.text` if retained.

## Slice 20: Test And Release Workflow

- [ ] Make `npm test` run corpus and binding tests.
- [x] Add binding smoke tests that parse representative ink features.
- [ ] Add focused corpus files by feature instead of extending one large file
      indefinitely.
- [x] Keep real-story fixtures as non-error integration tests.
- [ ] Add scanner regression tests for EOF and incremental edits.
- [ ] Add malformed syntax fixtures where recovery behavior is part of the API.
- [x] Run `tree-sitter generate` after every grammar shape change completed so far.
- [x] Verify `tree-sitter test` after every completed slice so far.
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
