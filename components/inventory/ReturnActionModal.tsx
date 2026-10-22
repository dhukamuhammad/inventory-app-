"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { processReturns, addPlatform, updatePlatform, deletePlatform } from "@/app/actions/inventory";
import { CustomDropdown, DropdownItem } from "@/components/ui/CustomDropdown";

interface ReturnActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: { id: string; name: string } | null;
  platforms: DropdownItem[];
}

export function ReturnActionModal({ isOpen, onClose, product, platforms }: ReturnActionModalProps) {
  const [loading, setLoading] = useState(false);
  const [platformId, setPlatformId] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!product) return;
    
    if (!platformId) {
      return alert("Please select a platform for return");
    }
    
    const formData = new FormData(e.currentTarget);
    const rtoGood = Number(formData.get("rtoGood")) || 0;
    const rtoDefective = Number(formData.get("rtoDefective")) || 0;
    const customerGood = Number(formData.get("customerGood")) || 0;
    const customerDefective = Number(formData.get("customerDefective")) || 0;

    const totalReturns = rtoGood + rtoDefective + customerGood + customerDefective;

    if (totalReturns <= 0) {
      return alert("Please enter at least 1 return quantity.");
    }

    setLoading(true);
    try {
      await processReturns({
        productId: product.id,
        platformId,
        returns: {
          rtoGood,
          rtoDefective,
          customerGood,
          customerDefective,
        }
      });
      setPlatformId("");
      onClose(); // Close on success
    } catch (error) {
      console.error("Failed to process return:", error);
      alert("Error processing return.");
    } finally {
      setLoading(false);
    }
  }

  if (!product) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Return Stock (Wapas Aaya Maal)"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        
        <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
          <p className="text-sm text-orange-600 font-medium">Returning Product</p>
          <p className="font-semibold text-gray-900">{product.name}</p>
        </div>

        <CustomDropdown
          label="Platform / Market (Required)"
          items={platforms}
          value={platformId}
          onChange={setPlatformId}
          onAdd={addPlatform}
          onEdit={updatePlatform}
          onDelete={deletePlatform}
          placeholder="Select Platform..."
          required
        />

        <div className="space-y-4 border-t border-gray-100 pt-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 bg-gray-50 p-2 rounded">
              📦 RTO (Courier Returns)
            </h4>
            <div className="space-y-3 px-2">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-gray-700 flex-1">
                  Good Condition
                  <span className="block text-xs text-gray-400">Adds to Normal Stock</span>
                </label>
                <input
                  type="number"
                  name="rtoGood"
                  min="0"
                  placeholder="0"
                  className="w-20 px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 text-center"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-gray-700 flex-1">
                  Damaged in Transit
                  <span className="block text-xs text-gray-400">Adds to Defective Stock</span>
                </label>
                <input
                  type="number"
                  name="rtoDefective"
                  min="0"
                  placeholder="0"
                  className="w-20 px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 text-center"
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 bg-gray-50 p-2 rounded">
              👤 Customer Returns
            </h4>
            <div className="space-y-3 px-2">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-gray-700 flex-1">
                  Good Condition
                  <span className="block text-xs text-gray-400">Adds to Normal Stock</span>
                </label>
                <input
                  type="number"
                  name="customerGood"
                  min="0"
                  placeholder="0"
                  className="w-20 px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 text-center"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-gray-700 flex-1">
                  Defective / Damaged
                  <span className="block text-xs text-gray-400">Adds to Defective Stock</span>
                </label>
                <input
                  type="number"
                  name="customerDefective"
                  min="0"
                  placeholder="0"
                  className="w-20 px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 text-center"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 bg-orange-600 hover:bg-orange-700 focus:ring-orange-500"
          >
            {loading ? "Saving..." : "Process Return"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
