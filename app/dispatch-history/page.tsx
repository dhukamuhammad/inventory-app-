import { getDispatchBatches } from "@/app/actions/dispatch";
import { DispatchHistoryClient } from "./DispatchHistoryClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dispatch History | ScoviX Inventory",
  description: "Complete history of uploaded PDF shipping labels, courier breakdown and dispatched batches",
};

export default async function DispatchHistoryPage() {
  const batches = await getDispatchBatches();

  return (
    <div className="max-w-7xl mx-auto">
      <DispatchHistoryClient initialBatches={batches} />
    </div>
  );
}
