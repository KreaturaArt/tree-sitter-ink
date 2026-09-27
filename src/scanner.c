#include "tree_sitter/parser.h"

/* Notes
- There is no need to lex single characters. Only multi-character symbols and
  position dependent symbols need to be lexed by the scanner.
- We never skip with lexer->advance(lexer, true); because it improves the
  readablity of debug output of "tree-sitter parse"
*/

/* Goals
- Add special symbols to avoid conflicting grammer (GLR)
- Try to keep all unicode "magic" in grammer.js
- Except of course whitespaces handling, since you can't build this scanner without
    - See is_unicode_whitespace()
*/

enum TokenType {
    ARROW,
    DOUBLE_ARROW,
    BACK_ARROW,
    LINE_COMMENT,
    GLUE,
    INLINE_EXPRESSION_START,
    INLINE_CONDITIONAL_START,
    INLINE_SEQUENCE_START,
    BLOCK_BRACE_START,
    CHOICE_LABEL_CONTINUATION,
    CHOICE_CONDITION_CONTINUATION,
    LINE_START,
    STITCH_START,
    KNOT_START,
    FUNCTION_START,
    VAR_START,
    CONST_START,
    LIST_START,
    INCLUDE_START,
    EXTERNAL_START,
    TODO_START,
    EMPTY_LINE,
    LINE_END,
};

static const char *KW_FUNCTION = "function";
static const char *KW_VAR = "VAR";
static const char *KW_CONST = "CONST";
static const char *KW_LIST = "LIST";
static const char *KW_INCLUDE = "INCLUDE";
static const char *KW_EXTERNAL = "EXTERNAL";
static const char *KW_TODO = "TODO";
static bool is_inline_whitespace(int32_t wc) {
    return wc == ' ' || wc == '\t';
}

static bool lex_keyword(TSLexer *lexer, const char *keyword) {
    for (int i = 0; keyword[i] != '\0'; i++) {
        if (lexer->lookahead != keyword[i]) {
            return false;
        }
        lexer->advance(lexer, false);
    }
    return true;
}

static void skip_function_spacing(TSLexer *lexer) {
    while (lexer->lookahead == '=' || is_inline_whitespace(lexer->lookahead)) {
        lexer->advance(lexer, false);
    }
}

static void skip_whitespace(TSLexer *lexer) {
    while (is_inline_whitespace(lexer->lookahead)) {
        lexer->advance(lexer, false);
    }
}

static bool skip_newline(TSLexer *lexer) {
    if (lexer->lookahead == '\n') {
        lexer->advance(lexer, false);
        return true;
    }
    if (lexer->lookahead == '\r') {
        lexer->advance(lexer, false);
        if (lexer->lookahead == '\n') {
            lexer->advance(lexer, false);
            return true;
        }
    }
    return false;
}

static bool check_keyword(
    TSLexer *lexer,
    const bool *valid_symbols,
    const enum TokenType token,
    const char* keyword
) {
    if (lexer->lookahead == keyword[0] && valid_symbols[token]) {
        if (lex_keyword(lexer, keyword)) {
            if (is_inline_whitespace(lexer->lookahead)) {
                lexer->mark_end(lexer);
                lexer->result_symbol = token;
                return true;
            }
        }
    }
    return false;
}

static bool check_start_tokens(TSLexer *lexer, const bool *valid_symbols) {
    if (
        lexer->get_column(lexer) == 0 && !lexer->eof(lexer) &&
        (
            valid_symbols[LINE_START] ||
            valid_symbols[STITCH_START] ||
            valid_symbols[KNOT_START] ||
            valid_symbols[FUNCTION_START] ||
            valid_symbols[VAR_START] ||
            valid_symbols[CONST_START] ||
            valid_symbols[LIST_START] ||
            valid_symbols[INCLUDE_START] ||
            valid_symbols[EXTERNAL_START] ||
            valid_symbols[TODO_START] ||
            valid_symbols[EMPTY_LINE]
        )
    ) {
        lexer->result_symbol = LINE_START;
        skip_whitespace(lexer);
        lexer->mark_end(lexer);
        if (
            valid_symbols[EMPTY_LINE] &&
            (lexer->lookahead == '\n' || lexer->lookahead == '\r' || lexer->eof(lexer))
        ) {
            lexer->result_symbol = EMPTY_LINE;
            if (!lexer->eof(lexer) && !skip_newline(lexer)) return false;
            lexer->mark_end(lexer);
            return true;
        }
        if (
            lexer->lookahead == '=' &&
            (
                valid_symbols[KNOT_START] ||
                valid_symbols[STITCH_START]
            )
        ) {
            lexer->result_symbol = STITCH_START;
            lexer->advance(lexer, false);
            lexer->mark_end(lexer);
            if (lexer->lookahead == '=' && valid_symbols[KNOT_START]) {
                lexer->advance(lexer, false);
                lexer->mark_end(lexer);
                lexer->result_symbol = KNOT_START;
                skip_function_spacing(lexer);
                if (lexer->lookahead == 'f' && valid_symbols[FUNCTION_START]) {
                    if (lex_keyword(lexer, KW_FUNCTION)) {
                        lexer->mark_end(lexer);
                        if (
                            lexer->lookahead == '(' ||
                            is_inline_whitespace(lexer->lookahead)
                        ) {
                            lexer->result_symbol = FUNCTION_START;
                        }
                    }
                }
            }
            return true;
        }
        if (check_keyword(lexer, valid_symbols, VAR_START, KW_VAR)) {
            return true;
        }
        if (check_keyword(lexer, valid_symbols, CONST_START, KW_CONST)) {
            return true;
        }
        if (check_keyword(lexer, valid_symbols, LIST_START, KW_LIST)) {
            return true;
        }
        if (check_keyword(lexer, valid_symbols, INCLUDE_START, KW_INCLUDE)) {
            return true;
        }
        if (check_keyword(lexer, valid_symbols, EXTERNAL_START, KW_EXTERNAL)) {
            return true;
        }
        if (lexer->lookahead == 'T' && valid_symbols[TODO_START]) {
            if (lex_keyword(lexer, KW_TODO)) {
                if (lexer->lookahead == ':' || is_inline_whitespace(lexer->lookahead)) {
                    lexer->mark_end(lexer);
                    lexer->result_symbol = TODO_START;
                    return true;
                }
            }
        }
        if (valid_symbols[LINE_START]) {
            return true;
        } else {
            lexer->result_symbol = 0;
        }
    }
    return false;
}

static bool check_line_end(TSLexer *lexer, const bool *valid_symbols) {
    if (
        (
            valid_symbols[LINE_END] ||
            valid_symbols[CHOICE_LABEL_CONTINUATION] ||
            valid_symbols[CHOICE_CONDITION_CONTINUATION]
        ) &&
        (
            lexer->lookahead == '\n' ||
            lexer->lookahead == '\r' ||
            lexer->eof(lexer)
        )
    ) {
        lexer->result_symbol = LINE_END;
        if (lexer->eof(lexer)) return valid_symbols[LINE_END];
        if (!skip_newline(lexer)) return false;
        lexer->mark_end(lexer);

        if (
            valid_symbols[CHOICE_LABEL_CONTINUATION] ||
            valid_symbols[CHOICE_CONDITION_CONTINUATION]
        ) {
            skip_whitespace(lexer);
            if (lexer->lookahead == '{' || lexer->lookahead == '[') {
                lexer->mark_end(lexer);
                lexer->result_symbol = valid_symbols[CHOICE_CONDITION_CONTINUATION]
                    ? CHOICE_CONDITION_CONTINUATION
                    : CHOICE_LABEL_CONTINUATION;
                return true;
            }
        }

        if (!valid_symbols[LINE_END]) return false;
        return true;
    }
    return false;
}

static bool check_arrows(TSLexer *lexer, const bool *valid_symbols) {
    if (
        (
            valid_symbols[ARROW] ||
            valid_symbols[DOUBLE_ARROW]
        )
        && lexer->lookahead == '-'
    ) {
        lexer->advance(lexer, false);
        if (lexer->lookahead == '>') {
            lexer->advance(lexer, false);
            lexer->mark_end(lexer);
            if (valid_symbols[DOUBLE_ARROW] && lexer->lookahead == '-') {
                lexer->advance(lexer, false);
                if (lexer->lookahead == '>') {
                    lexer->advance(lexer, false);
                    lexer->mark_end(lexer);
                    lexer->result_symbol = DOUBLE_ARROW;
                    return true;
                }
            }
            lexer->result_symbol = ARROW;
            return true;
        }
    }
    return false;
}

static bool check_comment_start(TSLexer *lexer, const bool *valid_symbols) {
    if (
        valid_symbols[LINE_COMMENT]
        && lexer->lookahead == '/'
    ) {
        lexer->advance(lexer, false);
        if (lexer->lookahead == '/') {
            lexer->advance(lexer, false);
            lexer->result_symbol = LINE_COMMENT;
            while (
                lexer->lookahead != '\n' &&
                lexer->lookahead != '\r' &&
                !lexer->eof(lexer)
            ) {
                lexer->advance(lexer, false);
            }
            return true;
        }
    }
    return false;
}

static bool check_glue_back_arrow(TSLexer *lexer, const bool *valid_symbols) {
    if (
        (
            valid_symbols[BACK_ARROW] ||
            valid_symbols[GLUE]
        )
        && lexer->lookahead == '<'
    ) {
        lexer->advance(lexer, false);
        if (lexer->lookahead == '-') {
            lexer->advance(lexer, false);
            lexer->result_symbol = BACK_ARROW;
            return true;
        } else if (lexer->lookahead == '>') {
            lexer->advance(lexer, false);
            lexer->result_symbol = GLUE;
            return true;
        }
    }
    return false;
}

static bool check_brace_start(TSLexer *lexer, const bool *valid_symbols) {
    if (
        lexer->lookahead != '{' ||
        (
            !valid_symbols[INLINE_EXPRESSION_START] &&
            !valid_symbols[INLINE_CONDITIONAL_START] &&
            !valid_symbols[INLINE_SEQUENCE_START] &&
            !valid_symbols[BLOCK_BRACE_START]
        )
    ) {
        return false;
    }

    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    unsigned depth = 1;
    bool has_colon = false;
    bool has_pipe = false;
    bool in_string = false;
    bool in_comment = false;
    bool after_star = false;

    while (!lexer->eof(lexer) && lexer->lookahead != '\n' && lexer->lookahead != '\r') {
        int32_t current = lexer->lookahead;
        if (in_comment) {
            if (after_star && current == '/') in_comment = false;
            after_star = current == '*';
            lexer->advance(lexer, false);
            continue;
        }
        if (current == '\\') {
            lexer->advance(lexer, false);
            if (!lexer->eof(lexer) && lexer->lookahead != '\n' && lexer->lookahead != '\r') {
                lexer->advance(lexer, false);
            }
            continue;
        }
        if (current == '"') {
            in_string = !in_string;
            lexer->advance(lexer, false);
            continue;
        }
        if (in_string) {
            lexer->advance(lexer, false);
            continue;
        }
        if (current == '/') {
            lexer->advance(lexer, false);
            if (lexer->lookahead == '*') {
                in_comment = true;
                after_star = false;
                lexer->advance(lexer, false);
            }
            continue;
        }
        if (current == '{') depth++;
        if (depth == 1 && current == ':') has_colon = true;
        if (depth == 1 && current == '|') {
            lexer->advance(lexer, false);
            if (lexer->lookahead == '|') {
                lexer->advance(lexer, false);
            } else {
                has_pipe = true;
            }
            continue;
        }
        if (current == '}' && --depth == 0) {
            if (has_colon && valid_symbols[INLINE_CONDITIONAL_START]) {
                lexer->result_symbol = INLINE_CONDITIONAL_START;
                return true;
            }
            if (has_pipe && valid_symbols[INLINE_SEQUENCE_START]) {
                lexer->result_symbol = INLINE_SEQUENCE_START;
                return true;
            }
            if (valid_symbols[INLINE_EXPRESSION_START]) {
                lexer->result_symbol = INLINE_EXPRESSION_START;
                return true;
            }
            return false;
        }
        lexer->advance(lexer, false);
    }

    if (!valid_symbols[BLOCK_BRACE_START]) return false;
    lexer->result_symbol = BLOCK_BRACE_START;
    return true;
}

static bool scan(TSLexer *lexer, const bool *valid_symbols) {
    // Position dependant lexes (whitespaces may not be consumed)
    if (check_start_tokens(lexer, valid_symbols)) return true;

    // Position independant lexes (whitespaces must be consumed)
    skip_whitespace(lexer);
    if (check_glue_back_arrow(lexer, valid_symbols)) return true;
    if (check_brace_start(lexer, valid_symbols)) return true;
    if (check_line_end(lexer, valid_symbols)) return true;
    if (check_arrows(lexer, valid_symbols)) return true;
    if (check_comment_start(lexer, valid_symbols)) return true;
    return false;
}

bool tree_sitter_ink_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    (void)payload;
    return scan(lexer, valid_symbols);
}

void *tree_sitter_ink_external_scanner_create() {
    return NULL;
}

void tree_sitter_ink_external_scanner_destroy(void *payload) {
    (void)payload;
}

unsigned tree_sitter_ink_external_scanner_serialize(void *payload, char *buffer) {
    (void)payload;
    (void)buffer;
    return 0;
}

void tree_sitter_ink_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
    (void)payload;
    (void)buffer;
    (void)length;
}
