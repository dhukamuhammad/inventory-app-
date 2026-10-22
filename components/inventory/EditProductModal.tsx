"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { updateProduct, addCategory, updateCategory, deleteCategory } from "@/app/actions/inventory";
import { CustomDropdown, DropdownItem } from "@/components/ui/CustomDropdown";
import { Product } from "@prisma/client";

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: DropdownItem[];
  product: Product | null;
}

export function EditProductModal({ isOpen, onClose, categories, product }: EditProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (product) {
      setCategoryId(product.categoryId);
    }
  }, [product]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!product) return;
    if (!categoryId) return alert("Please select a category");
    
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      sku: formData.get("sku") as string,
      categoryId,
      costPrice: Number(formData.get("costPrice")),
      lowStockAlertAt: Number(formData.get("lowStockAlertAt")),
    };

    try {
      await updateProduct(product.id, data);
      onClose(); // Close modal on success
    } catch (error) {
      console.error("Failed to update product:", error);
      alert("Error updating product. Ensure SKU is unique.");
    } finally {
      setLoading(false);
    }
  }

  if (!product) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Product">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
          <input
            type="text"
            name="name"
            defaultValue={product.name}
            required
            placeholder="e.g., Black Polo T-Shirt"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SKU (Barcode/Code)</label>
          <input
            type="text"
            name="sku"
            defaultValue={product.sku}
            required
            placeholder="e.g., TS-BLK-M"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 uppercase"
          />
        </div>

        <CustomDropdown
          label="Category"
          items={categories}
          value={categoryId}
          onChange={setCategoryId}
          onAdd={addCategory}
          onEdit={updateCategory}
          onDelete={deleteCategory}
          placeholder="Select a category..."
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (₹)</label>
            <input
              type="number"
              step="0.01"
              name="costPrice"
              defaultValue={product.costPrice}
              required
              min="0"
              placeholder="e.g., 500"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Limit</label>
            <input
              type="number"
              name="lowStockAlertAt"
              defaultValue={product.lowStockAlertAt}
              required
              min="0"
              placeholder="e.g., 10"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
