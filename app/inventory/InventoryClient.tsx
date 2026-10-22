"use client";

import { useState } from "react";
import { Plus, Package } from "lucide-react";
import { Product, Category } from "@prisma/client";
import { DesktopTable } from "@/components/inventory/DesktopTable";
import { MobileCardList } from "@/components/inventory/MobileCardList";
import { AddProductModal } from "@/components/inventory/AddProductModal";
import { EditProductModal } from "@/components/inventory/EditProductModal";
import { StockActionModal } from "@/components/inventory/StockActionModal";
import { ReturnActionModal } from "@/components/inventory/ReturnActionModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownItem } from "@/components/ui/CustomDropdown";
import { deleteProduct } from "@/app/actions/inventory";
import { ProductInsightsDrawer } from "@/components/inventory/ProductInsightsDrawer";

type ProductWithCategory = Product & { category: Category };

interface InventoryClientProps {
  products: ProductWithCategory[];
  categories: DropdownItem[];
  platforms: DropdownItem[];
}

export function InventoryClient({ products, categories, platforms }: InventoryClientProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [insightsProductId, setInsightsProductId] = useState<string | null>(null);
  const [insightsInitialTab, setInsightsInitialTab] = useState<"OVERVIEW" | "PLATFORMS" | "HISTORY">("OVERVIEW");

  const handleOpenInsights = (productId: string, tab: "OVERVIEW" | "PLATFORMS" | "HISTORY" = "OVERVIEW") => {
    setInsightsInitialTab(tab);
    setInsightsProductId(productId);
  };
  
  const [stockModal, setStockModal] = useState<{
    isOpen: boolean;
    product: ProductWithCategory | null;
    type: "IN" | "OUT" | "RETURN";
  }>({
    isOpen: false,
    product: null,
    type: "IN",
  });

  const [returnModal, setReturnModal] = useState<{
    isOpen: boolean;
    product: ProductWithCategory | null;
  }>({
    isOpen: false,
    product: null,
  });

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    product: ProductWithCategory | null;
  }>({
    isOpen: false,
    product: null,
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    product: ProductWithCategory | null;
    loading: boolean;
  }>({
    isOpen: false,
    product: null,
    loading: false,
  });

  const handleStockAction = (product: ProductWithCategory, type: "IN" | "OUT" | "RETURN") => {
    if (type === "RETURN") {
      setReturnModal({ isOpen: true, product });
    } else {
      setStockModal({ isOpen: true, product, type });
    }
  };

  const handleEdit = (product: ProductWithCategory) => {
    setEditModal({ isOpen: true, product });
  };

  const handleDeleteClick = (product: ProductWithCategory) => {
    setDeleteDialog({ isOpen: true, product, loading: false });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.product) return;
    setDeleteDialog((prev) => ({ ...prev, loading: true }));
    try {
      await deleteProduct(deleteDialog.product.id);
      setDeleteDialog({ isOpen: false, product: null, loading: false });
    } catch (error) {
      console.error("Failed to delete product:", error);
      alert("Error deleting product.");
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const lowStockCount = products.filter((p) => p.currentStock <= p.lowStockAlertAt).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 📱 Mobile App Header (md:hidden) */}
      <div className="md:hidden flex items-center justify-between pt-1">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
            <Package className="w-3.5 h-3.5 text-blue-600" />
            {products.length} Products
            {lowStockCount > 0 && ` • ${lowStockCount} Low`}
          </span>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Inventory</h1>
        </div>
        <button 
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 bg-blue-600 active:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm shadow-blue-200 transition-all active:scale-95 touch-manipulation cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* 🖥️ Desktop Header (hidden md:flex) — Exact Original Design */}
      <div className="hidden md:flex justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1">Manage your products and stock</p>
        </div>
        <button 
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all active:scale-95 shadow-sm shadow-blue-200 cursor-pointer touch-manipulation"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </button>
      </div>

      {/* Desktop Table View */}
      <DesktopTable 
        products={products} 
        onStockAction={handleStockAction}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onViewInsights={handleOpenInsights}
      />

      {/* Mobile Card List View */}
      <MobileCardList 
        products={products} 
        categories={categories}
        onStockAction={handleStockAction}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onViewInsights={handleOpenInsights}
      />

      {/* Modals & Drawers */}
      <ProductInsightsDrawer
        productId={insightsProductId}
        initialTab={insightsInitialTab}
        onClose={() => setInsightsProductId(null)}
      />

      <AddProductModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        categories={categories}
      />

      <EditProductModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ ...editModal, isOpen: false })}
        categories={categories}
        product={editModal.product}
      />
      
      <StockActionModal 
        isOpen={stockModal.isOpen} 
        onClose={() => setStockModal({ ...stockModal, isOpen: false })} 
        product={stockModal.product} 
        type={stockModal.type as "IN" | "OUT"} 
        platforms={platforms}
      />

      <ReturnActionModal
        isOpen={returnModal.isOpen}
        onClose={() => setReturnModal({ ...returnModal, isOpen: false })}
        product={returnModal.product}
        platforms={platforms}
      />

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
        onConfirm={confirmDelete}
        title="Delete Product"
        description={`Are you sure you want to delete "${deleteDialog.product?.name}"? All stock history associated with this product will be permanently lost.`}
        confirmText="Delete Product"
        isDestructive={true}
        loading={deleteDialog.loading}
      />
    </div>
  );
}

