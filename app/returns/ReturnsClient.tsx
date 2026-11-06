"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  RotateCcw, 
  Search, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  User, 
  MapPin, 
  Copy, 
  Check, 
  Loader2, 
  Boxes, 
  Calendar, 
  Sparkles, 
  Camera, 
  Trash2, 
  Undo2, 
  X,
  ChevronRight,
  Zap
} from "lucide-react";
import { lookupReturnOrder, processOrderReturn, revertOrderReturn, getReturnsSummary, SearchOrderResult } from "@/app/actions/returns";
import { useRouter } from "next/navigation";
import { CameraScannerModal } from "@/components/returns/CameraScannerModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { sound } from "@/lib/sound";

interface ReturnsClientProps {
  initialSummary: {
    totalDispatched: number;
    totalReturns: number;
    todayReturnsCount: number;
    rtoCount: number;
    customerCount: number;
    goodConditionCount: number;
    defectiveConditionCount: number;
    recentReturns: any[];
    recentDispatches: any[];
  };
}

export default function ReturnsClient({ initialSummary }: ReturnsClientProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchOrderResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Return Processing State
  const [returnType, setReturnType] = useState<"RETURN_RTO" | "RETURN_CUSTOMER">("RETURN_RTO");
  const [condition, setCondition] = useState<"GOOD" | "DEFECTIVE">("GOOD");
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Live Ledger State & Revert (Delete) State
  const [recentReturnsList, setRecentReturnsList] = useState<any[]>(initialSummary.recentReturns || []);
  const [summaryStats, setSummaryStats] = useState(initialSummary);
  const [orderToRevert, setOrderToRevert] = useState<any | null>(null);
  const [isReverting, setIsReverting] = useState(false);

  // Sync state if server sends new initialSummary
  useEffect(() => {
    if (initialSummary) {
      setRecentReturnsList(initialSummary.recentReturns || []);
      setSummaryStats(initialSummary);
    }
  }, [initialSummary]);

  // Instant real-time handler for Rapid Mode bulk scans
  const handleRapidOrderProcessed = (processedOrder: any) => {
    if (!processedOrder) return;

    // Immediately place at the top of recentReturnsList
    setRecentReturnsList((prev) => [
      processedOrder,
      ...prev.filter((o) => o.id !== processedOrder.id),
    ]);

    // Live update header stats & chips
    setSummaryStats((prev) => ({
      ...prev,
      totalReturns: prev.totalReturns + 1,
      todayReturnsCount: prev.todayReturnsCount + 1,
      rtoCount: processedOrder.status === "RETURN_RTO" ? prev.rtoCount + 1 : prev.rtoCount,
      customerCount: processedOrder.status === "RETURN_CUSTOMER" ? prev.customerCount + 1 : prev.customerCount,
      goodConditionCount: processedOrder.condition === "GOOD" ? prev.goodConditionCount + 1 : prev.goodConditionCount,
      defectiveConditionCount: processedOrder.condition === "DEFECTIVE" ? prev.defectiveConditionCount + 1 : prev.defectiveConditionCount,
    }));
  };

  // Auto-sync when camera modal closes (zero manual refresh needed)
  const handleCloseScanner = async () => {
    setIsScannerOpen(false);
    try {
      const fresh = await getReturnsSummary();
      if (fresh) {
        setRecentReturnsList(fresh.recentReturns || []);
        setSummaryStats(fresh);
      }
    } catch (err) {
      console.warn("Silent sync error:", err);
      router.refresh();
    }
  };

  // Ledger Filter States
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"ALL" | "TODAY" | "7DAYS" | "MONTH">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "RTO" | "CUSTOMER" | "DEFECTIVE">("ALL");

  // Focus input on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) {
      searchInputRef.current?.focus();
    }
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const executeLookup = async (searchTerm: string) => {
    const clean = (searchTerm || "").trim();
    if (!clean) return;

    setSearching(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSearchResult(null);

    try {
      const res = await lookupReturnOrder(clean);
      if (!res.success) {
        sound.playErrorBeep();
        setErrorMessage(res.message || "Order nahi mila.");
      } else {
        if (res.order?.status !== "DISPATCHED") {
          sound.playDuplicateBeep();
        } else {
          sound.playSuccessBeep();
        }
        setSearchResult(res);
        if (res.smartRecommendation?.type === "CUSTOMER") {
          setReturnType("RETURN_CUSTOMER");
        } else {
          setReturnType("RETURN_RTO");
        }
      }
    } catch {
      sound.playErrorBeep();
      setErrorMessage("Network error while searching for order.");
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeLookup(query);
  };

  const handleScanResult = (scannedCode: string) => {
    setQuery(scannedCode);
    executeLookup(scannedCode);
  };

  const handleProcessReturn = async () => {
    if (!searchResult?.order) return;
    const orderId = searchResult.order.id;

    setProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await processOrderReturn({
        dispatchedOrderId: orderId,
        returnType,
        condition,
        note,
      });

      if (res.success) {
        const itemNames = searchResult.order.items
          ?.map((it: any) => `${it.product?.name || it.channelSku || "Item"} (x${it.quantity})`)
          .join(", ");

        sound.playSuccessBeep();
        setSuccessMessage(
          `✅ Return inward successful! ${itemNames} wapas ${
            condition === "GOOD" ? "Normal Stock" : "Defective Stock"
          } mein add ho gaya.`
        );

        const updatedOrderObj = {
          ...searchResult.order,
          status: returnType,
          condition,
          returnedAt: new Date(),
          returnNote: note,
        };

        setRecentReturnsList((prev) => [
          updatedOrderObj,
          ...prev.filter((o) => o.id !== searchResult.order.id),
        ]);

        setSummaryStats((prev) => ({
          ...prev,
          totalReturns: prev.totalReturns + 1,
          todayReturnsCount: prev.todayReturnsCount + 1,
          rtoCount: returnType === "RETURN_RTO" ? prev.rtoCount + 1 : prev.rtoCount,
          customerCount: returnType === "RETURN_CUSTOMER" ? prev.customerCount + 1 : prev.customerCount,
          goodConditionCount: condition === "GOOD" ? prev.goodConditionCount + 1 : prev.goodConditionCount,
          defectiveConditionCount: condition === "DEFECTIVE" ? prev.defectiveConditionCount + 1 : prev.defectiveConditionCount,
        }));

        setSearchResult((prev) =>
          prev
            ? {
                ...prev,
                order: updatedOrderObj,
              }
            : null
        );

        router.refresh();
      }
    } catch (err: any) {
      sound.playErrorBeep();
      setErrorMessage(err.message || "Failed to process return.");
    } finally {
      setProcessing(false);
    }
  };

  // Delete / Revert Return Entry
  const handleConfirmRevert = async () => {
    if (!orderToRevert) return;
    setIsReverting(true);
    setErrorMessage(null);

    try {
      const res = await revertOrderReturn(orderToRevert.id);
      if (res.success) {
        sound.playSuccessBeep();

        setRecentReturnsList((prev) => prev.filter((o) => o.id !== orderToRevert.id));

        setSummaryStats((prev) => ({
          ...prev,
          totalReturns: Math.max(0, prev.totalReturns - 1),
          todayReturnsCount: Math.max(0, prev.todayReturnsCount - 1),
          rtoCount: orderToRevert.status === "RETURN_RTO" ? Math.max(0, prev.rtoCount - 1) : prev.rtoCount,
          customerCount: orderToRevert.status === "RETURN_CUSTOMER" ? Math.max(0, prev.customerCount - 1) : prev.customerCount,
          goodConditionCount: orderToRevert.condition === "GOOD" ? Math.max(0, prev.goodConditionCount - 1) : prev.goodConditionCount,
          defectiveConditionCount: orderToRevert.condition === "DEFECTIVE" ? Math.max(0, prev.defectiveConditionCount - 1) : prev.defectiveConditionCount,
        }));

        if (searchResult?.order?.id === orderToRevert.id) {
          setSearchResult((prev) =>
            prev
              ? {
                  ...prev,
                  order: {
                    ...prev.order,
                    status: "DISPATCHED",
                    condition: null,
                    returnNote: null,
                    returnedAt: null,
                  },
                }
              : null
          );
        }

        setSuccessMessage(`✅ Order ${orderToRevert.orderId} return record delete ho gaya aur stock pehle jaisa restore ho gaya!`);
        setOrderToRevert(null);
        router.refresh();
      }
    } catch (err: any) {
      sound.playErrorBeep();
      setErrorMessage(err.message || "Failed to delete return entry.");
    } finally {
      setIsReverting(false);
    }
  };

  const handleReset = () => {
    setQuery("");
    setSearchResult(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const matchedOrder = searchResult?.order;
  const isAlreadyReturned = matchedOrder && matchedOrder.status !== "DISPATCHED";

  const getPlatformBadge = (channel: string) => {
    const ch = (channel || "").toUpperCase();
    if (ch.includes("FLIPKART")) {
      return {
        name: "Flipkart",
        badge: "bg-blue-50 text-blue-700 border border-blue-100",
        dot: "bg-blue-500",
      };
    }
    if (ch.includes("MEESHO")) {
      return {
        name: "Meesho",
        badge: "bg-pink-50 text-pink-700 border border-pink-100",
        dot: "bg-pink-500",
      };
    }
    if (ch.includes("AMAZON")) {
      return {
        name: "Amazon",
        badge: "bg-amber-50 text-amber-700 border border-amber-100",
        dot: "bg-amber-500",
      };
    }
    return {
      name: channel || "Other",
      badge: "bg-gray-50 text-gray-700 border border-gray-200",
      dot: "bg-gray-500",
    };
  };

  const getDateGroupKey = (dateStr: string | Date | null) => {
    if (!dateStr) return "Older Returns";
    const d = new Date(dateStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";

    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Filtered Ledger List
  const filteredLedger = useMemo(() => {
    let list = recentReturnsList;

    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase().trim();
      list = list.filter((order) => {
        const matchOrder = order.orderId?.toLowerCase().includes(q);
        const matchAwb = order.awb?.toLowerCase().includes(q);
        const matchCustomer = order.customerName?.toLowerCase().includes(q);
        const matchItems = order.items?.some(
          (it: any) =>
            it.channelSku?.toLowerCase().includes(q) ||
            it.product?.sku?.toLowerCase().includes(q) ||
            it.product?.name?.toLowerCase().includes(q)
        );
        return matchOrder || matchAwb || matchCustomer || matchItems;
      });
    }

    const now = new Date();
    if (dateFilter === "TODAY") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      list = list.filter((o) => o.returnedAt && new Date(o.returnedAt) >= start);
    } else if (dateFilter === "7DAYS") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      list = list.filter((o) => o.returnedAt && new Date(o.returnedAt) >= sevenDaysAgo);
    } else if (dateFilter === "MONTH") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      list = list.filter((o) => o.returnedAt && new Date(o.returnedAt) >= startOfMonth);
    }

    if (typeFilter === "RTO") {
      list = list.filter((o) => o.status === "RETURN_RTO");
    } else if (typeFilter === "CUSTOMER") {
      list = list.filter((o) => o.status === "RETURN_CUSTOMER");
    } else if (typeFilter === "DEFECTIVE") {
      list = list.filter((o) => o.condition === "DEFECTIVE");
    }

    return list;
  }, [recentReturnsList, ledgerSearch, dateFilter, typeFilter]);

  // Grouped Ledger by Date
  const groupedLedger = useMemo(() => {
    const groups: { title: string; count: number; items: any[] }[] = [];
    const map = new Map<string, any[]>();

    filteredLedger.forEach((item) => {
      const key = getDateGroupKey(item.returnedAt || item.updatedAt);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });

    map.forEach((items, title) => {
      groups.push({ title, count: items.length, items });
    });

    return groups;
  }, [filteredLedger]);

  return (
    <div className="max-w-7xl mx-auto pb-32 md:pb-16 space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* ============================================================== */}
      {/* 📱 TRUE NATIVE MOBILE APP VIEW (md:hidden)                      */}
      {/* ============================================================== */}
      <div className="md:hidden flex flex-col gap-3">
        
        {/* 1. Mobile App Top Bar */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
              <RotateCcw className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 leading-tight">Returns Inward</h1>
              <p className="text-[10px] text-gray-400 truncate">Scan packet text or barcode</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/inventory"
              className="px-2.5 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-[11px] font-semibold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
            >
              <Boxes className="w-3.5 h-3.5 text-gray-500" />
              <span>Stock</span>
            </Link>
          </div>
        </div>

        {/* 2. Compact 1-Line Stats Scroll Bar (Matching Indigo/Blue App Theme) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          <div className="shrink-0 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-100/80 text-[11px] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            <span>Today: {summaryStats.todayReturnsCount}</span>
          </div>
          <div className="shrink-0 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-100/80 text-[11px] font-semibold">
            RTO: <strong>{summaryStats.rtoCount}</strong>
          </div>
          <div className="shrink-0 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-800 border border-purple-100/80 text-[11px] font-semibold">
            Customer: <strong>{summaryStats.customerCount}</strong>
          </div>
          <div className="shrink-0 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-100/80 text-[11px] font-semibold">
            Defective: <strong>{summaryStats.defectiveConditionCount}</strong>
          </div>
        </div>

        {/* 3. Hero 1-Tap Mobile Camera Scanner Button (Matching Inventory Royal Indigo-Blue Theme) */}
        <button
          type="button"
          onClick={() => setIsScannerOpen(true)}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer touch-manipulation"
        >
          <Camera className="w-5 h-5 text-white/90" />
          <span>Tap to Scan Packet (Text / Barcode)</span>
        </button>

        {/* 4. Spacious Mobile Search Bar (Side-by-Side with Clean (X) Clear Icon) */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={mobileSearchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type Order ID or AWB..."
              className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-mono font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
            />
            {query && (
              <button
                type="button"
                onClick={handleReset}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Clear"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shrink-0 disabled:opacity-50 active:scale-95 transition-all shadow-sm shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
          >
            {searching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </>
            )}
          </button>
        </form>

      </div>

      {/* ============================================================== */}
      {/* 🖥️ 1. DESKTOP HEADER (hidden md:flex) — Matches Dashboard Theme */}
      {/* ============================================================== */}
      <div className="hidden md:flex justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Returns & RTO Inward</h1>
          <p className="text-gray-500 mt-1">
            Barcode ya OCR se packet scan karke stock inward karein aur live return ledger track karein
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="inline-flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95 shadow-xs cursor-pointer text-xs"
          >
            <Boxes className="w-4 h-4 text-indigo-600" />
            Manage Inventory
          </Link>
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95 shadow-xs shadow-indigo-200 cursor-pointer text-xs"
          >
            <Camera className="w-4 h-4" />
            Open Camera Scanner
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 🖥️ 2. DESKTOP SUMMARY CARDS GRID (hidden md:grid)              */}
      {/* ============================================================== */}
      <div className="hidden md:grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Today&apos;s Inward</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summaryStats.todayReturnsCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Total RTO Inward</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{summaryStats.rtoCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Customer Returns</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{summaryStats.customerCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Defective / Damaged</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{summaryStats.defectiveConditionCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 🖥️ 3. DESKTOP SCAN & SEARCH CARD (hidden md:block)             */}
      {/* ============================================================== */}
      <div className="hidden md:block bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-indigo-600" />
            Scan / Enter Order ID or AWB Tracking Number
          </label>
          <span className="text-[11px] text-gray-400">
            Barcode Scanner & AI Text OCR ready
          </span>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2.5">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Scan Barcode, Courier AWB, or printed Order ID..."
              className="w-full pl-11 pr-24 py-2.5 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono transition-all"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <Search className="w-4 h-4" />
            </div>

            {query && (
              <button
                type="button"
                onClick={handleReset}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400 hover:text-gray-600 px-2 py-0.5 rounded bg-gray-200/60 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:scale-95 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            title="Open Camera Scanner"
          >
            <Camera className="w-4 h-4" />
            <span>Camera Scan</span>
          </button>

          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs transition-all shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search Order</span>
          </button>
        </form>
      </div>

      {/* Global Alerts (Banners) - Zero Truncation & App-Style Card */}
      {errorMessage && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50/90 border border-rose-200/80 text-rose-900 space-y-2.5 animate-in fade-in duration-200 shadow-2xs">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-rose-900 leading-tight">
                  Order Database Mein Nahi Mila
                </h4>
                <p className="text-xs text-rose-700/90 mt-1 leading-relaxed break-words">
                  {errorMessage}
                </p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => setErrorMessage(null)} 
              className="text-rose-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-100 transition-colors shrink-0 cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Helpful Actions */}
          <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] text-rose-700 font-medium">
              ID check karein ya camera se label scan karein:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-800 text-[11px] font-semibold hover:bg-rose-100/50 active:scale-95 transition-all cursor-pointer shadow-2xs"
              >
                Clear Search
              </button>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <Camera className="w-3 h-3" />
                <span>Camera Scan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-900 flex items-start justify-between gap-2.5 animate-in fade-in duration-200 shadow-2xs">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
            </div>
            <p className="text-xs text-emerald-800 font-semibold leading-relaxed break-words pt-1">
              {successMessage}
            </p>
          </div>
          <button 
            type="button" 
            onClick={() => setSuccessMessage(null)} 
            className="text-emerald-500 hover:text-emerald-700 p-1 rounded-lg hover:bg-emerald-100 transition-colors shrink-0 cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 📦 INSPECTED ORDER CARD (Native App Responsive Layout)         */}
      {/* ============================================================== */}
      {matchedOrder && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-200">
          
          {/* Card Top Row */}
          <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between gap-2 bg-gray-50/50">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${getPlatformBadge(matchedOrder.channel).badge}`}>
                {getPlatformBadge(matchedOrder.channel).name}
              </span>
              <span className="font-mono text-xs sm:text-sm font-bold text-gray-900 truncate">
                {matchedOrder.orderId}
              </span>
              <button
                onClick={() => handleCopy(matchedOrder.orderId, "orderId")}
                className="text-gray-400 hover:text-gray-600 p-1 shrink-0"
              >
                {copiedKey === "orderId" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="text-gray-400 hover:text-gray-600 p-1 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3.5 sm:p-5 space-y-3.5">
            
            {/* Smart Recommendation */}
            {searchResult?.smartRecommendation && (
              <div
                className={`p-3 rounded-xl flex items-start gap-2.5 border text-xs ${
                  searchResult.smartRecommendation.type === "RTO"
                    ? "bg-blue-50/60 border-blue-100 text-blue-900"
                    : "bg-amber-50/60 border-amber-100 text-amber-900"
                }`}
              >
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="font-bold uppercase tracking-wider text-[11px]">
                    {searchResult.smartRecommendation.title}
                  </h4>
                  <p className="text-[11px] mt-0.5 text-gray-600 leading-snug">
                    {searchResult.smartRecommendation.description}
                  </p>
                </div>
              </div>
            )}

            {/* Already Returned Alert Banner (With Direct Undo Button) */}
            {isAlreadyReturned && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-amber-900 leading-tight">
                      Yeh Order Pehle Hi Inward Ho Chuka Hai
                    </h4>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                      Status: <strong>{matchedOrder.status === "RETURN_RTO" ? "RTO" : "Customer Return"}</strong> • Condition: <strong>{matchedOrder.condition === "GOOD" ? "Good" : "Defective"}</strong>
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-800 font-medium truncate">
                    Galti se hua?
                  </span>
                  <button
                    type="button"
                    onClick={() => setOrderToRevert(matchedOrder)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>Undo / Delete Return</span>
                  </button>
                </div>
              </div>
            )}

            {/* Substituted / Upgraded Order Alert */}
            {matchedOrder.items?.some((it: any) => it.isSubstituted) && (
              <div className="p-3.5 rounded-xl bg-purple-50/90 border border-purple-200 text-purple-950 space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-xs text-purple-900">
                  <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
                  ⚠️ Substituted / Upgraded Order Detected!
                </div>
                <p className="text-[11px] text-purple-900/90 leading-relaxed">
                  Dispatch time par is order mein product upgrade/swap hua tha. Box ke label par <strong>{matchedOrder.items.map((it: any) => it.channelSku).filter(Boolean).join(", ")}</strong> print hai, lekin parcel ke andar physical product <strong>{matchedOrder.items.map((it: any) => it.product?.name || it.product?.sku).join(", ")}</strong> bheja gaya tha.
                </p>
                <div className="text-[10px] font-semibold text-purple-800 bg-purple-100/70 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>Inward karte hi yeh stock physical product (+1 {matchedOrder.items.map((it: any) => it.product?.sku).join(", ")}) mein sahi se restock hoga!</span>
                </div>
              </div>
            )}

            {/* Products with Dual SKUs */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Product Details
              </span>

              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-white">
                {matchedOrder.items?.map((item: any, idx: number) => (
                  <div key={item.id || idx} className="p-3 flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      <Package className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-gray-900 leading-snug line-clamp-2">
                        {item.product?.name || item.channelSku || "Unknown Product"}
                      </p>
                      
                      {/* Dual SKU Badges */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {item.isSubstituted && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-md">
                            🔄 Substituted Variant
                          </span>
                        )}

                        {item.channelSku && (
                          <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            item.isSubstituted 
                              ? "bg-amber-50 text-amber-900 border-amber-300"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}>
                            <span className="text-[8px] uppercase tracking-wider text-amber-600 font-sans">Label SKU:</span>
                            {item.channelSku}
                          </span>
                        )}

                        <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          item.isSubstituted
                            ? "bg-purple-50 text-purple-800 border-purple-300 font-bold"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}>
                          <span className={`text-[8px] uppercase tracking-wider font-sans ${item.isSubstituted ? "text-purple-600" : "text-indigo-500"}`}>
                            {item.isSubstituted ? "Actual Dispatched:" : "Master:"}
                          </span>
                          {item.product?.sku || "N/A"}
                        </span>

                        <span className="text-[11px] text-gray-500">
                          Qty: <strong>{item.quantity || 1}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Buyer & Tracking Info */}
            <div className="flex items-center justify-between text-[11px] text-gray-500 bg-gray-50 px-3 py-2 rounded-xl flex-wrap gap-2">
              <span>AWB: <strong className="font-mono text-gray-800">{matchedOrder.awb && matchedOrder.awb !== matchedOrder.orderId ? matchedOrder.awb : "N/A"}</strong></span>
              {matchedOrder.customerName && (
                <span>Buyer: <strong className="text-gray-800">{matchedOrder.customerName}</strong></span>
              )}
            </div>

            {/* Action Form (If Not Already Returned) */}
            {!isAlreadyReturned && (
              <div className="p-3 bg-gray-50/80 border border-gray-100 rounded-xl space-y-3">
                
                {/* Step 1: Type */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReturnType("RETURN_RTO")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      returnType === "RETURN_RTO"
                        ? "bg-blue-50 border-blue-500 text-blue-900 shadow-2xs font-bold"
                        : "bg-white border-gray-200 text-gray-700"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>📦 RTO (Courier)</span>
                      {returnType === "RETURN_RTO" && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <span className="text-[10px] text-blue-700/80 font-normal block mt-0.5">Sealed parcel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReturnType("RETURN_CUSTOMER")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      returnType === "RETURN_CUSTOMER"
                        ? "bg-purple-50 border-purple-500 text-purple-900 shadow-2xs font-bold"
                        : "bg-white border-gray-200 text-gray-700"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>👤 Customer</span>
                      {returnType === "RETURN_CUSTOMER" && <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />}
                    </div>
                    <span className="text-[10px] text-purple-700/80 font-normal block mt-0.5">Buyer opened</span>
                  </button>
                </div>

                {/* Step 2: Quality */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCondition("GOOD")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      condition === "GOOD"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs font-bold"
                        : "bg-white border-gray-200 text-gray-700"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>🟢 Good Condition</span>
                      {condition === "GOOD" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <span className="text-[10px] text-emerald-700/80 font-normal block mt-0.5">+1 Normal Stock</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCondition("DEFECTIVE")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      condition === "DEFECTIVE"
                        ? "bg-rose-50 border-rose-500 text-rose-900 shadow-2xs font-bold"
                        : "bg-white border-gray-200 text-gray-700"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>🔴 Defective</span>
                      {condition === "DEFECTIVE" && <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />}
                    </div>
                    <span className="text-[10px] text-rose-700/80 font-normal block mt-0.5">+1 Defective Box</span>
                  </button>
                </div>

                {/* Step 3: Optional Note */}
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional claim or inspection note..."
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none"
                />

                {/* Confirm Inward Button */}
                <button
                  type="button"
                  onClick={handleProcessReturn}
                  disabled={processing}
                  className="w-full py-3 rounded-xl bg-indigo-600 active:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating Inventory...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Inward & Restock</span>
                    </>
                  )}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 📱 4. MOBILE RECENT RETURNS LEDGER (md:hidden) — 100% Native   */}
      {/* ============================================================== */}
      <div className="md:hidden space-y-3">
        
        {/* Ledger Header & Compact Mobile Search */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900">Recent Inward History</h3>
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              {recentReturnsList.length}
            </span>
          </div>

          {/* Quick Ledger Search Box */}
          <div className="relative w-36 sm:w-60">
            <input
              type="text"
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              placeholder="Filter..."
              className="w-full pl-7 pr-6 py-1 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
            <Search className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            {ledgerSearch && (
              <button
                type="button"
                onClick={() => setLedgerSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Swipeable 1-Line Filter Chips (App Style) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          <button
            type="button"
            onClick={() => { setDateFilter("ALL"); setTypeFilter("ALL"); }}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              dateFilter === "ALL" && typeFilter === "ALL"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            All ({recentReturnsList.length})
          </button>

          <button
            type="button"
            onClick={() => setDateFilter(dateFilter === "TODAY" ? "ALL" : "TODAY")}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              dateFilter === "TODAY"
                ? "bg-indigo-600 text-white shadow-xs font-bold"
                : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            Today ({summaryStats.todayReturnsCount})
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter(typeFilter === "RTO" ? "ALL" : "RTO")}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === "RTO"
                ? "bg-blue-600 text-white shadow-xs font-bold"
                : "bg-blue-50 text-blue-700 border border-blue-100"
            }`}
          >
            RTO ({summaryStats.rtoCount})
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter(typeFilter === "CUSTOMER" ? "ALL" : "CUSTOMER")}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === "CUSTOMER"
                ? "bg-purple-600 text-white shadow-xs font-bold"
                : "bg-purple-50 text-purple-700 border border-purple-100"
            }`}
          >
            Customer ({summaryStats.customerCount})
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter(typeFilter === "DEFECTIVE" ? "ALL" : "DEFECTIVE")}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === "DEFECTIVE"
                ? "bg-rose-600 text-white shadow-xs font-bold"
                : "bg-rose-50 text-rose-700 border border-rose-100"
            }`}
          >
            Defective ({summaryStats.defectiveConditionCount})
          </button>
        </div>

        {/* Grouped Ledger Cards */}
        {recentReturnsList.length === 0 ? (
          <div className="text-center py-12 bg-white border border-gray-100 rounded-2xl p-6">
            <RotateCcw className="w-9 h-9 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-700">Abhi koi return record nahi hai</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Packet scan karke inward karein, yahan live date-wise ledger banega.
            </p>
          </div>
        ) : filteredLedger.length === 0 ? (
          <div className="text-center py-8 bg-white border border-gray-100 rounded-2xl text-xs text-gray-400">
            Is filter ke saath koi return record match nahi hua.
          </div>
        ) : (
          <div className="space-y-4">
            {groupedLedger.map((group) => (
              <div key={group.title} className="space-y-2">
                
                {/* Date Section Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-bold text-gray-800" suppressHydrationWarning>{group.title}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {group.count} {group.count === 1 ? "parcel" : "parcels"}
                  </span>
                </div>

                {/* Mobile Cards Stack */}
                <div className="space-y-2.5">
                  {group.items.map((order: any) => {
                    const p = getPlatformBadge(order.channel);
                    const isGood = order.condition === "GOOD";
                    const isRto = order.status === "RETURN_RTO";

                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm flex flex-col gap-2 relative transition-all"
                      >
                        {/* Card Header Row: Badges + Time + Delete Icon */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${p.badge}`}>
                              {p.name}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                              isRto ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-purple-50 text-purple-700 border border-purple-100"
                            }`}>
                              {isRto ? "RTO" : "Customer"}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isGood ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                            }`}>
                              {isGood ? "Good (+Stock)" : "Defective"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-gray-400 font-medium" suppressHydrationWarning>
                              {order.returnedAt
                                ? new Date(order.returnedAt).toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </span>
                            
                            {/* Trash Delete Action */}
                            <button
                              type="button"
                              onClick={() => setOrderToRevert(order)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition-all cursor-pointer"
                              title="Delete Return Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Order ID & AWB Row */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono font-bold text-gray-900 truncate">
                              {order.orderId}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(order.orderId, `ledger-${order.id}`)}
                              className="text-gray-400 hover:text-gray-600 p-0.5"
                            >
                              {copiedKey === `ledger-${order.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {order.awb && order.awb !== order.orderId && (
                            <span className="font-mono text-[10px] text-gray-400 shrink-0">
                              AWB: {order.awb}
                            </span>
                          )}
                        </div>

                        {/* Product Title */}
                        <div className="space-y-1">
                          {order.items?.map((it: any, iIdx: number) => (
                            <div key={it.id || iIdx} className="space-y-1">
                              <p className="text-xs font-bold text-gray-800 leading-snug">
                                {it.product?.name || "Product"} <span className="text-gray-400 font-normal">(x{it.quantity || 1})</span>
                              </p>

                              {/* Dual SKU Badges side by side */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {it.channelSku && (
                                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 px-1.5 py-0.5 rounded">
                                    <span className="text-[8px] uppercase tracking-wider text-amber-600 font-sans">Fetched:</span>
                                    {it.channelSku}
                                  </span>
                                )}

                                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-1.5 py-0.5 rounded">
                                  <span className="text-[8px] uppercase tracking-wider text-indigo-500 font-sans">Master:</span>
                                  {it.product?.sku || "N/A"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Card Footer: Buyer Name & Note */}
                        {(order.customerName || order.returnNote) && (
                          <div className="pt-1.5 border-t border-gray-50 flex items-center justify-between text-[10.5px] text-gray-400 flex-wrap gap-1">
                            {order.customerName && (
                              <span>Buyer: <strong className="text-gray-700 font-medium">{order.customerName}</strong></span>
                            )}
                            {order.returnNote && (
                              <span className="italic text-gray-500">&ldquo;{order.returnNote}&rdquo;</span>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

      {/* ============================================================== */}
      {/* 🖥️ 4. DESKTOP RECENT RETURNS LEDGER TABLE (hidden md:block)     */}
      {/* ============================================================== */}
      <div className="hidden md:block space-y-4">
        
        {/* Desktop Ledger Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search return history by Order ID, AWB, SKU or customer..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {[
                { 
                  id: "ALL", 
                  label: `All Returns (${recentReturnsList.length})`, 
                  active: dateFilter === "ALL" && typeFilter === "ALL", 
                  onClick: () => { setDateFilter("ALL"); setTypeFilter("ALL"); } 
                },
                { 
                  id: "TODAY", 
                  label: `Today (${summaryStats.todayReturnsCount})`, 
                  active: dateFilter === "TODAY", 
                  onClick: () => setDateFilter(dateFilter === "TODAY" ? "ALL" : "TODAY") 
                },
                { 
                  id: "RTO", 
                  label: `RTO (${summaryStats.rtoCount})`, 
                  active: typeFilter === "RTO", 
                  onClick: () => setTypeFilter(typeFilter === "RTO" ? "ALL" : "RTO") 
                },
                { 
                  id: "CUSTOMER", 
                  label: `Customer (${summaryStats.customerCount})`, 
                  active: typeFilter === "CUSTOMER", 
                  onClick: () => setTypeFilter(typeFilter === "CUSTOMER" ? "ALL" : "CUSTOMER") 
                },
                { 
                  id: "DEFECTIVE", 
                  label: `Defective (${summaryStats.defectiveConditionCount})`, 
                  active: typeFilter === "DEFECTIVE", 
                  onClick: () => setTypeFilter(typeFilter === "DEFECTIVE" ? "ALL" : "DEFECTIVE") 
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={tab.onClick}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    tab.active
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

        {/* Desktop Table Container */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {recentReturnsList.length === 0 ? (
            <div className="p-12 text-center bg-white flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Abhi Koi Return Record Nahi Hai</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Packet ka Order ID ya barcode scan karke inward karein, yahan live date-wise ledger generate hoga.
              </p>
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="p-12 text-center bg-white flex flex-col items-center justify-center">
              <p className="text-xs text-gray-500">
                Is filter ya search query ke sath koi return record match nahi hua.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Platform & Order ID</th>
                  <th className="py-3.5 px-4">Inward Date & Time</th>
                  <th className="py-3.5 px-4">Product & SKUs</th>
                  <th className="py-3.5 px-4">Return Type & Quality</th>
                  <th className="py-3.5 px-4">Buyer / Note</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredLedger.map((order: any) => {
                  const p = getPlatformBadge(order.channel);
                  const isGood = order.condition === "GOOD";
                  const isRto = order.status === "RETURN_RTO";

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-indigo-50/30 transition-colors group"
                    >
                      {/* 1. Platform & Order ID */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <RotateCcw className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${p.badge}`}>
                                {p.name}
                              </span>
                              <span className="font-mono font-bold text-gray-900 truncate max-w-[200px]" title={order.orderId}>
                                {order.orderId}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(order.orderId, `desk-ledger-${order.id}`)}
                                className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                                title="Copy Order ID"
                              >
                                {copiedKey === `desk-ledger-${order.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {order.awb && order.awb !== order.orderId && (
                              <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                                AWB: {order.awb}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Inward Date & Time */}
                      <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium" suppressHydrationWarning>
                            {order.returnedAt
                              ? new Date(order.returnedAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "-"}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 pl-5" suppressHydrationWarning>
                          {order.returnedAt
                            ? new Date(order.returnedAt).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </p>
                      </td>

                      {/* 3. Product & SKUs */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 max-w-sm">
                          {order.items?.map((it: any, idx: number) => (
                            <div key={it.id || idx}>
                              <p className="font-bold text-gray-900 truncate" title={it.product?.name}>
                                {it.product?.name || "Product"}
                                <span className="text-gray-400 font-normal ml-1">
                                  (x{it.quantity || 1})
                                </span>
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {it.channelSku && (
                                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 px-1.5 py-0.5 rounded">
                                    <span className="text-[8px] uppercase tracking-wider text-amber-600 font-sans">Fetched:</span>
                                    {it.channelSku}
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-1.5 py-0.5 rounded">
                                  <span className="text-[8px] uppercase tracking-wider text-indigo-500 font-sans">Master:</span>
                                  {it.product?.sku || "N/A"}
                                </span>
                                {it.isSubstituted && (
                                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                                    🔄 Substituted
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* 4. Return Type & Quality */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                            isRto ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-purple-50 text-purple-700 border border-purple-100"
                          }`}>
                            {isRto ? "RTO (Courier)" : "Customer Return"}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isGood ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isGood ? "bg-emerald-500" : "bg-rose-500"}`} />
                            {isGood ? "Good (+1 Restocked)" : "Defective Box"}
                          </span>
                        </div>
                      </td>

                      {/* 5. Buyer / Note */}
                      <td className="py-3.5 px-4">
                        <div className="max-w-[200px] text-xs">
                          {order.customerName && (
                            <p className="text-gray-800 font-medium truncate" title={order.customerName}>
                              {order.customerName}
                            </p>
                          )}
                          {order.returnNote ? (
                            <p className="text-[11px] text-gray-500 italic truncate mt-0.5" title={order.returnNote}>
                              &ldquo;{order.returnNote}&rdquo;
                            </p>
                          ) : !order.customerName ? (
                            <span className="text-gray-400 text-[11px]">-</span>
                          ) : null}
                        </div>
                      </td>

                      {/* 6. Actions */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setOrderToRevert(order)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95"
                          title="Delete Return & Restore Original Stock"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>Undo Return</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 📱 Native Mobile App Bottom Sheet: Delete / Revert Confirmation Dialog */}
      {orderToRevert && (
        <div 
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
          onClick={() => !isReverting && setOrderToRevert(null)}
        >
          <div 
            className="bg-white rounded-t-[28px] sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col relative overflow-hidden my-0 sm:my-auto border border-slate-100 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Pull Handle (Mobile) */}
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            <div className="p-5 sm:p-6 flex flex-col items-center text-center">
              {/* Soft Rose Alert Squircle */}
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100/80 flex items-center justify-center text-rose-600 mb-3 shadow-sm shadow-rose-100/50">
                <RotateCcw className="w-6 h-6 stroke-[2.2]" />
              </div>

              {/* Title & Subtitle */}
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Delete Return Entry?
              </h3>
              <p className="text-xs text-slate-500 mb-4 px-2 leading-relaxed">
                Is order ka return record delete ho jayega aur inventory automatically pehle jaisi restore ho jayegi.
              </p>

              {/* Order Context Card */}
              <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 mb-5 text-left space-y-2.5">
                {/* Platform + Order ID + Type */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {orderToRevert.platform || "ORDER"}
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-900 truncate">
                      {orderToRevert.orderId}
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    orderToRevert.status === "RETURN_CUSTOMER" 
                      ? "bg-purple-50 text-purple-700 border border-purple-100" 
                      : "bg-amber-50 text-amber-700 border border-amber-100"
                  }`}>
                    {orderToRevert.status === "RETURN_CUSTOMER" ? "Customer Return" : "RTO"}
                  </span>
                </div>

                {/* SKU / Items info */}
                {orderToRevert.items && orderToRevert.items.length > 0 && (
                  <div className="bg-white rounded-xl p-2.5 border border-slate-100 space-y-1">
                    {orderToRevert.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-medium text-slate-800 truncate">
                            {item.product?.name || item.sellerSku || "Item"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.sellerSku && (
                              <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/80">
                                SKU: {item.sellerSku}
                              </span>
                            )}
                            {item.product?.masterSku && (
                              <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/80">
                                Master: {item.product.masterSku}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-semibold text-slate-600 shrink-0">
                          Qty: {item.quantity || 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Stock Restore Impact Indicator */}
                <div className="bg-white rounded-xl p-2.5 border border-slate-100 flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    Status Restored:
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/80">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Wapas "DISPATCHED" hoga</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Stacked, Touch-friendly, Zero black border) */}
              <div className="flex flex-col gap-2.5 w-full">
                <button
                  type="button"
                  onClick={handleConfirmRevert}
                  disabled={isReverting}
                  className="w-full h-12 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-sm shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isReverting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting & Restoring Stock...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 stroke-[2.2]" />
                      Yes, Delete & Restore Stock
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => setOrderToRevert(null)}
                  disabled={isReverting}
                  className="w-full h-12 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-semibold text-sm rounded-2xl flex items-center justify-center transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 📷 Live Camera Barcode & AWB Scanner Modal */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={handleCloseScanner}
        onScanResult={handleScanResult}
        onOrderProcessed={handleRapidOrderProcessed}
      />

    </div>
  );
}
