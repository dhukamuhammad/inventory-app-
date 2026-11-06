import { getReturnsSummary } from "@/app/actions/returns";
import ReturnsClient from "./ReturnsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Returns & RTO Inward | ScoviX Warehouse",
  description: "Instant order traceability and return inward for Meesho, Flipkart & Amazon",
};

export default async function ReturnsPage() {
  const summary = await getReturnsSummary();

  return <ReturnsClient initialSummary={summary} />;
}
