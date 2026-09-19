//! This crate provides Ink language support for the [tree-sitter][] parsing library.
//!
//! Typically, you will use the [LANGUAGE][] constant to add this language to a
//! tree-sitter [Parser][], and then use the parser to parse some code:
//!
//! ```
//! let code = r#"
//! "#;
//! let mut parser = tree_sitter::Parser::new();
//! let language = tree_sitter_ink::LANGUAGE;
//! parser
//!     .set_language(&language.into())
//!     .expect("Error loading Ink parser");
//! let tree = parser.parse(code, None).unwrap();
//! assert!(!tree.root_node().has_error());
//! ```
//!
//! [Parser]: https://docs.rs/tree-sitter/*/tree_sitter/struct.Parser.html
//! [tree-sitter]: https://tree-sitter.github.io/

use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_ink() -> *const ();
}

/// The tree-sitter [`LanguageFn`][LanguageFn] for this grammar.
///
/// [LanguageFn]: https://docs.rs/tree-sitter-language/*/tree_sitter_language/struct.LanguageFn.html
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_ink) };

/// The content of the [`node-types.json`][] file for this grammar.
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers#static-node-types
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");

// NOTE: uncomment these to include any queries that this grammar contains:

// pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");
// pub const INJECTIONS_QUERY: &str = include_str!("../../queries/injections.scm");
// pub const LOCALS_QUERY: &str = include_str!("../../queries/locals.scm");
// pub const TAGS_QUERY: &str = include_str!("../../queries/tags.scm");

#[cfg(test)]
mod tests {
    #[test]
    fn test_can_load_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");
    }

    #[test]
    fn test_line_comment_at_end_of_file() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let tree = parser.parse("text // comment", None).unwrap();
        let root = tree.root_node();

        assert!(!root.has_error());
        assert!(root.to_sexp().contains("(line_comment)"));
    }

    #[test]
    fn test_line_comment_boundaries() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        for source in ["//", "// comment\ntext", "// comment\r\ntext"] {
            let tree = parser.parse(source, None).unwrap();
            assert!(!tree.root_node().has_error(), "accepted boundary: {source:?}");
            assert!(tree.root_node().to_sexp().contains("(line_comment)"));
        }
    }

    #[test]
    fn test_incremental_newline_edits() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let source = "first\nsecond";
        let mut tree = parser.parse(source, None).unwrap();
        tree.edit(&tree_sitter::InputEdit {
            start_byte: 6,
            old_end_byte: 6,
            new_end_byte: 7,
            start_position: tree_sitter::Point::new(1, 0),
            old_end_position: tree_sitter::Point::new(1, 0),
            new_end_position: tree_sitter::Point::new(2, 0),
        });

        let edited = "first\n\nsecond";
        let reparsed = parser.parse(edited, Some(&tree)).unwrap();
        let sexp = reparsed.root_node().to_sexp();

        assert!(!reparsed.root_node().has_error(), "{sexp}");
        assert_eq!(sexp.matches("(empty_line)").count(), 1);
    }

    #[test]
    fn test_block_comments_are_not_nested() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let tree = parser.parse("text /* outer /* inner */ remainder", None).unwrap();
        let sexp = tree.root_node().to_sexp();

        assert!(!tree.root_node().has_error(), "{sexp}");
        assert_eq!(sexp.matches("(block_comment)").count(), 1);
        assert!(sexp.contains("(vocabulary)"));
    }

    #[test]
    fn test_identifier_ranges_and_numeric_rejection() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let valid = [
            "=== 2tests ===",
            "=== café ===",
            "=== Ελληνικά ===",
            "=== Кириллица ===",
            "=== Հայերեն ===",
            "=== עברית ===",
            "=== العربية ===",
            "=== ひらがな ===",
            "=== カタカナ ===",
            "=== 漢字 ===",
            "=== 한글 ===",
        ];
        for source in valid {
            let tree = parser.parse(source, None).unwrap();
            assert!(!tree.root_node().has_error(), "rejected {source:?}");
        }

        for source in ["=== 123 ===", "=== cafe\u{301} ==="] {
            let tree = parser.parse(source, None).unwrap();
            assert!(tree.root_node().has_error(), "accepted {source:?}");
        }
    }

    #[test]
    fn test_escaped_structural_characters() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let source = concat!(
            "Literal \\# \\{ \\[ \\\\ \\n.\n",
            "+\\ {&one|two}\n",
            "# tag with \\# hash",
        );
        let tree = parser.parse(source, None).unwrap();
        let root = tree.root_node();
        let sexp = root.to_sexp();

        assert!(!root.has_error(), "{sexp}");
        assert_eq!(sexp.matches("(escaped_character").count(), 7);
        assert_eq!(sexp.matches("(tag ").count(), 1);
    }

    #[test]
    fn test_unpaired_function_parentheses_are_errors() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        for source in ["=== function open(", "=== function close) ==="] {
            let tree = parser.parse(source, None).unwrap();
            assert!(tree.root_node().has_error(), "accepted {source:?}");
        }
    }

    #[test]
    fn test_unpaired_list_item_parentheses_are_errors() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        for source in ["LIST values = (open", "LIST values = close)"] {
            let tree = parser.parse(source, None).unwrap();
            assert!(tree.root_node().has_error(), "accepted {source:?}");
        }
    }

    #[test]
    fn test_source_directives() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let source = concat!(
            "INCLUDE chapters/first scene.ink\n",
            "EXTERNAL playSound(name)\n",
            "EXTERNAL currentScore()\n",
            "TODO: Rewrite this scene\n",
            "INCLUDED is ordinary text\n",
            "EXTERNALITY is ordinary text\n",
            "TODOLIST is ordinary text",
        );
        let tree = parser.parse(source, None).unwrap();
        let root = tree.root_node();
        let sexp = root.to_sexp();

        assert!(!root.has_error(), "{sexp}");
        assert_eq!(sexp.matches("(include_line").count(), 1);
        assert_eq!(sexp.matches("(external_line").count(), 2);
        assert_eq!(sexp.matches("(todo_line").count(), 1);
        assert_eq!(sexp.matches("(dialog_text").count(), 3);

        let deprecated = parser.parse("~ include old.ink", None).unwrap();
        assert!(deprecated.root_node().has_error());
    }

    #[test]
    fn test_flow_parameters_and_call_arguments() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let source = concat!(
            "=== sleep(-> waking, ref fatigue, ref -> fallback) ===\n",
            "= response(mood)\n",
            "-> sleep(-> wake_in_hut, fatigue, true, 2, \"north\")\n",
            "<- shared_choices(room, -> return_here)",
        );
        let tree = parser.parse(source, None).unwrap();
        let root = tree.root_node();
        let sexp = root.to_sexp();

        assert!(!root.has_error(), "{sexp}");
        assert_eq!(sexp.matches("(parameter_list").count(), 2);
        assert_eq!(sexp.matches("(parameter ").count(), 4);
        assert_eq!(sexp.matches("(call_arguments").count(), 2);
        assert_eq!(sexp.matches("(call_argument ").count(), 7);
    }

    #[test]
    fn test_expressions_and_logic_statements() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let source = concat!(
            "VAR integer = 12\n",
            "VAR decimal = 12.5\n",
            "VAR target = -> knot.stitch\n",
            "VAR empty = ()\n",
            "VAR one = (Colours.red)\n",
            "VAR result = helper(1, other(), -> destination,)\n",
            "~ x = a + b - c\n",
            "~ x += 3\n",
            "~ x--\n",
            "~ temp roll = RANDOM(1, 6)\n",
            "~ return not ready or count >= 2\n",
            "~ helper()",
        );
        let tree = parser.parse(source, None).unwrap();
        let root = tree.root_node();
        let sexp = root.to_sexp();

        assert!(!root.has_error(), "{sexp}");
        assert!(sexp.contains("(float)"));
        assert!(sexp.contains("(divert_target_value"));
        assert!(sexp.contains("(list_value"));
        assert!(sexp.contains("(binary_expression"));
        assert!(sexp.contains("(unary_expression"));
        assert!(sexp.contains("(temporary_declaration"));
        assert!(sexp.contains("(mutation_statement"));
        assert!(sexp.contains("(call_statement"));
    }

    #[test]
    fn test_tunnel_return_overrides() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        for source in ["->->", "->-> destination", "->-> destination(1,)"] {
            let tree = parser.parse(source, None).unwrap();
            assert!(!tree.root_node().has_error(), "rejected {source:?}");
            assert!(tree.root_node().to_sexp().contains("(divert_return"));
        }
    }

    #[test]
    fn test_special_divert_destinations() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let tree = parser.parse("-> END\n-> DONE", None).unwrap();
        let root = tree.root_node();
        let sexp = root.to_sexp();

        assert!(!root.has_error(), "{sexp}");
        assert!(sexp.contains("(end_destination)"));
        assert!(sexp.contains("(done_destination)"));
    }

    #[test]
    fn test_complete_list_syntax() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let source = concat!(
            "LIST Plain = one, two, three\n",
            "LIST Valued = one = 10, two = -20\n",
            "LIST Active = (one), two\n",
            "LIST ActiveInside = (one = 10), two\n",
            "LIST ActiveOutside = (one) = 10, two\n",
            "VAR multi = (Plain.one, Active.two)\n",
            "~ multi += Plain.three\n",
            "~ temp range = LIST_RANGE(multi, 1, 3)",
        );
        let tree = parser.parse(source, None).unwrap();
        let root = tree.root_node();
        let sexp = root.to_sexp();

        assert!(!root.has_error(), "{sexp}");
        assert_eq!(sexp.matches("(list_definition_item").count(), 11);
        assert!(sexp.contains("(signed_integer"));
        assert!(sexp.contains("(list_value"));
        assert!(sexp.contains("(call_expression"));

        for invalid in ["LIST Bad = one,", "VAR Bad = (one,)"] {
            let tree = parser.parse(invalid, None).unwrap();
            assert!(tree.root_node().has_error(), "accepted {invalid:?}");
        }
    }

    #[test]
    fn test_choice_structure_and_partitions() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let source = concat!(
            "* (leave) {door_open} Hello #shared [Leave #choice] goodbye #output -> outside\n",
            "+ + sticky\n",
            "* [] output only\n",
            "* ->",
        );
        let tree = parser.parse(source, None).unwrap();
        let root = tree.root_node();
        let sexp = root.to_sexp();

        assert!(!root.has_error(), "{sexp}");
        assert!(sexp.contains("(once_choice_marker"));
        assert!(sexp.contains("(sticky_choice_marker"));
        assert!(sexp.contains("(choice_condition"));
        assert_eq!(sexp.matches("(choice_text").count(), 3);
        assert_eq!(sexp.matches("(tag ").count(), 3);

        let mixed = parser.parse("* + mixed", None).unwrap();
        assert!(mixed.root_node().has_error());
    }

    #[test]
    fn test_repeated_tags_with_freeform_text() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let source = concat!(
            "A line. # colour: bright blue # voiced/dialogue:01.ogg\n",
            "# standalone tag # second: tag: value",
        );
        let tree = parser.parse(source, None).unwrap();
        let root = tree.root_node();
        let sexp = root.to_sexp();

        assert!(!root.has_error(), "{sexp}");
        assert_eq!(sexp.matches("(tag ").count(), 4);
        assert_eq!(sexp.matches("(tag_text)").count(), 4);
    }

    #[test]
    fn test_structured_inline_logic() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Ink parser");

        let source = concat!(
            "Hello {name}.\n",
            "{seen:yes|no}\n",
            "{one|two|}\n",
            "{~!red|green}\n",
            "# image: {name}.png\n",
            "VAR dynamic = \"{~red|blue}\"",
        );
        let tree = parser.parse(source, None).unwrap();
        let root = tree.root_node();
        let sexp = root.to_sexp();

        assert!(!root.has_error(), "{sexp}");
        assert!(sexp.contains("(inline_expression"));
        assert!(sexp.contains("(inline_conditional"));
        assert_eq!(sexp.matches("(inline_sequence").count(), 4);
        assert!(sexp.contains("(sequence_annotation"));
        assert_eq!(sexp.matches("(sequence_separator").count(), 3);
    }
}
