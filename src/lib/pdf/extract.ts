export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Validates a file chosen for upload. Returns an error message, or null when valid. */
export function validatePdfFile(file: File | null | undefined): string | null {
  if (!file) return "Please choose a PDF file.";
  const isPdfName = file.name.toLowerCase().endsWith(".pdf");
  const isPdfType = file.type === "application/pdf" || file.type === "";
  if (!isPdfName || !isPdfType) return "Only PDF files (.pdf) are supported.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_PDF_BYTES) return "PDF is larger than 20 MB. Please upload a smaller file.";
  return null;
}

/** Extracts selectable text from a PDF in the browser. */
export async function extractPdfText(file: File, maxChars = 90000) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  let text = "";
  for (let p = 1; p <= doc.numPages && text.length < maxChars; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
      .join("");
    text += line + "\n\n";
  }
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { text: text.slice(0, maxChars), pageCount: doc.numPages, truncated: text.length > maxChars };
}
