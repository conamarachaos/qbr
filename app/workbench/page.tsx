import { QbrWorkbench } from "@/components/qbr-workbench";
import { loadDatasetOptions } from "@/lib/dataset";

export default async function WorkbenchPage() {
  const { transcriptAccounts, usageOptions } = await loadDatasetOptions();

  return (
    <main className="mx-auto w-full px-4 py-8 md:px-8 lg:py-12">
      <QbrWorkbench
        transcriptAccounts={transcriptAccounts}
        usageOptions={usageOptions}
      />
    </main>
  );
}
