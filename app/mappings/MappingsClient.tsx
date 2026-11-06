"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  GitFork,
  Search,
  Plus,
  Package,
  Layers,
  Trash2,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  Filter,
  Boxes,
  Truck,
  ArrowRight,
} from "lucide-react";
import { MappingModal } from "@/components/mappings/MappingModal";
import { deleteSkuMapping } from "@/app/actions/inventory";

interface SkuMappingItem {
  id: string;
  channelSku: string;
  platform: string;
  multiplier: number;
  productId: string;
  createdAt: Date | string;
}

interface ProductWithMappings {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  category: {
    id: string;
    name: string;
  };
  mappings: SkuMappingItem[];
}

interface MappingsClientProps {
  initialProducts: ProductWithMappings[];
}

export function MappingsClient({ initialProducts }: MappingsClientProps) {
  const [products, setProducts] = useState<ProductWithMappings[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetProductId, setTargetProductId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Statistics
  const totalMasterProducts = products.length;
  const totalMappings = useMemo(() => {
    return products.reduce((acc, p) => acc + p.mappings.length, 0);
  }, [products]);

  const meeshoCount = useMemo(() => {
    return products.reduce(
      (acc, p) => acc + p.mappings.filter((m) => m.platform === "MEESHO").length,
      0
    );
  }, [products]);

  const flipkartCount = useMemo(() => {
    return products.reduce(
      (acc, p) => acc + p.mappings.filter((m) => m.platform === "FLIPKART").length,
      0
    );
  }, [products]);

  const amazonCount = useMemo(() => {
    return products.reduce(
      (acc, p) => acc + p.mappings.filter((m) => m.platform === "AMAZON").length,
      0
    );
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        prod.name.toLowerCase().includes(q) ||
        prod.sku.toLowerCase().includes(q) ||
        prod.mappings.some((m) => m.channelSku.toLowerCase().includes(q));

      const matchesPlatform =
        selectedPlatform === "ALL" ||
        prod.mappings.some((m) => m.platform === selectedPlatform);

      return matchesSearch && matchesPlatform;
    });
  }, [products, searchQuery, selectedPlatform]);

  const handleDeleteMapping = async (mappingId: string, productId: string) => {
    setDeletingId(mappingId);
    try {
      await deleteSkuMapping(mappingId);
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === productId) {
            return {
              ...p,
              mappings: p.mappings.filter((m) => m.id !== mappingId),
            };
          }
          return p;
        })
      );
    } catch (err) {
      console.error("Failed to delete mapping:", err);
      alert("Mapping delete nahi ho saki. Kripya dubara koshish karein.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenAddModal = (prodId?: string) => {
    setTargetProductId(prodId || null);
    setIsModalOpen(true);
  };

  const productOptions = useMemo(() => {
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      currentStock: p.currentStock,
    }));
  }, [products]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-28 animate-in fade-in duration-200">
      {/* ============================================================== */}
      {/* 📱 1. MOBILE HEADER (md:hidden)                                */}
      {/* ============================================================== */}
      <div className="md:hidden flex items-center justify-between pt-1 gap-2">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700">
            <GitFork className="w-3.5 h-3.5 text-purple-600" />
            {totalMappings} Active Listings Mapped
          </span>
          <h1 className="text-xl font-bold text-gray-900 mt-1 truncate">
            SKU Mappings
          </h1>
        </div>
        <button
          type="button"
          onClick={() => handleOpenAddModal()}
          className="inline-flex items-center gap-1.5 bg-indigo-600 active:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-sm shadow-indigo-200 transition-all active:scale-95 touch-manipulation cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Link SKU</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* 🖥️ 1. DESKTOP HEADER (hidden md:flex) — Matches Dispatch Hist   */}
      {/* ============================================================== */}
      <div className="hidden md:flex justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SKU Channel Mappings</h1>
          <p className="text-gray-500 mt-1">
            Ek hi warehouse product ki Meesho, Flipkart ya Amazon par multiple listings ko link aur manage karein
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="inline-flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95 shadow-xs cursor-pointer"
          >
            <Boxes className="w-4 h-4 text-indigo-600" />
            Manage Inventory
          </Link>
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95 shadow-xs shadow-indigo-200 cursor-pointer text-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Link New Channel SKU
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📱 2. Mobile Metrics Strip (md:hidden)                         */}
      {/* ============================================================== */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
        <div className="bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm shrink-0 flex items-center gap-1.5 text-xs">
          <span className="text-[10px] uppercase font-bold text-gray-400">Products</span>
          <span className="font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded-md">
            {totalMasterProducts}
          </span>
        </div>
        <div className="bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm shrink-0 flex items-center gap-1.5 text-xs">
          <span className="text-[10px] uppercase font-bold text-purple-600">Total SKUs</span>
          <span className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md">
            {totalMappings}
          </span>
        </div>
        <div className="bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm shrink-0 flex items-center gap-1.5 text-xs">
          <span className="text-[10px] uppercase font-bold text-pink-600">Meesho</span>
          <span className="font-bold text-pink-700 bg-pink-50 px-1.5 py-0.5 rounded-md">
            {meeshoCount}
          </span>
        </div>
        <div className="bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm shrink-0 flex items-center gap-1.5 text-xs">
          <span className="text-[10px] uppercase font-bold text-blue-600">Flipkart</span>
          <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
            {flipkartCount}
          </span>
        </div>
        <div className="bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm shrink-0 flex items-center gap-1.5 text-xs">
          <span className="text-[10px] uppercase font-bold text-amber-600">Amazon</span>
          <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md">
            {amazonCount}
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 🖥️ 2. DESKTOP SUMMARY CARDS GRID (hidden md:grid)              */}
      {/* ============================================================== */}
      <div className="hidden md:grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Master Products</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalMasterProducts}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Portal SKUs</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{totalMappings}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <GitFork className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Meesho Listings</p>
            <p className="text-2xl font-bold text-pink-600 mt-1">{meeshoCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Flipkart & Amazon</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{flipkartCount + amazonCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 🖥️ 3. DESKTOP FILTER BAR (hidden md:block)                     */}
      {/* ============================================================== */}
      <div className="hidden md:block bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name, master SKU, or channel code..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { id: "ALL", label: `All Portals (${totalMappings})` },
              { id: "MEESHO", label: `Meesho (${meeshoCount})` },
              { id: "FLIPKART", label: `Flipkart (${flipkartCount})` },
              { id: "AMAZON", label: `Amazon (${amazonCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedPlatform(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedPlatform === tab.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📱 3. Mobile Search & Filter Chips (md:hidden)                 */}
      {/* ============================================================== */}
      <div className="md:hidden flex flex-col gap-2.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {[
            { id: "ALL", label: `All (${totalMappings})` },
            { id: "MEESHO", label: `Meesho (${meeshoCount})` },
            { id: "FLIPKART", label: `Flipkart (${flipkartCount})` },
            { id: "AMAZON", label: `Amazon (${amazonCount})` },
          ].map((tab) => {
            const isSelected = selectedPlatform === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedPlatform(tab.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all touch-manipulation cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white text-gray-600 border border-gray-100 hover:bg-gray-50 shadow-sm"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📱 4. MOBILE CARDS FEED (md:hidden) — 100% Native Unchanged    */}
      {/* ============================================================== */}
      <div className="md:hidden space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 sm:p-10 text-center border border-gray-100 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <GitFork className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900">Koi SKU Mapping nahi mili</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? "Aapke search query se milta julta koi product ya portal code nahi mila."
                  : "Aapke products me abhi koi channel listings mapped nahi hain. Nayi mapping jodne ke liye upar button dabayein."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors cursor-pointer"
            >
              + Link First Portal SKU
            </button>
          </div>
        ) : (
          filteredProducts.map((prod) => {
            const mappingsToShow =
              selectedPlatform === "ALL"
                ? prod.mappings
                : prod.mappings.filter((m) => m.platform === selectedPlatform);

            return (
              <div
                key={prod.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-col gap-3 transition-all active:border-indigo-200"
              >
                {/* Header: Master Product Info + One Clean Top Action */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900 leading-tight">
                        {prod.name}
                      </h3>
                      {prod.category?.name && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {prod.category.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-gray-400 text-[11px]">Master:</span>
                        <strong className="text-gray-700 font-mono text-[11px] bg-gray-50 px-1.5 py-0.5 rounded-md font-bold">
                          {prod.sku}
                        </strong>
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="text-gray-400 text-[11px]">Stock:</span>
                        <strong
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            prod.currentStock > 10
                              ? "text-emerald-800 bg-emerald-50"
                              : prod.currentStock > 0
                              ? "text-amber-800 bg-amber-50"
                              : "text-rose-700 bg-rose-50"
                          }`}
                        >
                          {prod.currentStock} units
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Single Clean "+ Link" Button on Card */}
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal(prod.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold transition-all active:scale-95 cursor-pointer shrink-0"
                    title="Link marketplace SKU to this product"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Link</span>
                  </button>
                </div>

                {/* Marketplace Listings Section */}
                <div className="pt-2 border-t border-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <Layers className="w-3 h-3 text-gray-400" />
                      Marketplace Listings ({prod.mappings.length})
                    </span>
                  </div>

                  {prod.mappings.length === 0 ? (
                    /* Clean Soft Empty Box (NO black border, matching Inventory style) */
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(prod.id)}
                      className="w-full p-2.5 rounded-xl bg-gray-50 hover:bg-purple-50/50 text-gray-400 hover:text-purple-700 text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>No channel SKUs linked yet • Tap to link</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      {mappingsToShow.map((m) => {
                        const isMeesho = m.platform === "MEESHO";
                        const isFlipkart = m.platform === "FLIPKART";
                        const isAmazon = m.platform === "AMAZON";

                        return (
                          <div
                            key={m.id}
                            className={`inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-xl text-xs transition-all ${
                              isMeesho
                                ? "bg-pink-50 text-pink-900"
                                : isFlipkart
                                ? "bg-blue-50 text-blue-900"
                                : isAmazon
                                ? "bg-amber-50 text-amber-900"
                                : "bg-purple-50 text-purple-900"
                            }`}
                          >
                            <span
                              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                                isMeesho
                                  ? "bg-pink-100 text-pink-700"
                                  : isFlipkart
                                  ? "bg-blue-100 text-blue-700"
                                  : isAmazon
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {m.platform}
                            </span>

                            <span className="font-mono font-bold text-xs text-gray-800">{m.channelSku}</span>

                            {m.multiplier > 1 && (
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-md">
                                {m.multiplier}x
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteMapping(m.id, prod.id)}
                              disabled={deletingId === m.id}
                              title="Delete this listing mapping"
                              className="w-5 h-5 rounded-md flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-100/60 transition-colors cursor-pointer ml-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ============================================================== */}
      {/* 🖥️ 4. DESKTOP TABLE VIEW (hidden md:block) — Dispatch Hist Style*/}
      {/* ============================================================== */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center bg-white flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <GitFork className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Koi SKU Mapping Nahi Mili</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">
              {searchQuery
                ? "Aapke search query se milta julta koi master product ya portal SKU nahi mila."
                : "Aapke catalog me abhi koi portal listings mapped nahi hain. Nayi mapping jodne ke liye '+ Link New Channel SKU' dabayein."}
            </p>
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors cursor-pointer"
            >
              + Link First Portal SKU
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">Product & Category</th>
                <th className="py-3.5 px-4">Master SKU</th>
                <th className="py-3.5 px-4">Current Stock</th>
                <th className="py-3.5 px-4">Mapped Channel Listings</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredProducts.map((prod) => {
                const mappingsToShow =
                  selectedPlatform === "ALL"
                    ? prod.mappings
                    : prod.mappings.filter((m) => m.platform === selectedPlatform);

                return (
                  <tr
                    key={prod.id}
                    className="hover:bg-indigo-50/30 transition-colors group"
                  >
                    {/* 1. Product & Category */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <Package className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className="font-bold text-gray-900 truncate max-w-[240px]"
                            title={prod.name}
                          >
                            {prod.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {prod.category?.name ? (
                              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700">
                                {prod.category.name}
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400">General</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Master SKU */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="inline-block px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-gray-100 text-gray-800 border border-gray-200/60">
                        {prod.sku}
                      </span>
                    </td>

                    {/* 3. Current Stock Status */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          prod.currentStock > 10
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : prod.currentStock > 0
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            prod.currentStock > 10
                              ? "bg-emerald-500"
                              : prod.currentStock > 0
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                        />
                        {prod.currentStock} Units
                      </span>
                    </td>

                    {/* 4. Mapped Channel SKU Listings */}
                    <td className="py-4 px-4">
                      {mappingsToShow.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">
                          No portal SKUs mapped yet
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-xl">
                          {mappingsToShow.map((m) => {
                            const isMeesho = m.platform === "MEESHO";
                            const isFlipkart = m.platform === "FLIPKART";
                            const isAmazon = m.platform === "AMAZON";

                            return (
                              <div
                                key={m.id}
                                className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-xl text-xs border transition-all ${
                                  isMeesho
                                    ? "bg-pink-50 text-pink-900 border-pink-100"
                                    : isFlipkart
                                    ? "bg-blue-50 text-blue-900 border-blue-100"
                                    : isAmazon
                                    ? "bg-amber-50 text-amber-900 border-amber-100"
                                    : "bg-purple-50 text-purple-900 border-purple-100"
                                }`}
                              >
                                <span
                                  className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                                    isMeesho
                                      ? "bg-pink-100 text-pink-700"
                                      : isFlipkart
                                      ? "bg-blue-100 text-blue-700"
                                      : isAmazon
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-purple-100 text-purple-700"
                                  }`}
                                >
                                  {m.platform}
                                </span>

                                <span className="font-mono font-bold text-xs text-gray-800">
                                  {m.channelSku}
                                </span>

                                {m.multiplier > 1 && (
                                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-md">
                                    {m.multiplier}x
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteMapping(m.id, prod.id)}
                                  disabled={deletingId === m.id}
                                  title="Delete this mapping"
                                  className="w-5 h-5 rounded-md flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-100/60 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* 5. Actions */}
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(prod.id)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Link SKU</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Dialog for Adding / Managing Mappings */}
      <MappingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        products={productOptions}
        initialProductId={targetProductId}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
