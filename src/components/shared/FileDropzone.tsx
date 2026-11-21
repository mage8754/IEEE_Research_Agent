import { FileUp, FileText, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FileDropzone({
  accept,
  hint,
  file,
  onFile,
  onClear,
  error,
  disabled,
}: {
  accept: string;
  hint: string;
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card">
        <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClear} disabled={disabled} aria-label="Remove file">
          <X />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed bg-gradient-subtle px-6 py-10 text-center transition-colors",
          dragging ? "border-primary bg-accent/60" : "border-border hover:border-primary/50",
          error && "border-destructive/50",
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <FileUp className="size-5" />
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">Drop your file here or click to browse</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
