# tree-sitter-ink

tree-sitter grammar for [ink by inkle](https://github.com/inkle/ink) with full
unicode support.

<img src="assets/demo.png" alt="Ink Demo" width="326">

## State

The grammar targets ink 1.2.1. It structurally parses flow declarations,
directives, choices, navigation, declarations, lists, expressions, logic
statements, runtime strings with inline ink, and inline and multiline
conditionals and sequences. Incomplete input remains recoverable.

Validation that depends on symbol resolution or runtime types is intentionally
left to semantic tooling. This includes reserved-name errors, declaration
initializer restrictions, built-in arity, function-body restrictions, and list
origin/type checks.

Run the corpus and Node binding checks with:

```shell
npm test
```

Run Rust binding and parser regressions with:

```shell
cargo test
```

Run the corpus and all language binding checks using the tool versions in
`mise.toml` with:

```shell
mise run ci
```

Run the Zig DVUI sample with its built-in Ink text or supply a file (paths are
relative to `example/zig-dvui`):

```shell
mise run run-zig-dvui
mise run run-zig-dvui ../../assets/demo.ink
```

From `example/zig-dvui`, the equivalent command is
`zig build run -- ../../assets/demo.ink`.

## Install for helix

Edit `hx ~/.config/helix/languages.toml` and replace `$long_revision`.

```toml
[[language]]
name = "ink"
scope = "source.ink"
injection-regex = "ink"
file-types = ["ink"]
comment-token = "//"
block-comment-tokens = { start = "/*", end = "*/"}
indent = { tab-width = 4, unit = "\t" }
soft-wrap = { enable = true }
grammar = "ink"

[[grammar]]
name = "ink"
source = { git = "https://github.com/rhizoome/tree-sitter-ink", rev = "$long_revision" }
```

Copy the `highlights.scm` from this repo and install latest grammars.

```shell
mkdir -p ~/.config/helix/runtime/queries/ink
cp queries/highlights.scm ~/.config/helix/runtime/queries/ink/
hx --grammar fetch && hx --grammar build
hx assets/demo.ink
```

## License

I use standard rust style APACHE/MIT dual licensing.
