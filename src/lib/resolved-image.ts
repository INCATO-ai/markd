import Image, { type ImageOptions } from "@tiptap/extension-image";
import { convertFileSrc } from "@tauri-apps/api/core";

export interface ResolvedImageOptions extends ImageOptions {
  getFileDir: () => string;
}

/**
 * Image node that resolves relative `src` paths against the current markdown
 * file's directory and rewrites them to Tauri's asset protocol so the webview
 * can load local files. Keeps the node's `src` attribute unchanged, so saving
 * writes the original relative path back to disk.
 *
 * Requires `app.security.assetProtocol.enable = true` in tauri.conf.json.
 */
export const ResolvedImage = Image.extend<ResolvedImageOptions>({
  addOptions() {
    return {
      ...(this.parent?.() ?? {}),
      getFileDir: () => "",
    };
  },
  renderHTML({ HTMLAttributes, node }) {
    const src = (node.attrs.src as string | undefined) ?? "";
    const resolved = resolveImageSrc(src, this.options.getFileDir());
    return ["img", { ...HTMLAttributes, src: resolved }];
  },
});

function resolveImageSrc(src: string, fileDir: string): string {
  if (!src) return src;
  if (/^(https?:|data:|asset:|file:|tauri:|blob:)/i.test(src)) return src;
  if (!fileDir) return src;

  const absolute = isAbsolute(src) ? src : joinPath(fileDir, src);
  try {
    return convertFileSrc(absolute);
  } catch {
    return src;
  }
}

function isAbsolute(p: string): boolean {
  return (
    p.startsWith("/") ||
    p.startsWith("\\\\") ||
    /^[a-zA-Z]:[\\/]/.test(p)
  );
}

function joinPath(dir: string, rel: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  const cleanDir = dir.replace(/[\\/]+$/, "");
  const normalizedRel = rel.replace(/\//g, sep);
  return `${cleanDir}${sep}${normalizedRel}`;
}
