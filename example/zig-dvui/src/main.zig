const std = @import("std");
const dvui = @import("dvui");

const max_file_size = 64 * 1024 * 1024;

pub const dvui_app: dvui.App = .{
    .config = .{ .options = .{
        .size = .{ .w = 900, .h = 650 },
        .min_size = .{ .w = 400, .h = 300 },
        .title = "Ink syntax highlighting",
    } },
    .initFn = appInit,
    .deinitFn = appDeinit,
    .frameFn = appFrame,
};

pub const main = dvui.App.main;
pub const panic = dvui.App.panic;
pub const std_options: std.Options = .{ .logFn = dvui.App.logFn };

var source: []u8 = &.{};

fn appInit(_: *dvui.Window) !void {
    const init = dvui.App.main_init.?;
    const args = try init.minimal.args.toSlice(init.arena.allocator());
    if (args.len > 2) {
        std.log.err("usage: {s} [ink-file]", .{args[0]});
        return error.InvalidArguments;
    }

    source = if (args.len == 2)
        try std.Io.Dir.cwd().readFileAlloc(init.io, args[1], init.gpa, .limited(max_file_size))
    else
        try init.gpa.dupe(u8, sample_source);
}

fn appDeinit() void {
    if (dvui.App.main_init) |init| init.gpa.free(source);
}

fn appFrame() !dvui.App.Result {
    const init = dvui.App.main_init.?;
    var editor: dvui.TextEntryWidget = undefined;
    editor.init(@src(), .{
        .placeholder = "Write Ink here...",
        .multiline = true,
        .cache_layout = false,
        .scroll_horizontal = true,
        .text = .{ .buffer_dynamic = .{
            .allocator = init.gpa,
            .backing = &source,
            .limit = max_file_size,
        } },
        .tree_sitter = .{
            .language = tree_sitter_ink(),
            .queries = highlight_query,
            .highlights = &highlights,
        },
    }, .{
        .expand = .both,
        .font = .theme(.mono),
        .margin = .all(12),
    });
    defer editor.deinit();

    editor.processEvents();
    editor.draw();
    return .ok;
}

extern fn tree_sitter_ink() callconv(.c) *dvui.c.TSLanguage;

const highlight_query = @embedFile("ink-highlights");

const highlights = [_]dvui.TextEntryWidget.SyntaxHighlight{
    highlight("label", .{ .r = 0x7e, .g = 0xc7, .b = 0xc7 }),
    highlight("keyword", .{ .r = 0xc6, .g = 0x78, .b = 0xdd }),
    highlight("keyword.directive", .{ .r = 0xc6, .g = 0x78, .b = 0xdd }),
    highlight("attribute", .{ .r = 0xc6, .g = 0x78, .b = 0xdd }),
    highlight("operator", .{ .r = 0x89, .g = 0xdd, .b = 0xff }),
    highlight("special", .{ .r = 0x89, .g = 0xdd, .b = 0xff }),
    highlight("type", .{ .r = 0xe5, .g = 0xc0, .b = 0x7b }),
    highlight("type.builtin", .{ .r = 0xe5, .g = 0xc0, .b = 0x7b }),
    highlight("constant", .{ .r = 0xd1, .g = 0x9a, .b = 0x66 }),
    highlight("constant.numeric", .{ .r = 0xd1, .g = 0x9a, .b = 0x66 }),
    highlight("function", .{ .r = 0x61, .g = 0xaf, .b = 0xef }),
    highlight("string", .{ .r = 0x98, .g = 0xc3, .b = 0x79 }),
    highlight("comment", .{ .r = 0x7f, .g = 0x84, .b = 0x8e }),
};

fn highlight(name: []const u8, color: dvui.Color) dvui.TextEntryWidget.SyntaxHighlight {
    return .{ .name = name, .opts = .{ .color_text = color } };
}

const sample_source =
    \\VAR visits = 0
    \\CONST max_visits = 3
    \\
    \\=== start ===
    \\Hello, world! # greeting
    \\* [Look around]
    \\    ~ visits = visits + 1
    \\    You have visited {visits} times.
    \\    -> start
    \\* [Leave]
    \\    -> END
;

test "highlight query compiles" {
    var error_offset: u32 = undefined;
    var error_type: dvui.c.TSQueryError = undefined;
    const query = dvui.c.ts_query_new(
        tree_sitter_ink(),
        highlight_query.ptr,
        @intCast(highlight_query.len),
        &error_offset,
        &error_type,
    ) orelse {
        std.debug.print("query error {d} at byte {d}\n", .{ error_type, error_offset });
        return error.InvalidTreeSitterQuery;
    };
    defer dvui.c.ts_query_delete(query);
}
