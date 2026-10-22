import { getGlobalAnalytics } from "@/app/actions/inventory";
import { AnalyticsClient } from "./AnalyticsClient";

export const metadata = {
  title: "Business Analytics & Reports | ScoviX",
  description: "Comprehensive multi-channel business performance, sales vs return rates, and platform breakdown.",
};

export default async function AnalyticsPage() {
  const data = await getGlobalAnalytics();

  return (
    <div className="max-w-7xl mx-auto">
      <AnalyticsClient initialData={data} />
    </div>
  );
}
