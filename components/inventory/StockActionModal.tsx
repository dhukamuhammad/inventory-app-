"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { updateStock, addPlatform, updatePlatform, deletePlatform } from "@/app/actions/inventory";
import { CustomDropdown, DropdownItem } from "@/components/ui/CustomDropdown";
import { Calculator } from "lucide-react";

interface StockActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: { id: string; name: string; currentStock?: number; costPrice?: number } | null;
  type: "IN" | "OUT";
  platforms: DropdownItem[];
}

export function StockActionModal({ isOpen, onClose, product, type, platforms }: StockActionModalProps) {
  const [loading, setLoading] = useState(false);
  const [platformId, setPlatformId] = useState("");
  const [qtyInput, setQtyInput] = useState("");
  const [costInput, setCostInput] = useState("");

  const resetForm = () => {
    setPlatformId("");
    setQtyInput("");
    setCostInput("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!product) return;
    
    if (type === "OUT" && !platformId) {
      return alert("Please select a platform for dispatch");
    }
    
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const quantity = Number(formData.get("quantity"));
    const unitCostRaw = formData.get("unitCost");
    const unitCost = unitCostRaw ? Number(unitCostRaw) : undefined;

    const data = {
      productId: product.id,
      type,
      quantity,
      unitCost: type === "IN" ? unitCost : undefined,
      platformId: type === "OUT" ? platformId : undefined,
    };

    try {
      await updateStock(data);
      resetForm();
      onClose(); // Close on success
    } catch (error) {
      console.error("Failed to update stock:", error);
      alert("Error updating stock.");
    } finally {
      setLoading(false);
    }
  }

  if (!product) return null;

  // Live Weighted Average Cost Calculation Preview
  const oldQty = product.currentStock ?? 0;
  const oldCost = product.costPrice ?? 0;
  const enteredQty = Number(qtyInput);
  const enteredCost = Number(costInput);

  let newTotalQty = oldQty;
  let newAvgCost: number | null = null;

  if (type === "IN" && enteredQty > 0) {
    newTotalQty = oldQty + enteredQty;
    if (enteredCost > 0) {
      if (oldQty <= 0 || oldCost <= 0) {
        newAvgCost = enteredCost;
      } else {
        const oldVal = oldQty * oldCost;
        const newVal = enteredQty * enteredCost;
        newAvgCost = Number(((oldVal + newVal) / newTotalQty).toFixed(2));
      }
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={type === "IN" ? "Stock IN (Maal Aaya / Restock)" : "Stock OUT (Order Dispatch)"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        {/* Product Info Banner */}
        <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Product</p>
            <p className="font-bold text-gray-900 text-sm">{product.name}</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
              {oldQty} in Stock
            </span>
            <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
              Current Cost: ₹{oldCost}
            </p>
          </div>
        </div>

        {/* Quantity Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity (Kitne Piece {type === "IN" ? "Aaye?" : "Bheje?"})
          </label>
          <input
            type="number"
            name="quantity"
            required
            min="1"
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            placeholder={type === "IN" ? "e.g., 50" : "e.g., 5"}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Stock IN: Purchase Rate / Cost Price Input */}
        {type === "IN" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Rate / Bhav (₹ per piece)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="unitCost"
              required
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              placeholder="e.g., 60"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Yeh rate purane bache stock ke sath milkar automatic Average Cost banayega.
            </p>
          </div>
        )}

        {/* Live WAC Calculation Preview Box */}
        {type === "IN" && enteredQty > 0 && enteredCost > 0 && newAvgCost !== null && (
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold mb-0.5">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span>Weighted Average Calculation (Preview)</span>
            </div>

            <div className="flex justify-between items-center text-emerald-950 font-medium">
              <span>Naya Total Stock:</span>
              <span className="font-mono font-bold text-sm">{newTotalQty} Units</span>
            </div>

            <div className="flex justify-between items-center text-emerald-950 font-medium">
              <span>Naya Average Cost Price:</span>
              <span className="font-mono font-bold text-sm text-emerald-700">₹{newAvgCost.toFixed(2)} / unit</span>
            </div>

            <p className="text-[10px] text-emerald-700/80 mt-1 pt-1.5 border-t border-emerald-200/60">
              Calculation: [({oldQty} old × ₹{oldCost}) + ({enteredQty} new × ₹{enteredCost})] ÷ {newTotalQty} total units
            </p>
          </div>
        )}

        {/* Stock OUT: Platform Selection */}
        {type === "OUT" && (
          <CustomDropdown
            label="Platform / Market"
            items={platforms}
            value={platformId}
            onChange={setPlatformId}
            onAdd={addPlatform}
            onEdit={updatePlatform}
            onDelete={deletePlatform}
            placeholder="Select Platform (Amazon, Flipkart, etc.)..."
            required
          />
        )}

        {/* Buttons */}
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 cursor-pointer ${
              type === "IN" 
                ? "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500" 
                : "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500"
            }`}
          >
            {loading ? "Saving..." : type === "IN" ? "Add Stock (Restock)" : "Dispatch Stock"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
