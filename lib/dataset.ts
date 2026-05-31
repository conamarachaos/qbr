import { promises as fs } from "fs";
import path from "path";

import usageRows from "@/data/usage/customer-data-extract.json";
import { type RawSourceInput } from "@/lib/ingest";

const DATA_DIR = path.join(process.cwd(), "data");
const TRANSCRIPTS_DIR = path.join(DATA_DIR, "transcripts");

export interface TranscriptAccountOption {
  id: string;
  name: string;
  transcriptCount: number;
  transcripts: RawSourceInput[];
}

export interface UsageRowOption {
  id: string;
  name: string;
  summary: string;
  row: Record<string, unknown>;
}

export interface SeedAccountMapping {
  transcriptAccountId: string;
  usageAccountName?: string;
}

function humanizeSlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function loadTranscriptAccounts(): Promise<TranscriptAccountOption[]> {
  const entries = await fs.readdir(TRANSCRIPTS_DIR, { withFileTypes: true });

  const accounts = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) => {
        const accountDir = path.join(TRANSCRIPTS_DIR, entry.name);
        const files = (await fs.readdir(accountDir))
          .filter((file) => file.endsWith(".txt"))
          .sort((a, b) => a.localeCompare(b));

        const transcripts = await Promise.all(
          files.map(async (fileName) => {
            const content = await fs.readFile(path.join(accountDir, fileName), "utf8");
            return {
              id: `${entry.name}-${fileName.replace(/\.txt$/i, "")}`,
              label: fileName.replace(/-/g, " ").replace(/\.txt$/i, ""),
              type: "call" as const,
              content,
            };
          }),
        );

        return {
          id: entry.name,
          name: humanizeSlug(entry.name),
          transcriptCount: transcripts.length,
          transcripts,
        };
      }),
  );

  return accounts;
}

function summarizeUsageRow(row: Record<string, unknown>) {
  const organization = String(row["ORGANIZATION NAME"] || "Usage Row");
  const vertical = String(row["ORGANIZATION VERTICAL"] || "Unknown vertical");
  const arr = String(row["LOCATION CURRENT MONTH END ARR USD"] || "n/a");
  const products = String(row["AI PRODUCT NAMES"] || "[]");
  return `${organization} · ${vertical} · ARR ${arr} · AI ${products}`;
}

export function loadUsageRows(): UsageRowOption[] {
  return (usageRows as Record<string, unknown>[]).map((row, index) => ({
    id: `usage-row-${index + 1}`,
    name: String(row["ORGANIZATION NAME"] || `Usage Row ${index + 1}`),
    summary: summarizeUsageRow(row),
    row,
  }));
}

export function findUsageRowByAccountName(accountName: string) {
  return loadUsageRows().find((option) => option.name === accountName);
}

export async function loadSeedDataset() {
  const transcriptAccounts = await loadTranscriptAccounts();
  const usageOptions = loadUsageRows();

  return {
    transcriptAccounts,
    usageOptions,
    mappings: [
      {
        transcriptAccountId: "meridian-furniture",
        usageAccountName: "Auscraft Furniture",
      },
      {
        transcriptAccountId: "northfield-electrical",
        usageAccountName: "Mr Sparky",
      },
      {
        transcriptAccountId: "apex",
      },
    ] satisfies SeedAccountMapping[],
  };
}

export async function loadDatasetOptions() {
  const [transcriptAccounts, usageOptions] = await Promise.all([
    loadTranscriptAccounts(),
    Promise.resolve(loadUsageRows()),
  ]);

  return {
    transcriptAccounts,
    usageOptions,
  };
}
