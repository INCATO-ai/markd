import { describe, it, expect } from "vitest";
import { findMatches } from "./search-and-replace";
import { createTestDoc } from "@/test/editor-helpers";

describe("findMatches", () => {
  const doc = createTestDoc([
    { type: "heading", text: "Hello World", level: 1 },
    { type: "paragraph", text: "foo bar baz foo" },
    { type: "paragraph", text: "hello again" },
  ]);

  it("finds literal matches case-insensitive", () => {
    const { results } = findMatches(doc, {
      searchTerm: "foo",
      caseSensitive: false,
      useRegex: false,
      wholeWord: false,
    });
    expect(results).toHaveLength(2);
  });

  it("finds literal matches case-sensitive", () => {
    const { results } = findMatches(doc, {
      searchTerm: "Hello",
      caseSensitive: true,
      useRegex: false,
      wholeWord: false,
    });
    expect(results).toHaveLength(1);
  });

  it("finds case-insensitive matches across blocks", () => {
    const { results } = findMatches(doc, {
      searchTerm: "hello",
      caseSensitive: false,
      useRegex: false,
      wholeWord: false,
    });
    expect(results).toHaveLength(2);
  });

  it("returns empty for empty search term", () => {
    const { results } = findMatches(doc, {
      searchTerm: "",
      caseSensitive: false,
      useRegex: false,
      wholeWord: false,
    });
    expect(results).toHaveLength(0);
  });

  it("supports regex alternation", () => {
    const { results } = findMatches(doc, {
      searchTerm: "foo|bar",
      caseSensitive: false,
      useRegex: true,
      wholeWord: false,
    });
    expect(results).toHaveLength(3);
  });

  it("returns error for invalid regex", () => {
    const { results, error } = findMatches(doc, {
      searchTerm: "[unclosed",
      caseSensitive: false,
      useRegex: true,
      wholeWord: false,
    });
    expect(results).toHaveLength(0);
    expect(error).toBeTruthy();
  });

  it("handles regex with empty match gracefully", () => {
    const { results } = findMatches(doc, {
      searchTerm: "(?:)",
      caseSensitive: false,
      useRegex: true,
      wholeWord: false,
    });
    expect(results).toHaveLength(0);
  });

  it("supports whole word matching", () => {
    const { results } = findMatches(doc, {
      searchTerm: "bar",
      caseSensitive: false,
      useRegex: false,
      wholeWord: true,
    });
    expect(results).toHaveLength(1);
  });

  it("whole word does not match partial words", () => {
    const doc2 = createTestDoc([
      { type: "paragraph", text: "foobar foo bar" },
    ]);
    const { results } = findMatches(doc2, {
      searchTerm: "foo",
      caseSensitive: false,
      useRegex: false,
      wholeWord: true,
    });
    expect(results).toHaveLength(1);
  });

  it("returns correct positions spanning doc structure", () => {
    const { results } = findMatches(doc, {
      searchTerm: "baz",
      caseSensitive: false,
      useRegex: false,
      wholeWord: false,
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.from).toBeGreaterThan(0);
    expect(results[0]!.to).toBeGreaterThan(results[0]!.from);
  });
});
