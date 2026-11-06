"use client";

import { useState, useEffect } from "react";
import {
  X,
  Plus,
  GitFork,
  Check,
  AlertTriangle,
  Loader2,
  Package,
  Layers,
  Search,
} from "lucide-react";
import { addSkuMappings, updateSkuMapping } from "@/app/actions/inventory";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
}

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductOption[];
  initialProductId?: string | null;
  editMapping?: {
    id: string;
    channelSku: string;
    platform: string;
    multiplier: number;
    productId: string;
  } | null;
  onSuccess?: () => void;
}

export function MappingModal({
  isOpen,
  onClose,
  products,
  initialProductId,
  editMapping,
  onSuccess,
}: MappingModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [platform, setPlatform] = useState<string>("MEESHO");
  const [skuInput, setSkuInput] = useState<string>("");
  const [skuList, setSkuList] = useState<string[]>([]);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editMapping) {
        setSelectedProductId(editMapping.productId);
        setPlatform(editMapping.platform || "MEESHO");
        setSkuList([editMapping.channelSku]);
        setSkuInput("");
        setMultiplier(editMapping.multiplier || 1);
      } else {
        setSelectedProductId(initialProductId || (products.length > 0 ? products[0].id : ""));
        setPlatform("MEESHO");
        setSkuList([]);
        setSkuInput("");
        setMultiplier(1);
      }
      setErrorMessage(null);
      setProductSearch("");
      setIsDropdownOpen(false);
    }
  }, [isOpen, editMapping, initialProductId, products]);

  if (!isOpen) return null;

  const handleAddSku = (inputVal?: string) => {
    const val = (inputVal !== undefined ? inputVal : skuInput).trim();
    if (!val) return;

    // Support comma or whitespace separated pasting
    const splitted = val
      .split(/[,;\n]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    const updated = [...skuList];
    for (const item of splitted) {
      if (!updated.includes(item)) {
        updated.push(item);
      }
    }

    setSkuList(updated);
    setSkuInput("");
  };

  const handleRemoveSku = (indexToRemove: number) => {
    setSkuList(skuList.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddSku();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // If there's pending text in input, add it first
    let currentSkus = [...skuList];
    if (skuInput.trim()) {
      const val = skuInput.trim().toUpperCase();
      if (!currentSkus.includes(val)) {
        currentSkus.push(val);
      }
    }

    if (!selectedProductId) {
      setErrorMessage("Kripya ek inventory product select karein.");
      return;
    }

    if (currentSkus.length === 0) {
      setErrorMessage("Kam se kam ek Portal / Channel SKU add karein.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editMapping) {
        await updateSkuMapping(editMapping.id, {
          channelSku: currentSkus[0],
          platform,
          multiplier,
          productId: selectedProductId,
        });
      } else {
        await addSkuMappings({
          productId: selectedProductId,
          channelSkus: currentSkus,
          platform,
          multiplier,
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to save SKU mappings. Please check if SKU already exists.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full sm:max-w-lg bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Mobile Pull Bar */}
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-xs shrink-0">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 leading-tight">
                {editMapping ? "Edit Portal SKU Mapping" : "Decode & Link Channel SKUs"}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Multiple portal listings ko 1 warehouse product se jodein
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-800 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Master Product Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-indigo-600" />
              Warehouse Master Product
            </label>

            {/* Custom Searchable Product Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full p-3 rounded-2xl bg-gray-50 hover:bg-gray-100/70 text-left border border-gray-200/60 text-xs flex items-center justify-between transition-colors cursor-pointer"
              >
                {selectedProduct ? (
                  <div>
                    <span className="font-bold text-gray-900 block truncate">
                      {selectedProduct.name}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Master SKU: <strong className="text-gray-600 font-mono">{selectedProduct.sku}</strong> | Stock: {selectedProduct.currentStock}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-400">Select an Inventory Product...</span>
                )}
                <span className="text-xs text-gray-400 ml-2">▼</span>
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-30 max-h-56 overflow-y-auto space-y-1">
                  <div className="p-1 sticky top-0 bg-white">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search product or SKU..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-gray-50 text-xs border border-gray-200 focus:outline-none focus:border-indigo-400"
                        autoFocus
                      />
                    </div>
                  </div>

                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400">
                      Koi product nahi mila
                    </div>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full p-2.5 rounded-xl text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                          selectedProductId === p.id
                            ? "bg-indigo-50 text-indigo-900 font-semibold"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                            {p.sku} (Stock: {p.currentStock})
                          </p>
                        </div>
                        {selectedProductId === p.id && (
                          <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Platform Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              Listing Platform
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "MEESHO", label: "Meesho", color: "pink" },
                { id: "FLIPKART", label: "Flipkart", color: "blue" },
                { id: "AMAZON", label: "Amazon", color: "amber" },
                { id: "ALL", label: "All / Any", color: "purple" },
              ].map((p) => {
                const isSelected = platform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      isSelected
                        ? p.color === "pink"
                          ? "bg-pink-100/80 text-pink-700 ring-2 ring-pink-400 shadow-xs"
                          : p.color === "blue"
                          ? "bg-blue-100/80 text-blue-700 ring-2 ring-blue-400 shadow-xs"
                          : p.color === "amber"
                          ? "bg-amber-100/80 text-amber-800 ring-2 ring-amber-400 shadow-xs"
                          : "bg-purple-100/80 text-purple-700 ring-2 ring-purple-400 shadow-xs"
                        : "bg-gray-50 hover:bg-gray-100 text-gray-600"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Multi-SKU Input with Chips */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700">
                Portal / Channel SKU(s)
              </label>
              <span className="text-[10px] text-gray-400">
                Comma `,` ya Enter dabakar add karein
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/60 focus-within:border-indigo-400 focus-within:bg-white transition-all space-y-2">
              {/* Added SKU Chips */}
              {skuList.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {skuList.map((sku, idx) => (
                    <span
                      key={sku}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white text-gray-800 border border-gray-200 shadow-2xs animate-in zoom-in-95 duration-150"
                    >
                      {sku}
                      <button
                        type="button"
                        onClick={() => handleRemoveSku(idx)}
                        className="text-gray-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. SCV-SSSPM-700-1, SCV-SSSPM-700-2..."
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent text-xs text-gray-900 focus:outline-none placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => handleAddSku()}
                  disabled={!skuInput.trim()}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Ek hi product ke Meesho par alag-alag listing codes (jaise 700-1, 700-2, 700-3) yahan add karein.
            </p>
          </div>

          {/* 4. Pack Multiplier (Combo Support) */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50/70 border border-gray-100 text-xs">
            <div>
              <span className="font-bold text-gray-800 block">Unit Multiplier</span>
              <span className="text-[11px] text-gray-400">
                1 order aane par inventory se kitne pieces minus honge?
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {[1, 2, 3, 4].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setMultiplier(qty)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    multiplier === qty
                      ? "bg-indigo-600 text-white shadow-xs scale-105"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {qty}x
                </button>
              ))}
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving Mappings...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Save SKU Mappings
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
