const WS = /[ \t]/;
const ID_ASCII = "A-Za-z0-9_";
const ID_UNICODE = "\\u0080-\\u00FF\\u0100-\\u024F\\u0370-\\u0373\\u0376-\\u0377\\u0386\\u0388-\\u038A\\u038C\\u038E-\\u03A1\\u03A3-\\u03FF\\u0400-\\u0481\\u048A-\\u04FF\\u0531-\\u0556\\u0561-\\u0587\\u058F\\u0590-\\u06FF\\u3041-\\u3096\\u30A0-\\u30FC\\u4E00-\\u9FFF\\uAC00-\\uD7AF";
const ID_CHAR = `[${ID_ASCII}${ID_UNICODE}]`;
const ID_NON_DIGIT = `[A-Za-z_${ID_UNICODE}]`;
const PREC = {
    LOGICAL: 1,
    COMPARISON: 2,
    CONTAINMENT: 3,
    ADD: 4,
    SUBTRACT: 5,
    MULTIPLY: 6,
    DIVIDE: 7,
    MODULO: 8,
    UNARY: 9,
    POSTFIX: 10,
    CALL: 11,
};

/* Note
- PLEASE remember that repeat($.line_start, $.catch_all, $.line_end) can also
  match on previous line!! So the catch_all has always to exclude the block-end
  character
- In ink line-endings are significant in many places, therefore we have to handle
  line-endings throughout the grammar
- Where it is possible without adding complications, clear error or confusion,
  we keep the grammar more flexible than the ink-language
    - Because it is difficult to correctly lint parse-errors
    - Examples of the grammar being more flexible:
        - Function-, knot- and stitch-bodies are the same
            - Diverts in functions are allow
        - Function and stitch bodies are optional
*/

module.exports = grammar({
    name: "ink",
    extras: $ => [
        WS,
        $.block_comment,
        $.line_comment
    ],
    conflicts: $ => [
        [$.list_value, $.reference],
        [$.tag],
        [$.inline_tag],
        [$.divert_chain],
        [$.block_body],
        [$.conditional_branch],
        [$.switch_case],
        [$.else_branch],
        [$.sequence_entry],
        [$.condition_text, $.nested_block_statement],
    ],
    externals: $ => [
        $.arrow,
        $.double_arrow,
        $.back_arrow,
        $.line_comment,
        $.glue,
        $.inline_expression_start,
        $.inline_conditional_start,
        $.inline_sequence_start,
        $.block_brace_start,
        $.choice_label_continuation,
        $.choice_condition_continuation,
        $.line_start,
        $.stitch_start,
        $.knot_start,
        $.function_start,
        $.var_start,
        $.const_start,
        $.list_start,
        $.include_start,
        $.external_start,
        $.todo_start,
        $.empty_line,
        $.line_end
    ],

    rules: {

        program: $ => prec(1, seq(
            optional($.weave_body),
            repeat(
                choice(
                    $.knot,
                    $.function
                )
            )
        )),

        block_comment: $ => token(seq(
            /\/\*/,
            repeat(choice(
                /[^*]/,
                /\*[^/]/
            )),
            /\*\//,
        )),

        knot: $ => seq(
            $.knot_header,
            optional(field("body", $.weave_body)),
            repeat(
                field("stitch", $.stitch)
            )
        ),
        knot_header: $ => seq(
            $.knot_start,
            optional(/=+/),
            field("name", $.identifier),
            optional(field("parameters", $.parameter_list)),
            optional(/=+/),
            $.line_end
        ),

        stitch: $ => seq(
            $.stitch_header,
            optional(field("body", $.weave_body)), // actually not optional
        ),
        stitch_header: $ => seq(
            $.stitch_start,
            field("name", $.identifier),
            optional(field("parameters", $.parameter_list)),
            $.line_end,
        ),

        weave_body: $ => prec.right(repeat1(
            choice(
                $.weave_body_line,
                $.var_line,
                $.const_line,
                $.list_line,
                $.include_line,
                $.external_line,
                $.todo_line,
                $.empty_line
            )
        )),
        weave_body_line: $ => seq(
            $.line_start,
            optional(choice(
                $.option_text,
                $.code_text,
                $.dialog_text,
                $.gather_text,
            )),
            $.line_end
        ),

        function: $ => seq(
            $.function_header,
            optional(field("body", $.weave_body)) // actually not optional
        ),

        gather_text: $ => seq(
            field("marker", $.gather_mark),
            optional(field("label", $.label)),
            optional(field("content", $.dialog_text))
        ),
        gather_mark: $ => repeat1(
            /-/,
        ),

        option_text: $ => seq(
            field("marker", $.choice_marker),
            optional(choice(
                seq(
                    field("label", $.label),
                    optional($.choice_label_continuation),
                    repeat(seq(
                        field("condition", $.choice_condition),
                        optional($.choice_condition_continuation),
                    )),
                ),
                repeat1(seq(
                    field("condition", $.choice_condition),
                    optional($.choice_condition_continuation),
                )),
            )),
            optional(field("content", $.choice_content)),
            optional(field("target", choice($.divert_or_thread, $.default_option_mark))),
        ),
        choice_marker: $ => choice(
            $.once_choice_marker,
            $.sticky_choice_marker,
        ),
        once_choice_marker: $ => repeat1(/\*/),
        sticky_choice_marker: $ => repeat1(/\+/),
        choice_condition: $ => prec.dynamic(3, seq(/\{/, field("condition", $.expression), /\}/)),
        choice_content: $ => choice(
            field("shared", $.shared_choice_text),
            seq(
                optional(field("shared", $.shared_choice_text)),
                $.hide_start,
                optional(field("choice_only", $.choice_text)),
                $.hide_end,
                optional(field("output_only", $.choice_text)),
            ),
        ),
        shared_choice_text: $ => seq(
            choice(
                $.escaped_character,
                $.glue,
                $.inline_conditional,
                $.inline_sequence,
                $.tag,
                $.vocabulary,
                $.shared_choice_text_other,
            ),
            repeat(choice(
                $.escaped_character,
                $.glue,
                $.inline_block,
                $.tag,
                $.vocabulary,
                $.choice_text_other,
            )),
        ),
        shared_choice_text_other: $ => prec.right(repeat1(/[^\s\\\n\r\p{N}\p{L}\[\]_#\(\{\+\*]/)),
        choice_text: $ => repeat1(choice(
            $.escaped_character,
            $.glue,
            $.inline_block,
            $.tag,
            $.vocabulary,
            $.choice_text_other,
        )),
        choice_text_other: $ => prec.right(repeat1(/[^\s\\\n\r\p{N}\p{L}\[\]_#]/)),
        default_option_mark: $ => $.arrow,

        divert_or_thread: $ => choice(
            $.divert_chain,
            $.thread
        ),

        label: $ => prec.dynamic(3, seq(
            /\(/,
            $.identifier,
            /\)/
        )),

        code_text: $ => seq(
            /~/,
            choice(
                $.return_statement,
                $.temporary_declaration,
                $.assignment_statement,
                $.mutation_statement,
                $.call_statement,
                $.invalid_logic_statement,
            ),
        ),

        var_line: $ => seq(
            $.var_start,
            field("name", $.identifier),
            field("operator", $.assignment),
            field("value", $.expression),
            $.line_end
        ),
        const_line: $ => seq(
            $.const_start,
            field("name", $.identifier),
            field("operator", $.assignment),
            field("value", $.expression),
            $.line_end
        ),
        list_line: $ => seq(
            $.list_start,
            field("name", $.identifier),
            field("operator", $.assignment),
            field("value", $.list_definition),
            $.line_end
        ),
        include_line: $ => seq(
            $.include_start,
            field("path", $.include_path),
            $.line_end,
        ),
        external_line: $ => seq(
            $.external_start,
            field("name", $.identifier),
            field("parameters", $.parameter_list),
            $.line_end,
        ),
        todo_line: $ => seq(
            $.todo_start,
            optional(/:/),
            optional($.directive_remainder),
            $.line_end,
        ),
        list_definition: $ => seq(
            $.list_definition_item,
            repeat(
                seq(
                    /,/,
                    $.list_definition_item
                )
            ),
        ),

        list_definition_item: $ => choice(
            seq(
                field("name", $.identifier),
                optional(seq(
                    field("operator", $.assignment),
                    field("value", $.signed_integer),
                )),
            ),
            seq(
                $.mark_start,
                field("name", $.identifier),
                $.mark_end,
                optional(seq(
                    field("operator", $.assignment),
                    field("value", $.signed_integer),
                )),
            ),
            seq(
                $.mark_start,
                field("name", $.identifier),
                field("operator", $.assignment),
                field("value", $.signed_integer),
                $.mark_end,
            ),
        ),
        signed_integer: $ => seq(optional(/-/), $.number),
        mark_start: $ => /\(/,
        mark_end: $ => /\)/,

        dialog_text: $ => choice(
            $.condition_text,
            $.text,
            $.divert_or_thread,
            repeat1($.tag),
            seq($.text, $.divert_or_thread),
            seq($.text, repeat1($.tag))
        ),
        text: $ => repeat1(choice(
            $.escaped_character,
            $.glue,
            $.inline_block,
            $.vocabulary,
            $.other,
        )),

        hide_start: $ => /\[/,
        hide_end: $ => /\]/,

        divert_chain: $ => choice(
            $.divert_return,
            seq(
                repeat1(
                    $.divert
                ),
                optional($.divert_continue),
                optional($.divert_return)
            )
        ),
        divert: $ => seq(
            $.arrow,
            field("target", choice($.end_destination, $.done_destination, $.identifier_path)),
            optional(field("arguments", $.call_arguments)),
        ),
        divert_continue: $ => $.arrow,
        divert_return: $ => seq(
            $.double_arrow,
            optional(seq(
                field("target", $.identifier_path),
                optional(field("arguments", $.call_arguments)),
            )),
        ),
        thread: $ => seq(
            $.back_arrow,
            field("target", $.identifier_path),
            optional(field("arguments", $.call_arguments)),
        ),

        function_header: $ => seq(
            $.function_start,
            optional(/=+/),
            field("name", $.identifier),
            optional(field("parameters", $.parameter_list)),
            optional(/=+/),
            $.line_end
        ),

        parameter_list: $ => seq(
            /\(/,
            optional($.parameters),
            /\)/,
        ),
        parameters: $ => seq(
            $.parameter,
            repeat(
                seq(
                    /,/,
                    $.parameter
                )
            ),
            optional(/,/),
        ),
        parameter: $ => seq(
            optional($.ref),
            optional($.arrow),
            $.identifier
        ),
        call_arguments: $ => seq(
            /\(/,
            optional(seq(
                $.call_argument,
                repeat(seq(
                    /,/,
                    $.call_argument,
                )),
                optional(/,/),
            )),
            /\)/,
        ),
        call_argument: $ => choice(
            $.expression,
        ),

        return_statement: $ => seq(
            /return/,
            optional(field("value", $.expression)),
        ),
        temporary_declaration: $ => seq(
            /temp/,
            field("name", $.identifier),
            optional(seq(
                field("operator", $.assignment),
                field("value", $.expression),
            )),
        ),
        assignment_statement: $ => seq(
            field("target", $.identifier),
            field("operator", choice($.assignment, $.compound_assignment)),
            field("value", $.expression),
        ),
        mutation_statement: $ => seq(
            field("target", $.identifier),
            field("operator", $.mutation_operator),
        ),
        call_statement: $ => $.call_expression,
        invalid_logic_statement: $ => token(prec(-10, /[^\r\n]+/)),

        condition_text: $ => seq(
            $.condition_block,
            optional($.text)
        ),

        condition_block: $ => choice(
            $.multiline_sequence,
            $.multiline_switch,
            $.multiline_if,
            $.multiline_conditional,
        ),
        multiline_if: $ => seq(
            $.block_brace_start,
            field("condition", $.expression),
            /:/,
            $.line_end,
            optional(field("consequence", $.block_body)),
            optional(field("alternative", $.else_branch)),
            $.line_start,
            /\}/,
        ),
        multiline_conditional: $ => seq(
            $.block_brace_start,
            $.line_end,
            repeat1(field("branch", $.conditional_branch)),
            optional(field("alternative", $.else_branch)),
            $.line_start,
            /\}/,
        ),
        multiline_switch: $ => seq(
            $.block_brace_start,
            field("query", $.expression),
            /:/,
            $.line_end,
            repeat1(field("case", $.switch_case)),
            optional(field("alternative", $.else_branch)),
            $.line_start,
            /\}/,
        ),
        multiline_sequence: $ => seq(
            $.block_brace_start,
            field("annotation", $.multiline_sequence_annotation),
            /:/,
            $.line_end,
            repeat1(field("entry", $.sequence_entry)),
            $.line_start,
            /\}/,
        ),
        multiline_sequence_annotation: $ => choice(
            /stopping/,
            /cycle/,
            /once/,
            /shuffle/,
            seq(/shuffle/, /once/),
            seq(/shuffle/, /stopping/),
        ),
        conditional_branch: $ => seq(
            $.line_start,
            /-/,
            field("condition", $.expression),
            /:/,
            optional(field("content", $.block_line_content)),
            $.line_end,
            optional(field("body", $.block_body)),
        ),
        switch_case: $ => seq(
            $.line_start,
            /-/,
            field("value", $.expression),
            /:/,
            optional(field("content", $.block_line_content)),
            $.line_end,
            optional(field("body", $.block_body)),
        ),
        else_branch: $ => seq(
            $.line_start,
            /-/,
            /else/,
            /:/,
            optional(field("content", $.block_line_content)),
            $.line_end,
            optional(field("body", $.block_body)),
        ),
        sequence_entry: $ => seq(
            $.line_start,
            /-/,
            optional(field("content", $.block_line_content)),
            $.line_end,
            optional(field("body", $.block_body)),
        ),
        block_body: $ => repeat1($.block_statement),
        block_statement: $ => choice(
            $.nested_block_statement,
            $.block_statement_line,
            $.var_line,
            $.const_line,
            $.list_line,
            $.include_line,
            $.external_line,
            $.todo_line,
            $.empty_line,
        ),
        nested_block_statement: $ => seq(
            $.line_start,
            optional(/-/),
            $.condition_block,
            $.line_end,
        ),
        block_statement_line: $ => seq(
            $.line_start,
            optional($.block_line_content),
            $.line_end,
        ),
        block_line_content: $ => choice(
            $.option_text,
            $.code_text,
            $.dialog_text,
        ),

        inline_block: $ => choice(
            $.inline_conditional,
            $.inline_sequence,
            $.inline_expression,
        ),
        inline_expression: $ => prec(3, seq(
            $.inline_expression_start,
            field("value", $.expression),
            /\}/,
        )),
        inline_conditional: $ => prec(4, seq(
            $.inline_conditional_start,
            field("condition", $.expression),
            /:/,
            field("consequence", optional($.inline_content)),
            optional(seq(/\|/, field("alternative", optional($.inline_content)))),
            /\}/,
        )),
        inline_sequence: $ => prec(2, seq(
            $.inline_sequence_start,
            optional(field("annotation", $.sequence_annotation)),
            optional(field("alternative", $.sequence_content)),
            repeat1(seq(
                $.sequence_separator,
                optional(field("alternative", $.sequence_content)),
            )),
            /\}/,
        )),
        sequence_annotation: $ => choice(/&/, /!/, /~/, /\$/, /~!/, /!~/, /~\$/, /\$~/),
        sequence_separator: $ => /\|/,
        sequence_content: $ => repeat1(choice(
            $.escaped_character,
            $.glue,
            $.inline_block,
            $.divert_or_thread,
            $.inline_tag,
            $.vocabulary,
            $.inline_text_other,
        )),
        inline_content: $ => repeat1(choice(
            $.escaped_character,
            $.glue,
            $.inline_block,
            $.divert_or_thread,
            $.inline_tag,
            $.vocabulary,
            $.inline_text_other,
        )),
        inline_text_other: $ => prec.right(repeat1(/[^\s\\\n\r\p{N}\p{L}_\{\}\|#-]/)),

        identifier_path: $ => seq(
            $.identifier,
            optional(repeat1(seq(
                $.dot,
                $.identifier
            )))
        ),

        tag: $ => seq(
            /#/,
            repeat1(choice(
                $.escaped_character,
                $.inline_block,
                $.tag_text,
            )),
        ),
        tag_text: $ => /[^#\\\{\}\[\]\r\n]+/,
        inline_tag: $ => seq(
            /#/,
            repeat1(choice(
                $.escaped_character,
                $.inline_block,
                $.inline_tag_text,
            )),
        ),
        inline_tag_text: $ => /[^#\\\{\}\[\]\|\r\n]+/,

        expression: $ => choice(
            $.binary_expression,
            $.unary_expression,
            $.postfix_expression,
            $.call_expression,
            $.divert_target_value,
            $.list_value,
            $.parenthesized_expression,
            $.reference,
            $.boolean,
            $.string,
            $.float,
            $.number,
        ),
        binary_expression: $ => choice(
            ...[
                [PREC.LOGICAL, choice(/&&/, /\|\|/, $.and_operator, $.or_operator)],
                [PREC.COMPARISON, choice(/==/, /!=/, /<=/, />=/, /</, />/)],
                [PREC.CONTAINMENT, choice(/!\?/, /\?/, /\^/, $.has_operator, $.hasnt_operator)],
                [PREC.ADD, /\+/],
                [PREC.SUBTRACT, /-/],
                [PREC.MULTIPLY, /\*/],
                [PREC.DIVIDE, /\//],
                [PREC.MODULO, choice(/%/, $.mod_operator)],
            ].map(([precedence, operator]) => prec.left(precedence, seq(
                field("left", $.expression),
                field("operator", operator),
                field("right", $.expression),
            ))),
        ),
        unary_expression: $ => prec.right(PREC.UNARY, seq(
            field("operator", choice(/-/, /!/, $.not_operator)),
            field("argument", $.expression),
        )),
        postfix_expression: $ => prec.left(PREC.POSTFIX, seq(
            field("argument", $.reference),
            field("operator", $.mutation_operator),
        )),
        call_expression: $ => prec(PREC.CALL, seq(
            field("function", $.identifier),
            field("arguments", $.call_arguments),
        )),
        divert_target_value: $ => seq(
            $.arrow,
            field("target", choice($.end_destination, $.done_destination, $.identifier_path)),
        ),
        end_destination: $ => /END/,
        done_destination: $ => /DONE/,
        reference: $ => $.identifier_path,
        parenthesized_expression: $ => seq(
            /\(/,
            field("value", $.expression),
            /\)/,
        ),
        list_value: $ => seq(
            /\(/,
            optional(seq(
                field("item", $.identifier_path),
                repeat(seq(
                    /,/,
                    field("item", $.identifier_path),
                )),
            )),
            /\)/,
        ),
        boolean: $ => /(true|false)/,
        string: $ => seq(
            '"',
            repeat(choice(
                /[^"\\\n\r]+/,
                $.escaped_character,
            )),
            '"'
        ),

        escaped_character: $ => seq(
            /\\/,
            alias(token.immediate(/[^\r\n]/), $.escaped_value),
        ),

        ref: $ => /ref/,
        and_operator: $ => token(/and[ \t]+/),
        or_operator: $ => token(/or[ \t]+/),
        has_operator: $ => token(/has[ \t]+/),
        hasnt_operator: $ => token(/hasnt[ \t]+/),
        mod_operator: $ => token(/mod[ \t]+/),
        not_operator: $ => token(/not[ \t]+/),
        number: $ => /\d+/,
        float: $ => token(prec(1, /\d+\.\d*/)),
        assignment: $ => /=/,
        compound_assignment: $ => /(\+=|-=)/,
        mutation_operator: $ => /(\+\+|--)/,
        dot: $ => /\./,
        include_path: $ => /[^\r\n]+/,
        directive_remainder: $ => /[^\r\n]+/,
        block_remainder: $ => /[^\r\n\}\{]+/,
        vocabulary: $ => /[\p{N}\p{L}_-]+/,
        identifier: $ => token(new RegExp(`${ID_CHAR}*${ID_NON_DIGIT}${ID_CHAR}*`, "u")),
        // Single character catch-all in the form /[]+/ would be to
        // greedy, these are meant to catch punctionation. Therefore we use
        // prec.right(repeat1(/[]/)).
        other: $ => prec.right(repeat1(/[^\s\\\n\r\p{N}\p{L}_]/)),

    }
})
