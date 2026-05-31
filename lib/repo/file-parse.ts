import * as XLSX from "xlsx";

export interface RawUpload {
  filename: string;
  /** Raw bytes of the file. */
  bytes: ArrayBuffer;
}

export interface ParsedUpload {
  filename: string;
  content: string;
}

export interface FileParseResult {
  parsed: ParsedUpload[];
  skipped: Array<{ filename: string; reason: string }>;
}

// Postgres text columns reject NUL (0x00). Strip it (and other C0 control chars
// except tab/newline/carriage-return) so stray bytes from odd encodings can't
// blow up the insert.
export function sanitizeText(input: string) {
  // Strip NUL and other C0 control chars (keep tab \t, newline \n, CR \r)
  // since Postgres text columns reject 0x00.
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code === 0x09 || code === 0x0a || code === 0x0d || code >= 0x20) {
      out += input[i];
    }
  }
  return out;
}

const TEXT_EXTENSIONS = [".txt", ".vtt", ".eml", ".csv", ".json", ".md"];
const XLSX_EXTENSIONS = [".xlsx", ".xls"];
// Binary types we explicitly refuse with a helpful message rather than mangling.
const REJECT_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".gif", ".zip", ".docx"];

function extOf(filename: string) {
  const match = filename.toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function looksBinary(text: string) {
  // A high density of NUL bytes in the first chunk means we decoded binary as text.
  const sample = text.slice(0, 1000);
  let nulls = 0;
  for (let i = 0; i < sample.length; i += 1) {
    if (sample.charCodeAt(i) === 0) nulls += 1;
  }
  return sample.length > 0 && nulls / sample.length > 0.05;
}

// Convert an .xlsx/.xls workbook to a CSV-per-sheet text blob the usage parser
// and the LLM router can both read (the ORGANIZATION NAME column survives).
function xlsxToText(bytes: ArrayBuffer): string {
  const workbook = XLSX.read(bytes, { type: "array" });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) {
      parts.push(`# Sheet: ${sheetName}\n${csv}`);
    }
  }
  return parts.join("\n\n");
}

export function parseUpload(filename: string, bytes: ArrayBuffer): ParsedUpload | { error: string } {
  const ext = extOf(filename);

  if (REJECT_EXTENSIONS.includes(ext)) {
    return { error: `${ext} files aren't supported. Upload TXT, CSV, JSON, or XLSX.` };
  }

  if (XLSX_EXTENSIONS.includes(ext)) {
    try {
      const content = sanitizeText(xlsxToText(bytes));
      if (!content.trim()) {
        return { error: "Spreadsheet had no readable rows." };
      }
      return { filename, content };
    } catch {
      return { error: "Could not parse the spreadsheet." };
    }
  }

  // Treat everything else as text.
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (!TEXT_EXTENSIONS.includes(ext) && looksBinary(decoded)) {
    return { error: "File looks binary, not text. Upload TXT, CSV, JSON, or XLSX." };
  }

  const content = sanitizeText(decoded);
  if (!content.trim()) {
    return { error: "Empty file." };
  }
  return { filename, content };
}

export function parseUploads(uploads: RawUpload[]): FileParseResult {
  const parsed: ParsedUpload[] = [];
  const skipped: FileParseResult["skipped"] = [];

  for (const upload of uploads) {
    const result = parseUpload(upload.filename, upload.bytes);
    if ("error" in result) {
      skipped.push({ filename: upload.filename, reason: result.error });
    } else {
      parsed.push(result);
    }
  }

  return { parsed, skipped };
}
