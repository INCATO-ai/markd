import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export const ImagePasteDrop = Extension.create({
  name: "imagePasteDrop",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey("imagePasteDrop"),
        props: {
          handlePaste(_view, event) {
            const items = event.clipboardData?.items;
            if (!items) return false;

            for (const item of Array.from(items)) {
              if (item.type.startsWith("image/")) {
                event.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;

                fileToBase64(file).then((dataUrl) => {
                  editor
                    .chain()
                    .focus()
                    .setImage({ src: dataUrl, alt: file.name })
                    .run();
                });
                return true;
              }
            }
            return false;
          },

          handleDrop(_view, event) {
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;

            const imageFiles = Array.from(files).filter(isImageFile);
            if (imageFiles.length === 0) return false;

            event.preventDefault();

            for (const file of imageFiles) {
              fileToBase64(file).then((dataUrl) => {
                editor
                  .chain()
                  .focus()
                  .setImage({ src: dataUrl, alt: file.name })
                  .run();
              });
            }
            return true;
          },
        },
      }),
    ];
  },
});
