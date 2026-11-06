import { getProductsWithMappings } from "@/app/actions/inventory";
import { MappingsClient } from "./MappingsClient";

export const metadata = {
  title: "SKU Channel Mappings | ScoviX",
  description: "Link and decode multiple Meesho, Flipkart & Amazon listing SKUs to warehouse master inventory.",
};

export default async function MappingsPage() {
  const products = await getProductsWithMappings();

  return (
    <div className="max-w-7xl mx-auto">
      <MappingsClient initialProducts={products as any} />
    </div>
  );
}
