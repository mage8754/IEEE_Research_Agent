import { Check, ClipboardCopy, Eraser, FileText } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { countWords } from "@/lib/engines/text";
import { cn } from "@/lib/utils";

export async function copyText(text: string, label = "Copied to clipboard") {
  if (!text.trim()) {
    toast.error("Nothing to copy yet");
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
    return true;
  } catch {
    toast.error("Your browser blocked clipboard access");
    return false;
  }
}

export function CopyButton({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: "sm" | "default" }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
    >
      {done ? <Check /> : <ClipboardCopy />}
      {label}
    </Button>
  );
}

export function TextEditor({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 15000,
  minLength,
  sample,
  mono = false,
  rows = 14,
  error,
  disabled,
  id,
  actions,
  hint,
  onReset,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  minLength?: number;
  sample?: string;
  mono?: boolean;
  rows?: number;
  error?: string | null;
  disabled?: boolean;
  id?: string;
  /** Extra header controls, e.g. an upload button. */
  actions?: ReactNode;
  /** Shown in the footer when there is no error, e.g. accepted formats. */
  hint?: string;
  /** Called when the text is replaced by the sample or cleared (input no longer comes from a file). */
  onReset?: () => void;
}) {
  const over = value.length > maxLength;
  const inputId = id ?? label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-card focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/15">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <label htmlFor={inputId} className="px-1 text-sm font-medium text-foreground">
          {label}
        </label>
        <div className="flex flex-wrap items-center gap-1">
          {actions}
          {sample && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(sample); onReset?.(); }} disabled={disabled}>
              <FileText />
              Fictional sample
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => copyText(value)} disabled={!value}>
            <ClipboardCopy />
            Copy
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(""); onReset?.(); }} disabled={!value || disabled}>
            <Eraser />
            Clear
          </Button>
        </div>
      </div>
      <textarea
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        spellCheck={!mono}
        className={cn(
          "w-full resize-y bg-transparent px-4 py-3 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-60",
          mono && "font-mono text-[13px]",
        )}
      />
      <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
        <span className={cn(error && "text-destructive")}>
          {error ?? (minLength && value.trim().length > 0 && value.trim().length < minLength ? `Enter at least ${minLength} characters` : (hint ?? "\u00a0"))}
        </span>
        <span className={cn(over && "font-medium text-destructive")}>
          {countWords(value).toLocaleString()} words · {value.length.toLocaleString()}/{maxLength.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
