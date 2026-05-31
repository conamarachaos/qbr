import { getCurrentUser } from "@/lib/auth/session";
import { summarizeAccountSource } from "@/lib/repo/summarize";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id, sourceId } = await params;
  const body = (await request.json().catch(() => ({}))) as { force?: boolean };

  try {
    const summary = await summarizeAccountSource(
      { userId: user.id, workspaceId: user.workspaceId, role: user.role },
      { accountId: id, sourceId, force: Boolean(body.force) },
    );
    return Response.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to summarize source.";
    return Response.json({ message }, { status: 500 });
  }
}
