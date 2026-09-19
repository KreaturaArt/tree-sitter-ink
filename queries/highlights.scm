; comments and author metadata
(line_comment) @comment
(block_comment) @comment
(todo_line) @comment.warning
(tag) @comment

; flow declarations
(knot_header name: (identifier) @type)
(stitch_header name: (identifier) @type)
(function_header name: (identifier) @function)
(external_line name: (identifier) @function)

; declarations
(var_line name: (identifier) @variable)
(const_line name: (identifier) @constant)
(list_line name: (identifier) @type)
(list_definition_item name: (identifier) @constant)
(temporary_declaration name: (identifier) @variable)

; calls and navigation
(call_expression function: (identifier) @function.call)
(divert target: (identifier_path) @label)
(divert_return target: (identifier_path) @label)
(thread target: (identifier_path) @label)
(label (identifier) @label)

; values
(string) @string
(boolean) @constant.builtin
(number) @constant.numeric
(float) @constant.numeric.float
(escaped_character) @string.escape

; keywords and directives
[
  (var_start)
  (const_start)
  (list_start)
  (include_start)
  (external_start)
  (todo_start)
  (ref)
] @keyword

[
  (once_choice_marker)
  (sticky_choice_marker)
] @keyword.directive

(gather_mark) @keyword.directive
(glue) @operator

; operators
[
  (assignment)
  (compound_assignment)
  (mutation_operator)
  (and_operator)
  (or_operator)
  (has_operator)
  (hasnt_operator)
  (mod_operator)
  (not_operator)
  (arrow)
  (double_arrow)
  (back_arrow)
  (dot)
] @operator

; punctuation
[
  (mark_start)
  (mark_end)
  (hide_start)
  (hide_end)
] @punctuation.bracket

; content markup
(inline_expression) @embedded
(inline_conditional) @embedded
(inline_sequence) @embedded
(condition_block) @embedded

; Helix uses this client-specific capture to retain prose rendering.
(program) @ui.text
