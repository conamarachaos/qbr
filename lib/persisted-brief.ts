import { z } from "zod";

import { EditableBriefSchema } from "@/lib/brief-export";
import { BriefSchema } from "@/lib/schemas";

export const PersistedSourceMapSchema = z.record(
  z.object({
    label: z.string(),
    content: z.string(),
    type: z.string(),
  }),
);

export const PersistedBriefDataSchema = z.object({
  brief: BriefSchema,
  editedBrief: EditableBriefSchema.optional(),
  sourceMap: PersistedSourceMapSchema,
});

export type PersistedBriefData = z.infer<typeof PersistedBriefDataSchema>;
