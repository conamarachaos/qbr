import { IntegrationBriefPayload } from "@/lib/integrations/shared";

export interface CrmAccountRecord {
  id: string;
  name: string;
  url: string;
  summary: string;
  vertical?: string;
  updatedAt: string;
}

export interface CrmAdapter {
  upsertAccountBrief(brief: IntegrationBriefPayload): Promise<{ id: string; url: string }>;
  getAccount(name: string): Promise<CrmAccountRecord | null>;
}

const mockCrmStore = new Map<string, CrmAccountRecord>();
let mockCrmSequence = 0;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class MockCrmAdapter implements CrmAdapter {
  async upsertAccountBrief(
    brief: IntegrationBriefPayload,
  ): Promise<{ id: string; url: string }> {
    const id = `mock-crm-${String(++mockCrmSequence).padStart(4, "0")}`;
    const url = `https://mock-crm.local/accounts/${slugify(brief.accountName)}/briefs/${id}`;
    const record: CrmAccountRecord = {
      id,
      name: brief.accountName,
      url,
      summary: brief.summary,
      vertical: brief.vertical,
      updatedAt: new Date().toISOString(),
    };

    mockCrmStore.set(brief.accountName.toLowerCase(), record);
    console.info("[mock-crm] upsertAccountBrief", {
      id,
      accountName: brief.accountName,
      vertical: brief.vertical,
    });

    return { id, url };
  }

  async getAccount(name: string): Promise<CrmAccountRecord | null> {
    return mockCrmStore.get(name.toLowerCase()) ?? null;
  }
}

export function getCrmAdapter(): CrmAdapter {
  const provider = process.env.CRM_PROVIDER?.toLowerCase();

  if (
    provider === "salesforce" ||
    process.env.SALESFORCE_ACCESS_TOKEN ||
    process.env.SALESFORCE_CLIENT_ID
  ) {
    throw new Error("salesforce CRM adapter not implemented");
  }

  if (provider === "hubspot" || process.env.HUBSPOT_ACCESS_TOKEN) {
    throw new Error("hubspot CRM adapter not implemented");
  }

  return new MockCrmAdapter();
}
