import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const css: string = readFileSync(
  resolve(process.cwd(), "src/styles/base.css"),
  "utf8",
);

function ruleBody(selector: string): string | null {
  const idx = css.indexOf(selector);
  if (idx === -1) return null;
  const open = css.indexOf("{", idx);
  const close = css.indexOf("}", open);
  if (open === -1 || close === -1) return null;
  return css.slice(open + 1, close);
}

describe("base.css layout", () => {
  test("#write table gets a horizontal scroll block so wide tables don't escape the 860px column", () => {
    const body = ruleBody("#write table");
    expect(body, "missing `#write table` rule").not.toBeNull();
    expect(body).toMatch(/display:\s*block/);
    expect(body).toMatch(/overflow-x:\s*auto/);
    expect(body).toMatch(/max-width:\s*100%/);
  });

  test(".markd-editor-scroll shows a horizontal scrollbar when content exceeds width", () => {
    const body = ruleBody(".markd-editor-scroll");
    expect(body).not.toBeNull();
    expect(body).toMatch(/overflow-x:\s*auto/);
  });

  test("#write max-width is driven by --editor-max-width so Full Width can swap it", () => {
    const body = ruleBody("#write");
    expect(body).not.toBeNull();
    expect(body).toMatch(/max-width:\s*var\(--editor-max-width/);
    expect(body).toMatch(/transition:\s*max-width/);
  });

  test("[data-full-width=\"true\"] #write removes the 860px cap", () => {
    const body = ruleBody('[data-full-width="true"] #write');
    expect(body).not.toBeNull();
    expect(body).toMatch(/max-width:\s*100%/);
  });
});
