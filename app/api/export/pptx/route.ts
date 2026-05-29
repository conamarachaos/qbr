import { ExportPayloadSchema } from "@/lib/brief-export";
import { buildBriefDeck } from "@/lib/deck";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = ExportPayloadSchema.parse(await request.json());
  const buffer = await buildBriefDeck(payload);
  const safeName = payload.brief.accountName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const body = new Uint8Array(buffer);

  return new Response(body, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${safeName || "qbr-brief"}.pptx"`,
    },
  });
}
