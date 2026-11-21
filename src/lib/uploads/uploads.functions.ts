import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkFileMeta, checkSource, MAX_TEXT_FILE_BYTES, type UploadKind, type UploadModule } from "./rules";

const modules = ["humanizer", "grammar", "writing", "latex", "latexcode", "pdf", "citations", "literature", "reviewer"] as const satisfies readonly UploadModule[];
const kinds = ["tex", "bib", "pdf"] as const satisfies readonly UploadKind[];

/** Server-side check of an uploaded file: extension, size and actual content. Never converts files. */
export const verifyUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      module: z.enum(modules),
      allowed: z.array(z.enum(kinds)).min(1).max(3),
      fileName: z.string().min(1).max(255),
      size: z.number().int().min(0),
      text: z.string().max(MAX_TEXT_FILE_BYTES).optional(),
      head: z.string().max(4000).optional(),
      tail: z.string().max(4000).optional(),
    }),
  )
  .handler(async ({ data }): Promise<{ ok: true; kind: UploadKind } | { ok: false; error: string }> => {
    const meta = checkFileMeta(data.module, { fileName: data.fileName, size: data.size }, data.allowed);
    if (!meta.ok) return meta;
    const source =
      meta.kind === "pdf"
        ? { kind: "pdf" as const, fileName: data.fileName, head: data.head ?? "", tail: data.tail ?? "" }
        : { kind: meta.kind, fileName: data.fileName };
    const error = checkSource(data.module, source, data.text ?? "", data.allowed);
    return error ? { ok: false, error } : { ok: true, kind: meta.kind };
  });
