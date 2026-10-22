import { getAllStockMovements, getPlatforms } from "@/app/actions/inventory";
import { MovementsClient } from "./MovementsClient";

export const metadata = {
  title: "Stock Movements & Ledger | ScoviX",
  description: "Complete chronological history of all stock entries, sales, and returns.",
};

export default async function MovementsPage() {
  const [movements, platforms] = await Promise.all([
    getAllStockMovements(300),
    getPlatforms(),
  ]);

  return (
    <div className="max-w-7xl mx-auto">
      <MovementsClient initialMovements={movements} platforms={platforms} />
    </div>
  );
}

