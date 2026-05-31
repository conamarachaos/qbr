import { EditableBriefSchema } from "@/lib/brief-export";
import { getCurrentUser } from "@/lib/auth/session";
import { saveBriefEdits } from "@/lib/repo/runs";

export async function PUT(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; runId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    editedBrief: unknown;
    approve?: boolean;
  };

  const editedBrief = EditableBriefSchema.parse(payload.editedBrief);
  const { id, runId } = await params;

  const brief = await saveBriefEdits(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    {
      accountId: id,
      runId,
      editedBrief,
      approve: payload.approve,
    },
  );

  return Response.json({ brief });
}
