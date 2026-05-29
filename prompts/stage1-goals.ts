import { NormalizedAccountInput } from "@/lib/ingest";

export function buildStage1Prompt(input: NormalizedAccountInput) {
  return `Account: ${input.accountName}

Transcript sources:
${input.transcriptContext || "No transcript sources provided."}

Email sources:
${input.emailContext || "No email sources provided."}

Optional usage context:
${input.usageContext}

Task:
Extract customer goals that are explicitly stated or strongly implied by the customer or CSM.
Return goals only when supported by evidence.
Each goal needs:
- id
- title
- description
- evidence[] with exact quotes
- confidence 0-1

Rules:
- Extract only what is explicitly supported; cite evidence.
- No evidence means no goal.
- Prefer concise, AM-friendly goal titles.`;
}
