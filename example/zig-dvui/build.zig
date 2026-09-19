const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const dvui_dep = b.dependency("dvui", .{
        .target = target,
        .optimize = optimize,
        .backend = .sdl3,
        .@"tree-sitter" = true,
    });

    const app = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    app.addImport("dvui", dvui_dep.module("dvui_sdl3"));
    app.addAnonymousImport("ink-highlights", .{
        .root_source_file = b.path("../../queries/highlights.scm"),
    });
    addInkParser(b, app);

    const exe = b.addExecutable(.{
        .name = "ink-editor",
        .root_module = app,
    });
    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| run_cmd.addArgs(args);
    b.step("run", "Run the Ink editor").dependOn(&run_cmd.step);

    const tests = b.addTest(.{ .root_module = app });
    b.step("test", "Run tests").dependOn(&b.addRunArtifact(tests).step);
}

fn addInkParser(b: *std.Build, module: *std.Build.Module) void {
    const grammar_root = b.path("../..");
    module.addIncludePath(grammar_root.path(b, "src"));
    module.addCSourceFiles(.{
        .root = grammar_root,
        .files = &.{ "src/parser.c", "src/scanner.c" },
        .flags = &.{ "-std=c11", "-Wno-missing-field-initializers" },
    });
}
