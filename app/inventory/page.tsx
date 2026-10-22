import { getProducts, getCategories, getPlatforms } from "@/app/actions/inventory";
import { InventoryClient } from "./InventoryClient";

export default async function InventoryPage() {
  const products = await getProducts();
  const categories = await getCategories();
  const platforms = await getPlatforms();

  return (
    <div className="max-w-7xl mx-auto">
      <InventoryClient 
        products={products} 
        categories={categories}
        platforms={platforms}
      />
    </div>
  );
}
