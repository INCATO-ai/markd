import { describe, it, expect } from "vitest";
import { getSectionEnd, type HeadingEntry } from "./section-commands";
import { createTestDoc } from "@/test/editor-helpers";

describe("getSectionEnd", () => {
  const doc = createTestDoc([
    { type: "heading", text: "Intro", level: 1 },
    { type: "paragraph", text: "content" },
    { type: "heading", text: "Getting Started", level: 2 },
    { type: "paragraph", text: "content" },
    { type: "heading", text: "Install", level: 2 },
    { type: "paragraph", text: "content" },
    { type: "heading", text: "Prereqs", level: 3 },
    { type: "paragraph", text: "content" },
    { type: "heading", text: "Config", level: 2 },
  ]);

  function getHeadings(): HeadingEntry[] {
    const headings: HeadingEntry[] = [];
    doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        headings.push({
          id: `heading-${pos}`,
          text: node.textContent,
          level: node.attrs.level as number,
          pos,
        });
      }
    });
    return headings;
  }

  it("H1 section ends at doc size (only H1)", () => {
    const headings = getHeadings();
    const end = getSectionEnd(headings, 0, doc.content.size);
    expect(end).toBe(doc.content.size);
  });

  it("H2 section ends at next H2", () => {
    const headings = getHeadings();
    const gsIdx = headings.findIndex((h) => h.text === "Getting Started");
    const installIdx = headings.findIndex((h) => h.text === "Install");
    const end = getSectionEnd(headings, gsIdx, doc.content.size);
    expect(end).toBe(headings[installIdx]!.pos);
  });

  it("H2 with H3 child includes child in section", () => {
    const headings = getHeadings();
    const installIdx = headings.findIndex((h) => h.text === "Install");
    const configIdx = headings.findIndex((h) => h.text === "Config");
    const end = getSectionEnd(headings, installIdx, doc.content.size);
    expect(end).toBe(headings[configIdx]!.pos);
  });

  it("H3 section ends at next H2 (higher level)", () => {
    const headings = getHeadings();
    const prereqIdx = headings.findIndex((h) => h.text === "Prereqs");
    const configIdx = headings.findIndex((h) => h.text === "Config");
    const end = getSectionEnd(headings, prereqIdx, doc.content.size);
    expect(end).toBe(headings[configIdx]!.pos);
  });

  it("last heading section ends at doc size", () => {
    const headings = getHeadings();
    const configIdx = headings.findIndex((h) => h.text === "Config");
    const end = getSectionEnd(headings, configIdx, doc.content.size);
    expect(end).toBe(doc.content.size);
  });
});
