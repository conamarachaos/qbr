import { QbrWorkbench } from "@/components/qbr-workbench";
import { loadDatasetOptions } from "@/lib/dataset";

export default async function HomePage() {
  const { transcriptAccounts, usageOptions } = await loadDatasetOptions();

  return (
    <main>
      <QbrWorkbench
        transcriptAccounts={transcriptAccounts}
        usageOptions={usageOptions}
      />
    </main>
  );
}
