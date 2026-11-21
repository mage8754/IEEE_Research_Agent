import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { verifyUpload } from "@/lib/uploads/uploads.functions";
import {
  bytesToBase64,
  checkFileMeta,
  checkSource,
  UPLOAD_RULES,
  type UploadKind,
  type UploadModule,
  type UploadSource,
} from "@/lib/uploads/rules";

export interface VerifiedFile {
  file: File;
  kind: UploadKind;
  /** File text for .tex/.bib (PDF text is extracted separately). */
  text: string;
  source: UploadSource;
}

/** Checks a file in the browser first (instant feedback), then on the server (extension, size, content). */
export function useUploadVerifier(module: UploadModule) {
  const verify = useServerFn(verifyUpload);
  return useCallback(
    async (file: File, allowed: UploadKind[] = UPLOAD_RULES[module].kinds): Promise<VerifiedFile> => {
      const meta = checkFileMeta(module, { fileName: file.name, size: file.size }, allowed);
      if (!meta.ok) throw new Error(meta.error);
      if (meta.kind === "pdf") {
        const head = bytesToBase64(new Uint8Array(await file.slice(0, 1024).arrayBuffer()));
        const tail = bytesToBase64(new Uint8Array(await file.slice(Math.max(0, file.size - 1024)).arrayBuffer()));
        const source: UploadSource = { kind: "pdf", fileName: file.name, head, tail };
        const local = checkSource(module, source, "", allowed);
        if (local) throw new Error(local);
        const res = await verify({ data: { module, allowed, fileName: file.name, size: file.size, head, tail } });
        if (!res.ok) throw new Error(res.error);
        return { file, kind: "pdf", text: "", source };
      }
      const text = await file.text();
      const source: UploadSource = { kind: meta.kind, fileName: file.name };
      const local = checkSource(module, source, text, allowed);
      if (local) throw new Error(local);
      const res = await verify({ data: { module, allowed, fileName: file.name, size: file.size, text } });
      if (!res.ok) throw new Error(res.error);
      return { file, kind: meta.kind, text, source };
    },
    [module, verify],
  );
}

/** Starts a browser download of text content. */
export function downloadText(text: string, fileName: string) {
  const blob = new Blob([text], { type: fileName.endsWith(".tex") ? "application/x-tex" : "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "paper.tex" → "paper-improved.tex"; pasted text → "improved-text.txt". */
export function resultFileName(source: UploadSource, suffix: string) {
  if (source.kind === "tex") return source.fileName.replace(/\.tex$/i, `-${suffix}.tex`);
  return `${suffix}-text.txt`;
}
