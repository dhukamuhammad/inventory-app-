"use client";

import { ArrowDownRight, ArrowUpRight, Pencil, Trash2, Undo2, MoreVertical, TrendingUp, History } from "lucide-react";
import { Product, Category } from "@prisma/client";
import { useState, useRef, useEffect } from "react";

type ProductWithCategory = Product & { category: Category };

function StockActionMenu({ 
  item, 
  onAction,
  onViewInsights 
}: { 
  item: ProductWithCategory; 
  onAction: (product: ProductWithCategory, type: "IN" | "OUT" | "RETURN") => void;
  onViewInsights?: (productId: string, tab?: "OVERVIEW" | "PLATFORMS" | "HISTORY") => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        title="Manage Stock"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.12)] border border-gray-100 z-50 py-1 overflow-hidden">
          <button 
            onClick={() => { onAction(item, "IN"); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 text-left transition-colors cursor-pointer"
          >
            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
            Stock IN
          </button>
          <button 
            onClick={() => { onAction(item, "OUT"); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-rose-50 hover:text-rose-700 text-left transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
            Stock OUT
          </button>
          <button 
            onClick={() => { onAction(item, "RETURN"); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-700 text-left transition-colors cursor-pointer"
          >
            <Undo2 className="w-4 h-4 text-orange-600" />
            Log Return
          </button>
          <button 
            onClick={() => { onViewInsights?.(item.id, "HISTORY"); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 text-left transition-colors border-t border-gray-100 cursor-pointer"
          >
            <History className="w-4 h-4 text-indigo-500" />
            Ledger History & Undo
          </button>
          <button 
            onClick={() => { onViewInsights?.(item.id, "OVERVIEW"); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 text-left transition-colors cursor-pointer"
          >
            <TrendingUp className="w-4 h-4 text-blue-500" />
            SKU Overview & Insights
          </button>
        </div>
      )}
    </div>
  );
}

interface DesktopTableProps {
  products: ProductWithCategory[];
  onStockAction: (product: ProductWithCategory, type: "IN" | "OUT" | "RETURN") => void;
  onEdit?: (product: ProductWithCategory) => void;
  onDelete?: (product: ProductWithCategory) => void;
  onViewInsights?: (productId: string, tab?: "OVERVIEW" | "PLATFORMS" | "HISTORY") => void;
}

export function DesktopTable({ products, onStockAction, onEdit, onDelete, onViewInsights }: DesktopTableProps) {
  return (
    <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
      <table className="w-full text-left">
        <thead className="bg-gray-50/50 border-b border-gray-100">
          <tr>
            <th className="px-6 py-4 font-medium text-gray-500">Product</th>
            <th className="px-6 py-4 font-medium text-gray-500">SKU</th>
            <th className="px-6 py-4 font-medium text-gray-500">Cost Price</th>
            <th className="px-6 py-4 font-medium text-gray-500">Stock</th>
            <th className="px-6 py-4 font-medium text-gray-500">Defective</th>
            <th className="px-6 py-4 font-medium text-gray-500 text-right">Manage</th>
            <th className="px-6 py-4 font-medium text-gray-500 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-6 py-4 align-top">
                <button 
                  onClick={() => onViewInsights?.(item.id, "OVERVIEW")}
                  className="font-semibold text-gray-900 hover:text-blue-600 text-left transition-colors flex items-center gap-1 group cursor-pointer"
                >
                  {item.name}
                  <TrendingUp className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <p className="text-sm text-gray-500">{item.category?.name}</p>
              </td>
              <td className="px-6 py-4 align-top text-gray-600 font-mono text-sm">{item.sku}</td>
              <td className="px-6 py-4 align-top text-gray-600">₹{item.costPrice.toLocaleString()}</td>
              <td className="px-6 py-4 align-top">
                <span className={`px-2.5 py-1 rounded-full text-sm font-medium whitespace-nowrap ${
                  item.currentStock > item.lowStockAlertAt ? 'bg-emerald-100 text-emerald-700' :
                  item.currentStock > 0 ? 'bg-rose-100 text-rose-700' : 
                  'bg-red-100 text-red-700'
                }`}>
                  {item.currentStock} Units
                </span>
                
                <p className={`text-xs mt-2 ${item.currentStock <= item.lowStockAlertAt ? 'text-rose-500 font-medium' : 'text-gray-400'}`}>
                  Limit: {item.lowStockAlertAt} {item.currentStock <= item.lowStockAlertAt && "(Low Stock!)"}
                </p>
              </td>
              <td className="px-6 py-4 align-top">
                {/* @ts-ignore */}
                {item.defectiveStock > 0 ? (
                  <span className="px-2.5 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-700 whitespace-nowrap inline-block">
                    {/* @ts-ignore */}
                    {item.defectiveStock} Units
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )}
              </td>
              <td className="px-6 py-4 align-top text-right">
                <StockActionMenu item={item} onAction={onStockAction} onViewInsights={onViewInsights} />
              </td>
              <td className="px-6 py-4 align-top text-right">
                <div className="flex justify-end gap-1 items-center">
                  <button 
                    onClick={() => onEdit?.(item)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Product"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onDelete?.(item)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Product"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                No products found. Add a product to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
