import { getCurrentUser } from "@/lib/auth/session";
import { executeAccountRun } from "@/lib/repo/runs";

export const runtime = "nodejs";

function sseChunk(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseChunk(event, data)));
      };

      send("start", { accountId: id });

      try {
        const { runId, result } = await executeAccountRun(
          {
            userId: user.id,
            workspaceId: user.workspaceId,
            role: user.role,
          },
          id,
          {
            onStage: (event) => send("progress", event),
          },
        );

        send("result", {
          runId,
          ...result,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown pipeline error";
        send("error", { message });
      } finally {
        controller.close();
      }
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
