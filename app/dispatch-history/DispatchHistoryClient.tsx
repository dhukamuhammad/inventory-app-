"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Search,
  Truck,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Package,
  Layers,
  Boxes,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  X,
  Copy,
  Check,
  MapPin,
  ShoppingBag,
  Zap,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import {
  DispatchBatchItem,
  getDispatchBatchDetails,
  revertDispatchBatch,
} from "@/app/actions/dispatch";
import { useRouter } from "next/navigation";

interface DispatchHistoryClientProps {
  initialBatches: DispatchBatchItem[];
}

export function DispatchHistoryClient({
  initialBatches,
}: DispatchHistoryClientProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [batches, setBatches] = useState<DispatchBatchItem[]>(initialBatches);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string>("ALL");

  // Detailed batch drawer states
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchDetails, setBatchDetails] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailTab, setDetailTab] = useState<"ORDERS" | "SUMMARY">("ORDERS");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Revert confirmation state
  const [revertingBatch, setRevertingBatch] = useState<DispatchBatchItem | null>(
    null
  );
  const [isReverting, setIsReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Body scroll lock when drawer is active
  useEffect(() => {
    if (activeBatchId || revertingBatch) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [activeBatchId, revertingBatch]);

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    }
  };

  const handleOpenDetails = async (batchId: string) => {
    setActiveBatchId(batchId);
    setIsLoadingDetails(true);
    setBatchDetails(null);
    setDetailTab("ORDERS");
    try {
      const details = await getDispatchBatchDetails(batchId);
      setBatchDetails(details);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleConfirmRevert = async () => {
    if (!revertingBatch) return;
    setIsReverting(true);
    setRevertError(null);

    try {
      const res = await revertDispatchBatch(revertingBatch.id);
      if (!res.success) {
        throw new Error(res.error || "Failed to revert dispatch batch");
      }

      setFeedbackMessage(
        res.message ||
          `Batch "${revertingBatch.fileName}" successfully revert ho gaya!`
      );
      // Update local state
      setBatches((prev) =>
        prev.map((b) =>
          b.id === revertingBatch.id
            ? { ...b, status: "REVERTED", revertedAt: new Date() }
            : b
        )
      );

      if (batchDetails && batchDetails.id === revertingBatch.id) {
        setBatchDetails((prev: any) => ({
          ...prev,
          status: "REVERTED",
          revertedAt: new Date(),
        }));
      }

      setRevertingBatch(null);
      router.refresh();
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      setRevertError(err.message || "Error reverting batch.");
    } finally {
      setIsReverting(false);
    }
  };

  // Channel counts for filter pills (active vs reverted)
  const activeBatches = batches.filter((b) => b.status !== "REVERTED");
  const activeBatchesCount = activeBatches.length;

  const meeshoCount = batches.filter(
    (b) => b.channel.toUpperCase() === "MEESHO" && b.status !== "REVERTED"
  ).length;
  const flipkartCount = batches.filter(
    (b) => b.channel.toUpperCase() === "FLIPKART" && b.status !== "REVERTED"
  ).length;
  const amazonCount = batches.filter(
    (b) => b.channel.toUpperCase() === "AMAZON" && b.status !== "REVERTED"
  ).length;
  const revertedCount = batches.filter((b) => b.status === "REVERTED").length;

  // Filtered batches
  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      b.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.channel.toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedChannel === "REVERTED") {
      return matchesSearch && b.status === "REVERTED";
    }

    if (selectedChannel === "ALL") {
      return matchesSearch && b.status !== "REVERTED";
    }

    return (
      matchesSearch &&
      b.channel.toUpperCase() === selectedChannel.toUpperCase() &&
      b.status !== "REVERTED"
    );
  });

  // Calculate totals
  const totalBatchesCount = batches.length;
  const totalOrdersDispatched = batches
    .filter((b) => b.status === "CONFIRMED")
    .reduce((sum, b) => sum + b.totalOrders, 0);
  const totalUnitsDispatched = batches
    .filter((b) => b.status === "CONFIRMED")
    .reduce((sum, b) => sum + b.totalUnits, 0);

  // Extract parsed couriers for active batch
  let activeCourierEntries: [string, number][] = [];
  try {
    if (batchDetails?.courierSummary) {
      activeCourierEntries = Object.entries(
        JSON.parse(batchDetails.courierSummary)
      );
    }
  } catch {}

  // Extract parsed SKU summary items for active batch
  let activeSkuItems: any[] = [];
  try {
    if (batchDetails?.skuSummary) {
      activeSkuItems = JSON.parse(batchDetails.skuSummary);
    }
  } catch {}

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Feedback banner */}
      {feedbackMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-semibold text-emerald-800 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 📱 1. MOBILE HEADER (md:hidden) — Synchronized with App Theme   */}
      {/* ============================================================== */}
      <div className="md:hidden flex items-center justify-between pt-1">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync
          </span>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Dispatch History</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href="/inventory"
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl active:bg-indigo-100 transition-colors"
          >
            <Boxes className="w-4 h-4" />
            Inventory
          </Link>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📱 2. Mobile Compact Summary Strip (App Style Micro-Ticker)     */}
      {/* ============================================================== */}
      <div className="md:hidden bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
        <div className="grid grid-cols-3 divide-x divide-gray-100 text-center">
          <div className="px-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> PDFs
            </p>
            <p className="font-mono font-black text-gray-900 text-base mt-0.5">
              {totalBatchesCount}
            </p>
            <p className="text-[9px] text-gray-400">Batches</p>
          </div>

          <div className="px-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Orders
            </p>
            <p className="font-mono font-black text-blue-700 text-base mt-0.5">
              {totalOrdersDispatched}
            </p>
            <p className="text-[9px] text-gray-400">Dispatched</p>
          </div>

          <div className="px-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Units
            </p>
            <p className="font-mono font-black text-emerald-700 text-base mt-0.5">
              {totalUnitsDispatched}
            </p>
            <p className="text-[9px] text-gray-400">Deducted</p>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📱 3. Mobile Search Input (Consistent with MobileCardList)     */}
      {/* ============================================================== */}
      <div className="md:hidden relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by PDF name or platform..."
          className="w-full pl-10 pr-9 py-2.5 bg-white border border-gray-200/90 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
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

      {/* ============================================================== */}
      {/* 📱 4. Mobile Filter Chips (Consistent with MobileCardList)     */}
      {/* ============================================================== */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedChannel("ALL")}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all touch-manipulation cursor-pointer ${
            selectedChannel === "ALL"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-100 hover:bg-gray-50"
          }`}
        >
          All ({activeBatchesCount})
        </button>

        {meeshoCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedChannel("MEESHO")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all touch-manipulation cursor-pointer ${
              selectedChannel === "MEESHO"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-100 hover:bg-gray-50"
            }`}
          >
            Meesho ({meeshoCount})
          </button>
        )}

        {flipkartCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedChannel("FLIPKART")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all touch-manipulation cursor-pointer ${
              selectedChannel === "FLIPKART"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-100 hover:bg-gray-50"
            }`}
          >
            Flipkart ({flipkartCount})
          </button>
        )}

        {amazonCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedChannel("AMAZON")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all touch-manipulation cursor-pointer ${
              selectedChannel === "AMAZON"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-100 hover:bg-gray-50"
            }`}
          >
            Amazon ({amazonCount})
          </button>
        )}

        {revertedCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedChannel("REVERTED")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all touch-manipulation cursor-pointer ${
              selectedChannel === "REVERTED"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-50 text-rose-700 border border-rose-100"
            }`}
          >
            Reverted ({revertedCount})
          </button>
        )}
      </div>

      {/* ============================================================== */}
      {/* 🖥️ DESKTOP HEADER (hidden md:flex)                             */}
      {/* ============================================================== */}
      <div className="hidden md:flex justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispatch History</h1>
          <p className="text-gray-500 mt-1">
            Track all uploaded shipping label PDFs, delivery partners, and batch dispatches
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
          <Link
            href="/movements"
            className="inline-flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95 shadow-xs cursor-pointer"
          >
            <Layers className="w-4 h-4 text-gray-500" />
            Stock Ledger
          </Link>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 🖥️ DESKTOP SUMMARY CARDS GRID                                  */}
      {/* ============================================================== */}
      <div className="hidden md:grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Total PDF Batches</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalBatchesCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Dispatched Orders</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{totalOrdersDispatched}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Units Shipped</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{totalUnitsDispatched}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 🖥️ DESKTOP FILTER BAR                                          */}
      {/* ============================================================== */}
      <div className="hidden md:block bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by PDF file name or channel..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {["ALL", "MEESHO", "FLIPKART", "AMAZON", "REVERTED"].map((ch) => {
              const count =
                ch === "ALL"
                  ? activeBatchesCount
                  : ch === "REVERTED"
                  ? revertedCount
                  : ch === "MEESHO"
                  ? meeshoCount
                  : ch === "FLIPKART"
                  ? flipkartCount
                  : amazonCount;

              if (ch !== "ALL" && count === 0) return null;

              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setSelectedChannel(ch)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedChannel === ch
                      ? ch === "REVERTED"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-indigo-600 text-white shadow-xs"
                      : ch === "REVERTED"
                      ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span>{ch === "ALL" ? "All Channels" : ch}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      selectedChannel === ch
                        ? "bg-white/20 text-white"
                        : ch === "REVERTED"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📱 5. MOBILE CARDS FEED (md:hidden) — Pure Theme Based         */}
      {/* ============================================================== */}
      <div className="md:hidden flex flex-col gap-3 pb-24">
        {filteredBatches.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Koi Batch Nahi Mila</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              {batches.length === 0
                ? "Inventory page se 'Dispatch' button dabakar shipping label PDF upload karein."
                : "Search query ya filter reset karke dekhein."}
            </p>
          </div>
        ) : (
          filteredBatches.map((batch) => {
            let courierObj: Record<string, number> = {};
            try {
              if (batch.courierSummary) {
                courierObj = JSON.parse(batch.courierSummary);
              }
            } catch {}

            const isReverted = batch.status === "REVERTED";

            return (
              <div
                key={batch.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-all active:border-indigo-200 p-3.5 gap-2.5"
              >
                {/* Top: Category/Platform Pill, date, and status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700">
                      {batch.channel}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-[10px] font-medium text-gray-400">
                      {new Date(batch.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                      ,{" "}
                      {new Date(batch.createdAt).toLocaleTimeString("en-IN", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div>
                    {isReverted ? (
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700">
                        Reverted
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        Dispatched
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Count Row */}
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3
                      className="font-bold text-gray-900 text-sm leading-snug line-clamp-1"
                      title={batch.fileName}
                    >
                      {batch.fileName}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {batch.totalOrders} Orders •{" "}
                      <span className="text-gray-800 font-semibold">
                        {batch.totalUnits} Units Out
                      </span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-black font-mono bg-indigo-50 text-indigo-700">
                      {batch.totalUnits} Pcs
                    </span>
                  </div>
                </div>

                {/* Courier Partner Tags */}
                {Object.keys(courierObj).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(courierObj).map(([courier, count]) => (
                      <span
                        key={courier}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-50 text-gray-700 border border-gray-100"
                      >
                        <Truck className="w-3 h-3 text-gray-400" />
                        <span>{courier}:</span>
                        <strong className="text-gray-900">{count}</strong>
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions Row */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-50">
                  <button
                    type="button"
                    onClick={() => handleOpenDetails(batch.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {!isReverted && (
                    <button
                      type="button"
                      onClick={() => setRevertingBatch(batch)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-100 transition-colors cursor-pointer"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Undo</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ============================================================== */}
      {/* 🖥️ 6. DESKTOP TABLE VIEW (hidden md:block)                     */}
      {/* ============================================================== */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              <th className="py-3.5 px-5">File & Channel</th>
              <th className="py-3.5 px-4">Date & Time</th>
              <th className="py-3.5 px-4">Orders & Units</th>
              <th className="py-3.5 px-4">Delivery Partners</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {filteredBatches.map((batch) => {
              let courierObj: Record<string, number> = {};
              try {
                if (batch.courierSummary) {
                  courierObj = JSON.parse(batch.courierSummary);
                }
              } catch {}

              const isReverted = batch.status === "REVERTED";

              return (
                <tr
                  key={batch.id}
                  className={`hover:bg-indigo-50/30 transition-colors ${
                    isReverted ? "bg-gray-50/50 opacity-75" : ""
                  }`}
                >
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isReverted
                            ? "bg-gray-100 text-gray-400"
                            : "bg-indigo-50 text-indigo-600"
                        }`}
                      >
                        <FileText className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="font-bold text-gray-900 truncate max-w-[220px]"
                          title={batch.fileName}
                        >
                          {batch.fileName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700">
                            {batch.channel}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono truncate max-w-[100px]">
                            ID: {batch.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-medium">
                        {new Date(batch.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 pl-5">
                      {new Date(batch.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">
                        {batch.totalOrders} Orders
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700">
                        {batch.totalUnits} Units
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1 max-w-[240px]">
                      {Object.keys(courierObj).length > 0 ? (
                        Object.entries(courierObj).map(([courier, count]) => (
                          <span
                            key={courier}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-50 text-gray-700 border border-gray-100"
                          >
                            <Truck className="w-3 h-3 text-gray-400" />
                            <span className="truncate max-w-[90px]">
                              {courier}
                            </span>
                            <span className="font-bold text-gray-900">
                              ({count})
                            </span>
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 text-xs">
                          Auto-Dispatched
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    {isReverted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <RotateCcw className="w-3 h-3" />
                        Reverted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Dispatched
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(batch.id)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {!isReverted && (
                        <button
                          type="button"
                          onClick={() => setRevertingBatch(batch)}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                          title="Revert entire dispatch batch and restore stock"
                        >
                          <Undo2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Undo</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ============================================================== */}
      {/* 📱 7. NATIVE APP SLIDE-IN DRAWER (Matches ProductInsightsDrawer) */}
      {/* ============================================================== */}
      {mounted &&
        activeBatchId &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[80] transition-opacity animate-in fade-in"
              onClick={() => setActiveBatchId(null)}
            />

            {/* Full Slide-In Drawer (Full Screen on Mobile, Side Drawer on Desktop) */}
            <div className="fixed inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-[680px] bg-gray-50 z-[90] flex flex-col shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-right duration-200">
              {/* Drawer Top Navigation Bar */}
              <div className="bg-white px-4 py-3.5 border-b border-gray-100 shrink-0 shadow-2xs">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setActiveBatchId(null)}
                      className="p-1.5 -ml-1 text-gray-700 hover:text-gray-900 active:bg-gray-100 rounded-full transition-colors cursor-pointer shrink-0"
                      title="Back"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700">
                          {batchDetails?.channel || "BATCH"}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-[11px] font-medium text-gray-400">
                          {batchDetails &&
                            `${batchDetails.totalOrders} Orders • ${batchDetails.totalUnits} Units`}
                        </span>
                      </div>
                      <h2
                        className="text-sm sm:text-base font-bold text-gray-900 truncate leading-tight mt-0.5"
                        title={batchDetails?.fileName}
                      >
                        {batchDetails ? batchDetails.fileName : "Loading Batch..."}
                      </h2>
                    </div>
                  </div>

                  {batchDetails && batchDetails.status === "CONFIRMED" && (
                    <button
                      type="button"
                      onClick={() => setRevertingBatch(batchDetails)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Undo Dispatch</span>
                    </button>
                  )}
                </div>

                {/* Segmented Pill Switcher Tabs */}
                <div className="mt-3 grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setDetailTab("ORDERS")}
                    className={`py-2 px-1 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      detailTab === "ORDERS"
                        ? "bg-indigo-600 text-white shadow-sm font-bold"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Orders List ({batchDetails?.orders?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab("SUMMARY")}
                    className={`py-2 px-1 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      detailTab === "SUMMARY"
                        ? "bg-indigo-600 text-white shadow-sm font-bold"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>SKU Summary</span>
                  </button>
                </div>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {isLoadingDetails ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <p className="text-xs text-gray-500 font-medium">
                      Loading batch details & orders...
                    </p>
                  </div>
                ) : !batchDetails ? (
                  <div className="py-12 text-center text-xs text-gray-500">
                    Batch record not found.
                  </div>
                ) : (
                  <>
                    {/* Delivery Partner summary bar */}
                    {activeCourierEntries.length > 0 && (
                      <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5 shrink-0">
                          <Truck className="w-4 h-4 text-gray-400" />
                          Couriers:
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {activeCourierEntries.map(([c, count]) => (
                            <span
                              key={c}
                              className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-50 text-gray-700 border border-gray-100"
                            >
                              {c}: <strong className="text-gray-900 font-bold">{count}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB 1: ORDERS LIST                                       */}
                    {/* ======================================================== */}
                    {detailTab === "ORDERS" && (
                      <div className="space-y-3">
                        {batchDetails.orders.map((order: any, idx: number) => {
                          return (
                            <div
                              key={order.id}
                              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3"
                            >
                              {/* Order ID & Payment Pill */}
                              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-gray-100">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="font-mono font-bold text-gray-900 text-xs sm:text-sm truncate">
                                    {order.orderId}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {order.paymentType && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700">
                                      {order.paymentType}
                                    </span>
                                  )}
                                  {order.courier && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700">
                                      {order.courier}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Single-Line AWB tracking box with 1-tap copy button */}
                              {order.awb && (
                                <div className="bg-indigo-50/60 border border-indigo-100/70 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs font-mono">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-[11px] text-gray-500 font-sans">
                                      AWB:
                                    </span>
                                    <strong className="text-indigo-900 truncate">
                                      {order.awb}
                                    </strong>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(order.awb)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-indigo-200/60 text-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 text-[11px] font-bold transition-all shrink-0 cursor-pointer active:scale-95 shadow-2xs"
                                    title="Copy AWB number"
                                  >
                                    {copiedText === order.awb ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-emerald-700">Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* Buyer & Destination */}
                              {(order.customerName || order.destination) && (
                                <div className="flex flex-col gap-0.5 text-xs text-gray-500 pt-0.5">
                                  {order.customerName && (
                                    <p className="text-[11px]">
                                      Buyer:{" "}
                                      <strong className="text-gray-800">
                                        {order.customerName}
                                      </strong>
                                    </p>
                                  )}
                                  {order.destination && (
                                    <p className="text-[11px] text-gray-400 flex items-center gap-1 truncate">
                                      <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                                      <span className="truncate">
                                        {order.destination}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Order Items List */}
                              <div className="space-y-1.5 pt-1">
                                {order.items.map((it: any) => {
                                  const cleanChannel = (it.channelSku || "").toLowerCase().trim();
                                  const normChannel = cleanChannel.replace(/[^a-z0-9]/g, "");
                                  const cleanProduct = (it.product?.sku || "").toLowerCase().trim();
                                  const normProduct = cleanProduct.replace(/[^a-z0-9]/g, "");

                                  const isMapped = Boolean(
                                    it.product?.mappings?.some((m: any) => {
                                      const mChan = (m.channelSku || "").toLowerCase().trim();
                                      const mNorm = mChan.replace(/[^a-z0-9]/g, "");
                                      return mChan === cleanChannel || mNorm === normChannel;
                                    })
                                  );

                                  const isSubstituted = Boolean(
                                    cleanChannel &&
                                    cleanProduct &&
                                    cleanChannel !== cleanProduct &&
                                    normChannel !== normProduct &&
                                    !isMapped
                                  );

                                  return (
                                    <div
                                      key={it.id}
                                      className="bg-gray-50 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-mono font-bold text-gray-900 text-xs">
                                            {it.product?.sku || it.channelSku}
                                          </span>
                                          {isSubstituted && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                                              Substituted for {it.channelSku}
                                            </span>
                                          )}
                                          {!isSubstituted && isMapped && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">
                                              Mapped: {it.channelSku}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                          {it.product?.name || "Product Item"}
                                        </p>
                                      </div>

                                      <div className="text-right shrink-0">
                                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-white text-gray-900 border border-gray-200/60">
                                          Qty: {it.quantity}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB 2: SKU SUMMARY (Clean ScoviX Summary Cards)          */}
                    {/* ======================================================== */}
                    {detailTab === "SUMMARY" && (
                      <div className="space-y-3">
                        {/* Summary Header Card */}
                        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500 font-medium">
                              Distinct SKUs in Batch
                            </p>
                            <p className="text-xl font-bold text-gray-900 mt-0.5">
                              {activeSkuItems.length} Products
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500 font-medium">
                              Total Quantity Shipped
                            </p>
                            <p className="text-xl font-bold text-indigo-700 mt-0.5">
                              {batchDetails.totalUnits} Units
                            </p>
                          </div>
                        </div>

                        {/* SKU Items List */}
                        {activeSkuItems.length === 0 ? (
                          <div className="py-10 text-center text-xs text-gray-400 bg-white rounded-2xl border border-gray-100">
                            SKU summary not recorded in this batch.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {activeSkuItems.map((skuRow: any, i: number) => (
                              <div
                                key={i}
                                className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm flex items-center justify-between gap-2.5"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                      {skuRow.sku}
                                    </span>
                                    {skuRow.isSubstituted && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">
                                        Substituted
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-semibold text-gray-800 mt-1 truncate">
                                    {skuRow.name || "—"}
                                  </p>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="px-3 py-1.5 rounded-xl text-xs font-black font-mono bg-indigo-50 text-indigo-700">
                                    {skuRow.totalQuantity} Units
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="bg-white px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs shrink-0 shadow-xs">
                <span className="text-[11px] text-gray-400 font-mono truncate max-w-[200px]">
                  Batch ID: {batchDetails?.id}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveBatchId(null)}
                  className="px-5 py-2 bg-gray-900 active:bg-gray-800 text-white rounded-xl font-bold cursor-pointer transition-all active:scale-95"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </>,
          document.body
        )}

      {/* ============================================================== */}
      {/* ⚠️ 8. REVERT BATCH CONFIRMATION DIALOG (ScoviX Dialog Theme)   */}
      {/* ============================================================== */}
      {mounted &&
        revertingBatch &&
        createPortal(
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => !isReverting && setRevertingBatch(null)}
            />

            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-6 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Undo Dispatch Batch?
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Aap <strong>"{revertingBatch.fileName}"</strong> ke sabhi{" "}
                  <strong>{revertingBatch.totalOrders} orders</strong> ka dispatch
                  revert (undo) karne ja rahe hain.
                </p>
              </div>

              <div className="bg-rose-50/70 border border-rose-200/70 rounded-2xl p-3.5 text-xs text-rose-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-rose-800">
                  <RotateCcw className="w-3.5 h-3.5" /> Kya hoga:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-rose-800/90 text-[11px]">
                  <li>
                    Total <strong>{revertingBatch.totalUnits} product units</strong>{" "}
                    wapas inventory stock me add ho jayengi.
                  </li>
                  <li>Movements ledger se OUT entries delete ho jayengi.</li>
                  <li>Sabhi orders ka status Cancelled mark ho jayega.</li>
                </ul>
              </div>

              {revertError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
                  {revertError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isReverting}
                  onClick={() => setRevertingBatch(null)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isReverting}
                  onClick={handleConfirmRevert}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isReverting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Reverting Stock...</span>
                    </>
                  ) : (
                    <>
                      <Undo2 className="w-4 h-4" />
                      <span>Confirm & Restore Stock</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
