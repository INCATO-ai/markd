import { describe, it, expect } from "vitest";
import { exportAsHtml, exportAsPdf } from "./file-system";

describe("file-system utilities", () => {
  it("exportAsHtml is a function", () => {
    expect(typeof exportAsHtml).toBe("function");
  });

  it("exportAsPdf is a function", () => {
    expect(typeof exportAsPdf).toBe("function");
  });
});
