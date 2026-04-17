import { describe, it, expect } from "vitest";
import { getExtensions } from "./editor-extensions";

describe("getExtensions", () => {
  it("returns an array of TipTap extensions", () => {
    const extensions = getExtensions({ getFileDir: () => "" });
    expect(Array.isArray(extensions)).toBe(true);
    expect(extensions.length).toBeGreaterThan(0);
  });

  it("includes CodeBlockLowlight instead of default codeBlock", () => {
    const extensions = getExtensions({ getFileDir: () => "" });
    const names = extensions.map((ext) => ext.name);
    expect(names).toContain("codeBlock");
    // StarterKit's codeBlock is disabled, CodeBlockLowlight provides it
  });

  it("includes table extensions", () => {
    const extensions = getExtensions({ getFileDir: () => "" });
    const names = extensions.map((ext) => ext.name);
    expect(names).toContain("table");
    expect(names).toContain("tableRow");
    expect(names).toContain("tableCell");
    expect(names).toContain("tableHeader");
  });

  it("includes task list extensions", () => {
    const extensions = getExtensions({ getFileDir: () => "" });
    const names = extensions.map((ext) => ext.name);
    expect(names).toContain("taskList");
    expect(names).toContain("taskItem");
  });

  it("includes placeholder extension", () => {
    const extensions = getExtensions({ getFileDir: () => "" });
    const names = extensions.map((ext) => ext.name);
    expect(names).toContain("placeholder");
  });
});
