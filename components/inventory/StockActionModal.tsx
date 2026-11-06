"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { updateStock, addPlatform, updatePlatform, deletePlatform } from "@/app/actions/inventory";
import { CustomDropdown, DropdownItem } from "@/components/ui/CustomDropdown";
import { 
  Calculator, 
  Handshake, 
  Store, 
  User, 
  ShoppingBag, 
  Building2, 
  Gift, 
  UserCheck, 
  AlertTriangle, 
  FileText,
  PackageCheck,
  PackagePlus,
  DollarSign
} from "lucide-react";

interface StockActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: { id: string; name: string; currentStock?: number; costPrice?: number } | null;
  type: "IN" | "OUT";
  platforms: DropdownItem[];
}

export function StockActionModal({ isOpen, onClose, product, type, platforms }: StockActionModalProps) {
  const [loading, setLoading] = useState(false);
  const [outMode, setOutMode] = useState<"MANUAL" | "ONLINE">("MANUAL");
  const [platformId, setPlatformId] = useState("");
  const [qtyInput, setQtyInput] = useState("");
  const [costInput, setCostInput] = useState("");

  // Manual Handover / Given To Fields
  const [recipientName, setRecipientName] = useState("");
  const [handoverReason, setHandoverReason] = useState("Local Sale");
  const [sellingRate, setSellingRate] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [extraNote, setExtraNote] = useState("");

  // Stock IN Supplier Field
  const [supplierName, setSupplierName] = useState("");

  // Online Order ID Field
  const [orderId, setOrderId] = useState("");

  const resetForm = () => {
    setOutMode("MANUAL");
    setPlatformId("");
    setQtyInput("");
    setCostInput("");
    setRecipientName("");
    setHandoverReason("Local Sale");
    setSellingRate("");
    setRefNumber("");
    setExtraNote("");
    setSupplierName("");
    setOrderId("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!product) return;

    const quantity = Number(qtyInput);
    if (!quantity || quantity <= 0) {
      alert("Kripya valid quantity daalein (kam se kam 1 piece).");
      return;
    }

    if (type === "OUT") {
      if (outMode === "ONLINE" && !platformId) {
        alert("Please select a platform for online dispatch.");
        return;
      }
      if (outMode === "MANUAL" && !recipientName.trim()) {
        alert("Kisko diya uska naam likhein (Party / Person Name is required).");
        return;
      }
    }

    setLoading(true);

    const unitCost = costInput ? Number(costInput) : undefined;

    // Build structured descriptive note
    let note: string | undefined = undefined;

    if (type === "OUT") {
      if (outMode === "MANUAL") {
        const parts = [
          `Given To: ${recipientName.trim()}`,
          handoverReason ? `Type: ${handoverReason}` : "",
          sellingRate ? `Rate: ₹${sellingRate}/pc` : "",
          refNumber ? `Ref: ${refNumber.trim()}` : "",
          extraNote ? `Note: ${extraNote.trim()}` : "",
        ].filter(Boolean);
        note = parts.join(" | ");
      } else {
        const parts = [
          orderId ? `Order: ${orderId.trim()}` : "",
          extraNote ? `Note: ${extraNote.trim()}` : "",
        ].filter(Boolean);
        note = parts.length > 0 ? parts.join(" | ") : undefined;
      }
    } else {
      // IN
      const parts = [
        supplierName ? `Supplier: ${supplierName.trim()}` : "",
        extraNote ? `Note: ${extraNote.trim()}` : "",
      ].filter(Boolean);
      note = parts.length > 0 ? parts.join(" | ") : undefined;
    }

    const data = {
      productId: product.id,
      type,
      quantity,
      unitCost: type === "IN" ? unitCost : undefined,
      platformId: type === "OUT" && outMode === "ONLINE" ? platformId : undefined,
      note,
    };

    try {
      await updateStock(data);
      resetForm();
      onClose();
    } catch (error) {
      console.error("Failed to update stock:", error);
      alert("Error updating stock.");
    } finally {
      setLoading(false);
    }
  }

  if (!product) return null;

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

  const isLowStockWarning = type === "OUT" && enteredQty > oldQty;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={
        type === "IN" 
          ? "Stock IN (Maal Aaya / Restock)" 
          : "Stock OUT (Manual Handover / Dispatch)"
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        
        {/* Product Info Banner (Native Theme Card) */}
        <div className="bg-gradient-to-br from-gray-50 to-indigo-50/40 p-3.5 rounded-2xl border border-gray-150 flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Product</p>
            <p className="font-bold text-gray-900 text-sm truncate">{product.name}</p>
          </div>
          <div className="text-right shrink-0">
            <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg ${
              oldQty > 0 ? "bg-indigo-50 text-indigo-700 border border-indigo-200/50" : "bg-rose-50 text-rose-700 border border-rose-200/50"
            }`}>
              {oldQty} in Stock
            </span>
            <p className="text-[10px] text-gray-500 mt-1 font-mono">
              Cost: ₹{oldCost}
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* STOCK OUT: Smart Mode Segmented Control (Native Theme)   */}
        {/* ======================================================== */}
        {type === "OUT" && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 p-1 bg-gray-100/90 rounded-2xl border border-gray-200/60">
              <button
                type="button"
                onClick={() => setOutMode("MANUAL")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  outMode === "MANUAL"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Handshake className="w-4 h-4 text-indigo-600" />
                <span>Direct / Person</span>
              </button>
              <button
                type="button"
                onClick={() => setOutMode("ONLINE")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  outMode === "ONLINE"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Store className="w-4 h-4 text-rose-600" />
                <span>Marketplace</span>
              </button>
            </div>
            <p className="text-[10px] text-gray-400 px-1">
              {outMode === "MANUAL" 
                ? "🤝 Kisi person, local shop, sample ya wholesale party ko diya gaya maal."
                : "📦 Amazon, Flipkart ya Meesho par single order dispatch."}
            </p>
          </div>
        )}

        {/* Quantity Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-gray-700">
              Quantity (Kitne Piece {type === "IN" ? "Aaye?" : "Nikale / Diye?"}) *
            </label>
            {type === "OUT" && (
              <span className="text-[10px] text-gray-400 font-mono">
                Max available: <strong>{oldQty}</strong>
              </span>
            )}
          </div>
          <input
            type="number"
            name="quantity"
            required
            min="1"
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            placeholder={type === "IN" ? "e.g., 50" : "e.g., 5"}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50/80 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono font-semibold text-gray-900 shadow-2xs"
          />
          {isLowStockWarning && (
            <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Dhyan dein: Entered quantity available stock ({oldQty}) se zyada hai.</span>
            </p>
          )}
        </div>

        {/* ======================================================== */}
        {/* STOCK OUT: MANUAL HANDOVER FIELDS                        */}
        {/* ======================================================== */}
        {type === "OUT" && outMode === "MANUAL" && (
          <div className="space-y-3 pt-1">
            {/* Kisko Diya (Party / Person Name) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Kisko Diya? (Party / Person / Customer Name) *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Ramesh Bhai (Shop), Sharma Traders, Walk-in..."
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-gray-50/80 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium text-gray-900 placeholder:text-gray-400 shadow-2xs"
                />
              </div>
            </div>

            {/* Handover Reason Chips */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Handover Type / Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "Local Sale", label: "Local Sale", icon: ShoppingBag },
                  { id: "Wholesale", label: "B2B / Wholesale", icon: Building2 },
                  { id: "Sample", label: "Sample / Gift", icon: Gift },
                  { id: "Self Use", label: "Personal / Staff", icon: UserCheck },
                  { id: "Damage/Loss", label: "Broken / Scrap", icon: AlertTriangle },
                ].map((chip) => {
                  const Icon = chip.icon;
                  const isSelected = handoverReason === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setHandoverReason(chip.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-700 border-indigo-300 font-bold shadow-2xs"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="w-3 h-3 text-indigo-500" />
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selling Rate & Bill/Ref No (2 Columns) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Selling Rate (₹ / piece)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sellingRate}
                    onChange={(e) => setSellingRate(e.target.value)}
                    placeholder="e.g. 250"
                    className="w-full pl-7 pr-3 py-2 text-xs bg-gray-50/80 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Bill / Challan No.
                </label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    placeholder="e.g. Inv #104 / Cash"
                    className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50/80 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Extra Note / Remark */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Extra Note / Remarks (Optional)
              </label>
              <input
                type="text"
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                placeholder="e.g. Returnable sample, advance ₹500 received..."
                className="w-full px-3 py-2 text-xs bg-gray-50/80 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-gray-400"
              />
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STOCK OUT: ONLINE MARKETPLACE FIELDS                     */}
        {/* ======================================================== */}
        {type === "OUT" && outMode === "ONLINE" && (
          <div className="space-y-3 pt-1">
            <CustomDropdown
              label="Platform / Market *"
              items={platforms}
              value={platformId}
              onChange={setPlatformId}
              onAdd={addPlatform}
              onEdit={updatePlatform}
              onDelete={deletePlatform}
              placeholder="Select Platform (Amazon, Flipkart, etc.)..."
              required
            />

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Order ID / AWB (Optional)
              </label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="e.g. OD123456789 or 341588..."
                className="w-full px-3 py-2 text-xs bg-gray-50/80 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Remarks / Note (Optional)
              </label>
              <input
                type="text"
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                placeholder="e.g. Priority dispatch..."
                className="w-full px-3 py-2 text-xs bg-gray-50/80 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STOCK IN: Restock Purchase Fields                        */}
        {/* ======================================================== */}
        {type === "IN" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Purchase Rate / Bhav (₹ per piece) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="unitCost"
                  required
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  placeholder="e.g., 60"
                  className="w-full pl-7 pr-3 py-2.5 text-xs sm:text-sm bg-gray-50/80 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono font-semibold"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Yeh rate purane bache stock ke sath milkar automatic Average Cost banayega.
              </p>
            </div>

            {/* Supplier / Vendor Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Supplier / Kahan se aaya? (Optional)
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. ABC Factory, Surat Vendor..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50/80 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Live WAC Calculation Preview Box */}
            {enteredQty > 0 && enteredCost > 0 && newAvgCost !== null && (
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3.5 flex flex-col gap-1.5 text-xs animate-in fade-in">
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

                <p className="text-[10px] text-emerald-700/80 mt-1 pt-1.5 border-t border-emerald-200/60 font-mono">
                  [({oldQty} old × ₹{oldCost}) + ({enteredQty} new × ₹{enteredCost})] ÷ {newTotalQty} units
                </p>
              </div>
            )}
          </div>
        )}

        {/* Buttons (Native Theme) */}
        <div className="mt-2 pt-2 border-t border-gray-150 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer ${
              type === "IN" 
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/20" 
                : "bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-600/20"
            }`}
          >
            {loading ? (
              <span>Saving...</span>
            ) : type === "IN" ? (
              <>
                <PackagePlus className="w-4 h-4" />
                <span>Add Stock (Restock)</span>
              </>
            ) : (
              <>
                <PackageCheck className="w-4 h-4" />
                <span>{outMode === "MANUAL" ? "Confirm Handover" : "Dispatch Stock"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

