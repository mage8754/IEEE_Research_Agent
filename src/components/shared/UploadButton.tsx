import { FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUploadVerifier, type VerifiedFile } from "@/hooks/use-upload";
import { acceptFor, kindsLabel, UPLOAD_RULES, type UploadKind, type UploadModule } from "@/lib/uploads/rules";

/**
 * File picker that only accepts the module's allowed file types. Every file is
 * checked in the browser and on the server; rejected files show a clear error.
 */
export function UploadButton({
  module,
  kinds,
  multiple = false,
  maxChars,
  label,
  onFiles,
  onError,
  disabled,
  className,
}: {
  module: UploadModule;
  kinds?: UploadKind[];
  multiple?: boolean;
  /** Reject text files longer than this (characters). */
  maxChars?: number;
  label?: string;
  onFiles: (files: VerifiedFile[]) => void | Promise<void>;
  onError?: (message: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const allowed = kinds ?? UPLOAD_RULES[module].kinds;
  const verify = useUploadVerifier(module);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    onError?.(null);
    const ok: VerifiedFile[] = [];
    for (const file of Array.from(list)) {
      try {
        const v = await verify(file, allowed);
        if (maxChars && v.text.length > maxChars)
          throw new Error(
            `“${file.name}” has ${v.text.length.toLocaleString()} characters — this tool handles up to ${maxChars.toLocaleString()} per run. Upload or paste one section at a time.`,
          );
        ok.push(v);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "This file could not be checked.";
        toast.error(`${file.name}: ${msg}`);
        onError?.(msg);
      }
    }
    try {
      if (ok.length) await onFiles(ok);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        title={`Accepted: ${kindsLabel(allowed)}`}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-60",
          className,
        )}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
        {busy ? "Checking file…" : (label ?? `Upload ${kindsLabel(allowed)}`)}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={acceptFor(allowed)}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          void handle(files).finally(() => {
            e.target.value = "";
          });
        }}
      />
    </>
  );
}
