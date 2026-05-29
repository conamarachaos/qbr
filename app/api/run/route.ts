import { z } from "zod";

import { normalizeAccountInput } from "@/lib/ingest";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";

const SourceInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  type: z.enum(["call", "email"]),
  content: z.string(),
});

const RunRequestSchema = z.object({
  accountName: z.string().min(1),
  transcripts: z.array(SourceInputSchema).default([]),
  emails: z.array(SourceInputSchema).default([]),
  usageRow: z.record(z.unknown()).nullable().optional(),
  usageText: z.string().optional(),
});

function sseChunk(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const payload = RunRequestSchema.parse(await request.json());
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseChunk(event, data)));
      };

      const input = normalizeAccountInput({
        accountName: payload.accountName,
        transcripts: payload.transcripts,
        emails: payload.emails,
        usageRow: payload.usageRow ?? undefined,
        usageText: payload.usageText,
      });

      send("start", {
        accountName: input.accountName,
        transcriptCount: input.transcripts.length,
        emailCount: input.emails.length,
        hasUsage: Boolean(input.usage),
      });

      runPipeline(input, {
        onStage: (event) => send("progress", event),
      })
        .then((result) => {
          send("result", result);
          controller.close();
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Unknown pipeline error";
          send("error", { message });
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
