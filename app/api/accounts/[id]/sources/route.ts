import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { addAccountSource } from "@/lib/repo/accounts";

const CreateSourceSchema = z.object({
  label: z.string().min(1),
  type: z.enum(["call", "email", "usage"]),
  content: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = CreateSourceSchema.parse(await request.json());
  const { id } = await params;

  const source = await addAccountSource(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    {
      accountId: id,
      ...payload,
    },
  );

  return Response.json({ source });
}
