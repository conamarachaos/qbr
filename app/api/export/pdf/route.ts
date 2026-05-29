import { ExportPayloadSchema } from "@/lib/brief-export";
import { buildBriefPdf } from "@/lib/pdf";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = ExportPayloadSchema.parse(await request.json());
  const buffer = await buildBriefPdf(payload);
  const safeName = payload.brief.accountName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName || "qbr-brief"}.pdf"`,
    },
  });
}
