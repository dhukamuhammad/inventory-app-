"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { addProduct, addCategory, updateCategory, deleteCategory } from "@/app/actions/inventory";
import { CustomDropdown, DropdownItem } from "@/components/ui/CustomDropdown";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: DropdownItem[];
}

export function AddProductModal({ isOpen, onClose, categories }: AddProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!categoryId) return alert("Please select a category");
    
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      sku: formData.get("sku") as string,
      categoryId,
      costPrice: 0, // Starts at 0, updated automatically via Weighted Average Cost on Stock IN
      lowStockAlertAt: Number(formData.get("lowStockAlertAt")),
    };

    try {
      await addProduct(data);
      setCategoryId("");
      onClose(); // Close modal on success
    } catch (error) {
      console.error("Failed to add product:", error);
      alert("Error adding product. Ensure SKU is unique.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Product">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
          <input
            type="text"
            name="name"
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert Limit</label>
          <input
            type="number"
            name="lowStockAlertAt"
            required
            min="0"
            defaultValue="5"
            placeholder="e.g., 5"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Jab stock is quantity se kam hoga toh WhatsApp low stock alert aayega.
          </p>
        </div>

        <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-100 text-xs text-blue-700 flex items-start gap-2">
          <span>💡</span>
          <span>
            <strong>Note:</strong> Stock aur khareed bhav (Purchase Price) jab naya maal aayega tab <strong>Stock IN</strong> karte waqt add hoga.
          </span>
        </div>

        <div className="mt-2 flex justify-end gap-3">
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
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
