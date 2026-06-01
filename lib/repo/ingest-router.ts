import { generateObject } from "ai";
import { z } from "zod";

import { getRoutingModel } from "@/lib/models";
import { type SourceType } from "@/lib/ingest";

export interface UploadedFile {
  filename: string;
  content: string;
}

export interface ClassifiedFile {
  filename: string;
  content: string;
  sourceType: SourceType;
  accountName: string;
  vertical: string | null;
  arrUsd: number | null;
  confidence: number;
  reasoning: string;
}

// Only the first slice of each file is sent to the model — for *routing* (which
// account is this?) the org name almost always appears near the top, so we
// don't pay to send the whole transcript/CSV.
const EXCERPT_CHARS = 1500;

// Hard ceiling on the routing-model call during file analysis. Past this we fall
// back to heuristic classification so the UI's "Analyze" step always completes.
const CLASSIFY_TIMEOUT_MS = 30_000;

const FileClassificationSchema = z.object({
  index: z.number().int().describe("The 0-based index of the file, as labeled in the prompt."),
  accountName: z
    .string()
    .min(1)
    .describe(
      "The customer/organization name this document is about. The company being served, not the vendor (Podium). If genuinely unknown, use 'Unknown Account'.",
    ),
  sourceType: z
    .enum(["call", "email", "usage"])
    .describe(
      "call = meeting/phone transcript; email = email thread or message; usage = structured product/usage metrics (CSV or JSON rows).",
    ),
  vertical: z.string().nullable().describe("Industry/vertical if stated or strongly implied, else null."),
  arrUsd: z.number().nullable().describe("Annual recurring revenue in USD if present, else null."),
  confidence: z.number().min(0).max(1).describe("0-1 confidence that accountName is correct."),
  reasoning: z.string().describe("One short sentence on how the account name was determined."),
});

const BatchClassificationSchema = z.object({
  files: z.array(FileClassificationSchema),
});

// Static instructions — kept verbatim across calls so Anthropic prompt caching
// can hit on the system block.
const ROUTING_SYSTEM_PROMPT = [
  `You route uploaded customer documents for a B2B SaaS account team. The vendor is "Podium".`,
  `For each file, determine which CUSTOMER account it belongs to (never "Podium" itself) and classify the source type.`,
  `Return one entry per file, keyed by the 0-based index shown in the prompt. Do not invent files.`,
].join("\n");

function guessSourceTypeFromShape(file: UploadedFile): SourceType | null {
  const name = file.filename.toLowerCase();
  if (name.endsWith(".csv")) return "usage";
  if (name.endsWith(".json")) {
    const trimmed = file.content.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "usage";
  }
  if (name.endsWith(".eml")) return "email";
  if (name.endsWith(".vtt")) return "call";
  return null;
}

function humanizeStem(filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return stem ? stem.replace(/\b\w/g, (c) => c.toUpperCase()) : "Unknown Account";
}

// Tier 1: free, deterministic structural extraction. Returns a confident
// ClassifiedFile when the org name can be read directly from the file; null
// when we can't be sure and should ask the model.
// Minimal CSV row splitter that respects double-quoted fields (incl. ""-escapes).
function splitCsvRow(row: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"') {
        if (row[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

// Read a column value from a header-row + data-row CSV (the shape xlsx exports
// to). Matches the header case-insensitively, optionally by a contains-test.
function csvColumn(
  header: string[],
  data: string[],
  name: string,
  contains = false,
): string | null {
  const target = name.toLowerCase();
  const idx = header.findIndex((h) => {
    const norm = h.toLowerCase();
    return contains ? norm.includes(target) : norm === target;
  });
  if (idx < 0) return null;
  const value = data[idx]?.trim();
  return value || null;
}

// Pull org name / vertical / ARR out of a CSV usage export. Returns null if it
// doesn't look like a usage CSV with an ORGANIZATION NAME column.
function extractFromUsageCsv(content: string): { accountName: string; vertical: string | null; arrUsd: number | null } | null {
  // Skip a leading "# Sheet: ..." marker line from the xlsx converter.
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("# Sheet:"));
  if (lines.length < 2) return null;

  const header = splitCsvRow(lines[0]);
  const data = splitCsvRow(lines[1]);

  const accountName = csvColumn(header, data, "ORGANIZATION NAME");
  if (!accountName) return null;

  const vertical = csvColumn(header, data, "ORGANIZATION VERTICAL");
  const arrRaw = csvColumn(header, data, "ARR USD", true) ?? csvColumn(header, data, "ARR", true);
  const arrUsd = arrRaw ? Number(arrRaw.replace(/[,$]/g, "")) || null : null;

  return { accountName, vertical, arrUsd };
}

export function tryStructuralExtract(file: UploadedFile): ClassifiedFile | null {
  const shape = guessSourceTypeFromShape(file);

  // JSON usage rows: explicit "ORGANIZATION NAME": "..." field.
  const jsonOrg = file.content.match(/"ORGANIZATION NAME"\s*:\s*"([^"]+)"/i);
  if (jsonOrg?.[1]?.trim()) {
    const vertMatch = file.content.match(/"ORGANIZATION VERTICAL"\s*:\s*"([^"]+)"/i);
    const arrMatch = file.content.match(/"[^"]*ARR[^"]*"\s*:\s*"?(-?\d[\d,]*\.?\d*)/i);
    return {
      filename: file.filename,
      content: file.content,
      sourceType: shape ?? "usage",
      accountName: jsonOrg[1].trim(),
      vertical: vertMatch?.[1]?.trim() ?? null,
      arrUsd: arrMatch ? Number(arrMatch[1].replace(/,/g, "")) || null : null,
      confidence: 0.95,
      reasoning: "Read ORGANIZATION NAME from the usage JSON.",
    };
  }

  // CSV usage export (incl. xlsx-converted): read the ORGANIZATION NAME *column*
  // value from the data row — not an adjacent header.
  if (/ORGANIZATION NAME/i.test(file.content)) {
    const csv = extractFromUsageCsv(file.content);
    if (csv) {
      return {
        filename: file.filename,
        content: file.content,
        sourceType: shape ?? "usage",
        accountName: csv.accountName,
        vertical: csv.vertical,
        arrUsd: csv.arrUsd,
        confidence: 0.95,
        reasoning: "Read the ORGANIZATION NAME column from the usage export.",
      };
    }
  }

  // Transcript header convention in this dataset, either order:
  //   "Podium x <Customer> - <Topic>"  or  "<Customer> x Podium | <Topic>".
  const header = file.content.slice(0, 400);
  const headerMatch =
    header.match(/podium\s*[x×]\s*([A-Za-z0-9 .&'-]{2,}?)\s*[-–—:|]/i) ??
    header.match(/^\s*([A-Za-z0-9 .&'-]{2,}?)\s*[x×]\s*podium\b/i);
  if (headerMatch?.[1]?.trim()) {
    return {
      filename: file.filename,
      content: file.content,
      sourceType: shape ?? "call",
      accountName: headerMatch[1].trim(),
      vertical: null,
      arrUsd: null,
      confidence: 0.85,
      reasoning: "Parsed the customer name from the transcript title line.",
    };
  }

  return null;
}

// Last-resort, no-model classification (e.g. no API key, or the batch call
// failed). Uses shape + filename stem.
function heuristicClassify(file: UploadedFile): ClassifiedFile {
  return {
    filename: file.filename,
    content: file.content,
    sourceType: guessSourceTypeFromShape(file) ?? "call",
    accountName: humanizeStem(file.filename),
    vertical: null,
    arrUsd: null,
    confidence: 0.3,
    reasoning: "Derived without the model from file shape and filename.",
  };
}

function buildBatchPrompt(files: UploadedFile[]) {
  const blocks = files.map((file, index) => {
    const shape = guessSourceTypeFromShape(file);
    return [
      `### File index ${index}`,
      `Filename: ${file.filename}`,
      shape ? `Structural hint: likely "${shape}" (verify yourself).` : "",
      `Content (truncated):`,
      file.content.slice(0, EXCERPT_CHARS),
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    `Classify the following ${files.length} file(s). Return exactly one entry per file index.`,
    ``,
    blocks.join("\n\n"),
  ].join("\n");
}

// Tier 2: a SINGLE batched call (cheap routing model) for all files that tier 1
// couldn't resolve. Falls back to per-file heuristics if the call fails.
async function classifyBatchWithLLM(
  files: UploadedFile[],
  generateObjectImpl: typeof generateObject,
): Promise<ClassifiedFile[]> {
  if (files.length === 0) return [];

  // Bound the classification call so a hung/slow API response can never leave the
  // upload "Analyze" step spinning forever — fall back to heuristics on timeout.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLASSIFY_TIMEOUT_MS);

  try {
    const result = await generateObjectImpl({
      model: getRoutingModel(),
      schema: BatchClassificationSchema,
      schemaName: "BatchDocumentClassification",
      system: ROUTING_SYSTEM_PROMPT,
      temperature: 0,
      maxRetries: 1,
      abortSignal: controller.signal,
      prompt: buildBatchPrompt(files),
      providerOptions: {
        // Cache the static system block so repeated/large batches only pay full
        // price for it once (Anthropic prompt caching).
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    });

    const parsed = BatchClassificationSchema.parse(result.object);
    const byIndex = new Map(parsed.files.map((entry) => [entry.index, entry]));

    return files.map((file, index) => {
      const entry = byIndex.get(index);
      if (!entry) {
        return heuristicClassify(file);
      }
      const shapeHint = guessSourceTypeFromShape(file);
      return {
        filename: file.filename,
        content: file.content,
        // Trust the structural shape for raw data files; the model sometimes
        // mislabels CSV/JSON as "email".
        sourceType: shapeHint === "usage" ? "usage" : entry.sourceType,
        accountName: entry.accountName.trim() || humanizeStem(file.filename),
        vertical: entry.vertical,
        arrUsd: entry.arrUsd,
        confidence: entry.confidence,
        reasoning: entry.reasoning,
      };
    });
  } catch {
    return files.map(heuristicClassify);
  } finally {
    clearTimeout(timeout);
  }
}

// Primary entry point: tiered, batched classification for a set of files.
//   tier 1 — free structural parse (no tokens)
//   tier 2 — ONE batched routing-model call for whatever's left (or heuristic
//            fallback when no API key)
export async function classifyUploadedFiles(
  files: UploadedFile[],
  generateObjectImpl: typeof generateObject = generateObject,
): Promise<ClassifiedFile[]> {
  const results: (ClassifiedFile | null)[] = new Array(files.length).fill(null);
  const needsLlm: { file: UploadedFile; index: number }[] = [];

  files.forEach((file, index) => {
    const structural = tryStructuralExtract(file);
    if (structural) {
      results[index] = structural;
    } else {
      needsLlm.push({ file, index });
    }
  });

  if (needsLlm.length > 0) {
    if (!process.env.ANTHROPIC_API_KEY) {
      for (const { file, index } of needsLlm) {
        results[index] = heuristicClassify(file);
      }
    } else {
      const classified = await classifyBatchWithLLM(
        needsLlm.map((item) => item.file),
        generateObjectImpl,
      );
      needsLlm.forEach((item, i) => {
        results[item.index] = classified[i];
      });
    }
  }

  return results.map((result, index) => result ?? heuristicClassify(files[index]));
}

// Lightweight name normalization for fuzzy matching against existing accounts.
export function normalizeAccountName(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|pty|co|corp|company|the)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Returns the best existing-account match for a name, or null. Matches on exact
// normalized equality or strong containment (handles "Mr Sparky" vs
// "Mr Sparky Electrical").
export function matchExistingAccount(
  extractedName: string,
  existing: Array<{ id: string; name: string }>,
): { id: string; name: string } | null {
  const target = normalizeAccountName(extractedName);
  if (!target) return null;

  for (const account of existing) {
    if (normalizeAccountName(account.name) === target) {
      return account;
    }
  }

  for (const account of existing) {
    const candidate = normalizeAccountName(account.name);
    if (!candidate) continue;
    if (candidate.includes(target) || target.includes(candidate)) {
      return account;
    }
  }

  return null;
}
