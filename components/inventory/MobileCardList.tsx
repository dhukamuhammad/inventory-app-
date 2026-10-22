"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Pencil, 
  Trash2, 
  TrendingUp, 
  Search, 
  X, 
  AlertCircle,
  Package,
  Plus,
  Minus,
  RotateCcw,
  ChevronRight,
  Boxes,
  History,
  BarChart2,
  CheckCircle2,
  MoreHorizontal
} from "lucide-react";
import { Product, Category } from "@prisma/client";
import { DropdownItem } from "@/components/ui/CustomDropdown";

type ProductWithCategory = Product & { category: Category };

interface MobileCardListProps {
  products: ProductWithCategory[];
  categories?: DropdownItem[];
  onStockAction: (product: ProductWithCategory, type: "IN" | "OUT" | "RETURN") => void;
  onEdit?: (product: ProductWithCategory) => void;
  onDelete?: (product: ProductWithCategory) => void;
  onViewInsights?: (productId: string, tab?: "OVERVIEW" | "PLATFORMS" | "HISTORY") => void;
}

export function MobileCardList({ 
  products, 
  categories = [],
  onStockAction, 
  onEdit, 
  onDelete, 
  onViewInsights 
}: MobileCardListProps) {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [activeActionItem, setActiveActionItem] = useState<ProductWithCategory | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const inStockCount = useMemo(() => {
    return products.filter((p) => p.currentStock > p.lowStockAlertAt).length;
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.currentStock > 0 && p.currentStock <= p.lowStockAlertAt).length;
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter((p) => p.currentStock <= 0).length;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === "" ||
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.category?.name.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      if (selectedFilter === "ALL") return true;
      if (selectedFilter === "IN_STOCK") return item.currentStock > item.lowStockAlertAt;
      if (selectedFilter === "LOW_STOCK") return item.currentStock > 0 && item.currentStock <= item.lowStockAlertAt;
      if (selectedFilter === "OUT_OF_STOCK") return item.currentStock <= 0;
      return item.categoryId === selectedFilter;
    });
  }, [products, searchQuery, selectedFilter]);

  if (products.length === 0) {
    return (
      <div className="md:hidden p-8 text-center bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
          <Package className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-gray-900">No products yet</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-xs">
          Tap "+ Add Product" at the top to add your first inventory item.
        </p>
      </div>
    );
  }

  return (
    <div className="md:hidden flex flex-col gap-3">
      {/* 1. Mobile Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products by name or SKU..."
          className="w-full pl-10 pr-9 py-2.5 bg-white border border-gray-200/90 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 touch-manipulation cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Horizontal Smart Status & Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedFilter("ALL")}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all touch-manipulation cursor-pointer ${
            selectedFilter === "ALL"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-100 hover:bg-gray-50"
          }`}
        >
          All ({products.length})
        </button>

        {inStockCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedFilter("IN_STOCK")}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation cursor-pointer ${
              selectedFilter === "IN_STOCK"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 border border-emerald-100/60"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            In Stock ({inStockCount})
          </button>
        )}

        {lowStockCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedFilter("LOW_STOCK")}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation cursor-pointer ${
              selectedFilter === "LOW_STOCK"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 border border-amber-100/60"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Low Stock ({lowStockCount})
          </button>
        )}

        {outOfStockCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedFilter("OUT_OF_STOCK")}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation cursor-pointer ${
              selectedFilter === "OUT_OF_STOCK"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-50 text-rose-700 border border-rose-100/60"
            }`}
          >
            <X className="w-3.5 h-3.5" />
            Out ({outOfStockCount})
          </button>
        )}

        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedFilter(cat.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation cursor-pointer ${
              selectedFilter === cat.id
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-100 hover:bg-gray-50"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 3. Products List or Filter Empty State */}
      {filteredProducts.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
          <p className="text-sm font-semibold text-gray-900">No matching products</p>
          <p className="text-xs text-gray-500 mt-1">Try changing your search term or filter.</p>
          <button
            type="button"
            onClick={() => { setSearchQuery(""); setSelectedFilter("ALL"); }}
            className="mt-3 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredProducts.map((item) => {
            const isOutOfStock = item.currentStock <= 0;
            const isLowStock = !isOutOfStock && item.currentStock <= item.lowStockAlertAt;
            const totalValuation = item.currentStock * item.costPrice;
            // @ts-ignore
            const defectiveUnits = item.defectiveStock || 0;
            const defectiveValuation = defectiveUnits * item.costPrice;

            return (
              <div 
                key={item.id} 
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-all active:border-indigo-200"
              >
                <div className="p-3.5 flex flex-col gap-2.5">
                  {/* Top: Category, SKU, and Edit/Delete Icons */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700">
                        {item.category?.name || "General"}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="font-mono text-[10px] font-semibold text-gray-400 truncate">
                        {item.sku}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        type="button"
                        onClick={() => onEdit?.(item)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 active:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Product"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => onDelete?.(item)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 active:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Product Title & Stock Status Row */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <button 
                        type="button"
                        onClick={() => onViewInsights?.(item.id, "OVERVIEW")}
                        className="font-bold text-gray-900 hover:text-indigo-600 text-left transition-colors text-sm leading-snug line-clamp-1 cursor-pointer"
                      >
                        {item.name}
                      </button>

                      {/* Financial info: Cost Rate & Asset Value */}
                      <div className="flex items-center gap-1.5 mt-1 text-xs flex-wrap">
                        <span className="text-gray-500 font-medium">
                          Rate: <strong className="text-gray-900">₹{item.costPrice.toLocaleString()}</strong>
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[11px]">
                          Asset: ₹{totalValuation.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Stock Count Pill */}
                    <div className="text-right shrink-0">
                      <span className={`inline-block px-2.5 py-1 rounded-xl text-xs font-black font-mono ${
                        isOutOfStock 
                          ? "bg-rose-50 text-rose-700" 
                          : isLowStock 
                          ? "bg-amber-50 text-amber-800" 
                          : "bg-emerald-50 text-emerald-800"
                      }`}>
                        {item.currentStock} Units
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Alert at: {item.lowStockAlertAt}
                      </p>
                    </div>
                  </div>

                  {/* Defective Warning Tag if any */}
                  {defectiveUnits > 0 && (
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-rose-50/70 text-[11px] text-rose-800">
                      <span className="flex items-center gap-1 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                        {defectiveUnits} Defective in Warehouse
                      </span>
                      <span className="font-bold text-rose-700">₹{defectiveValuation.toLocaleString()} Loss</span>
                    </div>
                  )}

                  {/* Single Clean Stock Action Button (Opens full stock action popup) */}
                  <div className="pt-2 border-t border-gray-50 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveActionItem(item)}
                      className="flex-1 py-2.5 px-4 bg-indigo-50/80 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Boxes className="w-4 h-4 text-indigo-600 stroke-[2.2]" />
                      <span>Update Stock / Actions</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => onViewInsights?.(item.id, "OVERVIEW")}
                      className="py-2.5 px-3 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="View Analytics & Trends"
                    >
                      <BarChart2 className="w-4 h-4 text-gray-500" />
                      <span>Overview</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* 📱 Mobile Stock Action Bottom Sheet (createPortal)             */}
      {/* ============================================================== */}
      {mounted && activeActionItem && createPortal(
        <div 
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 transition-opacity animate-in fade-in"
          onClick={() => setActiveActionItem(null)}
        >
          <div 
            className="bg-white rounded-t-3xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4 relative animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Pill */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto" />

            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Update Stock Options
                </span>
                <h3 className="text-base font-bold text-gray-900 truncate mt-0.5">
                  {activeActionItem.name}
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Current Stock: <strong className="text-gray-900">{activeActionItem.currentStock} Units</strong>
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setActiveActionItem(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors touch-manipulation cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Clear Action Buttons */}
            <div className="flex flex-col gap-2.5">
              {/* Option 1: Stock In */}
              <button
                type="button"
                onClick={() => {
                  const item = activeActionItem;
                  setActiveActionItem(null);
                  onStockAction(item, "IN");
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 hover:bg-emerald-100 active:scale-[0.99] transition-all text-left touch-manipulation cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm shadow-emerald-200">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Stock IN (Restock)</p>
                    <p className="text-xs text-emerald-700">Add received or purchased inventory</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-600" />
              </button>

              {/* Option 2: Stock Out */}
              <button
                type="button"
                onClick={() => {
                  const item = activeActionItem;
                  setActiveActionItem(null);
                  onStockAction(item, "OUT");
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200/80 hover:bg-rose-100 active:scale-[0.99] transition-all text-left touch-manipulation cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-sm shadow-rose-200">
                    <Minus className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Stock OUT (Sale / Dispatch)</p>
                    <p className="text-xs text-rose-700">Deduct sold or dispatched orders</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-rose-600" />
              </button>

              {/* Option 3: Returns */}
              <button
                type="button"
                onClick={() => {
                  const item = activeActionItem;
                  setActiveActionItem(null);
                  onStockAction(item, "RETURN");
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-orange-50/80 border border-orange-200/80 hover:bg-orange-100 active:scale-[0.99] transition-all text-left touch-manipulation cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold shadow-sm shadow-orange-200">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Log Return (Wapsi / RTO)</p>
                    <p className="text-xs text-orange-700">Handle returned, damaged, or RTO goods</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-orange-600" />
              </button>

              {/* Option 4: Ledger History */}
              <button
                type="button"
                onClick={() => {
                  const item = activeActionItem;
                  setActiveActionItem(null);
                  onViewInsights?.(item.id, "HISTORY");
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 hover:bg-indigo-100 active:scale-[0.99] transition-all text-left touch-manipulation cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm shadow-indigo-200">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Ledger History & Undo</p>
                    <p className="text-xs text-indigo-700">Audit logs & revert mistaken stock entries</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-indigo-600" />
              </button>

              {/* Option 5: SKU Overview & Analytics */}
              <button
                type="button"
                onClick={() => {
                  const item = activeActionItem;
                  setActiveActionItem(null);
                  onViewInsights?.(item.id, "OVERVIEW");
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/80 hover:bg-blue-100 active:scale-[0.99] transition-all text-left touch-manipulation cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-200">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">SKU Overview & Analytics</p>
                    <p className="text-xs text-blue-700">Sales vs returns trend chart & channels</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-blue-600" />
              </button>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={() => setActiveActionItem(null)}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-colors touch-manipulation cursor-pointer mt-1"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
