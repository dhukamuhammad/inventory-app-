"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Search, 
  X, 
  ArrowDownRight, 
  ArrowUpRight, 
  Undo2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Loader2, 
  Calendar,
  Layers,
  Store,
  Filter,
  ChevronDown,
  Check,
  AlertCircle,
  Clock
} from "lucide-react";
import { deleteStockMovement } from "@/app/actions/inventory";

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  costPrice: number;
  category?: {
    id: string;
    name: string;
  } | null;
}

interface MovementItem {
  id: string;
  productId: string;
  type: string;
  quantity: number;
  unitCost: number | null;
  platformId: string | null;
  note: string | null;
  date: Date | string;
  product: ProductItem;
  platform: {
    id: string;
    name: string;
  } | null;
}

interface PlatformItem {
  id: string;
  name: string;
}

interface MovementsClientProps {
  initialMovements: MovementItem[];
  platforms?: PlatformItem[];
}

type FilterType = 
  | "ALL" 
  | "IN" 
  | "OUT" 
  | "RETURNS_ALL" 
  | "RETURN_RTO" 
  | "RETURN_RTO_DEFECTIVE" 
  | "RETURN_GOOD" 
  | "RETURN_DEFECTIVE";

type DateRangeType = "ALL" | "TODAY" | "YESTERDAY" | "7D" | "30D" | "THIS_MONTH" | "CUSTOM";

function getMovementBadge(type: string) {
  switch (type) {
    case "IN":
      return {
        label: "Stock Added",
        short: "IN",
        badgeBg: "bg-emerald-50 text-emerald-800 font-bold",
        iconBg: "bg-emerald-100/70 text-emerald-700",
        icon: ArrowDownRight,
        prefix: "+",
        textColor: "text-emerald-700"
      };
    case "OUT":
      return {
        label: "Sold / Dispatched",
        short: "OUT",
        badgeBg: "bg-rose-50 text-rose-800 font-bold",
        iconBg: "bg-rose-100/70 text-rose-700",
        icon: ArrowUpRight,
        prefix: "-",
        textColor: "text-rose-700"
      };
    case "RETURN_RTO":
      return {
        label: "RTO Return (Good)",
        short: "RTO Good",
        badgeBg: "bg-amber-50 text-amber-800 font-bold",
        iconBg: "bg-amber-100/70 text-amber-700",
        icon: Undo2,
        prefix: "↺+",
        textColor: "text-amber-700"
      };
    case "RETURN_RTO_DEFECTIVE":
      return {
        label: "RTO Defective",
        short: "RTO Defect",
        badgeBg: "bg-red-50 text-red-800 font-bold",
        iconBg: "bg-red-100/70 text-red-700",
        icon: AlertTriangle,
        prefix: "↺!",
        textColor: "text-red-700"
      };
    case "RETURN_GOOD":
      return {
        label: "Customer Return (Good)",
        short: "Cust Good",
        badgeBg: "bg-teal-50 text-teal-800 font-bold",
        iconBg: "bg-teal-100/70 text-teal-700",
        icon: CheckCircle2,
        prefix: "↺+",
        textColor: "text-teal-700"
      };
    case "RETURN_DEFECTIVE":
      return {
        label: "Customer Return (Defective)",
        short: "Cust Defect",
        badgeBg: "bg-orange-50 text-orange-800 font-bold",
        iconBg: "bg-orange-100/70 text-orange-700",
        icon: XCircle,
        prefix: "↺!",
        textColor: "text-orange-700"
      };
    default:
      return {
        label: type,
        short: type,
        badgeBg: "bg-gray-50 text-gray-700 font-medium",
        iconBg: "bg-gray-100 text-gray-700",
        icon: Undo2,
        prefix: "",
        textColor: "text-gray-700"
      };
  }
}

interface DateGroup {
  dateKey: string;
  displayDate: string;
  isToday: boolean;
  isYesterday: boolean;
  totalIn: number;
  totalOut: number;
  totalReturns: number;
  items: MovementItem[];
}

export function MovementsClient({ initialMovements, platforms = [] }: MovementsClientProps) {
  const [movements, setMovements] = useState<MovementItem[]>(initialMovements);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");
  const [dateRange, setDateRange] = useState<DateRangeType>("ALL");
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("ALL");
  
  // Custom Modals State (No ugly browser window.confirm!)
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [movementToRevert, setMovementToRevert] = useState<MovementItem | null>(null);
  const [isReverting, setIsReverting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Revert / Undo a transaction
  const confirmRevertAction = async () => {
    if (!movementToRevert) return;
    try {
      setIsReverting(true);
      await deleteStockMovement(movementToRevert.id);
      setMovements((prev) => prev.filter((m) => m.id !== movementToRevert.id));
      setMovementToRevert(null);
    } catch (err: any) {
      console.error("Failed to delete movement:", err);
      alert(err?.message || "Failed to revert entry. Please try again.");
    } finally {
      setIsReverting(false);
    }
  };

  // Filtered movements calculation
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // 1. Search Query
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesName = m.product.name.toLowerCase().includes(q);
        const matchesSku = m.product.sku.toLowerCase().includes(q);
        const matchesPlatform = m.platform?.name.toLowerCase().includes(q) ?? false;
        const matchesNote = m.note?.toLowerCase().includes(q) ?? false;
        const matchesQty = m.quantity.toString().includes(q);
        if (!matchesName && !matchesSku && !matchesPlatform && !matchesNote && !matchesQty) {
          return false;
        }
      }

      // 2. Channel / Platform Filter
      if (selectedPlatformId !== "ALL") {
        if (selectedPlatformId === "MANUAL") {
          if (m.platformId) return false;
        } else {
          if (m.platformId !== selectedPlatformId) return false;
        }
      }

      // 3. Movement Type Filter
      if (activeFilter === "IN" && m.type !== "IN") return false;
      if (activeFilter === "OUT" && m.type !== "OUT") return false;
      if (activeFilter === "RETURNS_ALL" && !m.type.startsWith("RETURN")) return false;
      if (activeFilter === "RETURN_RTO" && m.type !== "RETURN_RTO") return false;
      if (activeFilter === "RETURN_RTO_DEFECTIVE" && m.type !== "RETURN_RTO_DEFECTIVE") return false;
      if (activeFilter === "RETURN_GOOD" && m.type !== "RETURN_GOOD") return false;
      if (activeFilter === "RETURN_DEFECTIVE" && m.type !== "RETURN_DEFECTIVE") return false;

      // 4. Date Filter
      if (dateRange !== "ALL") {
        const itemDate = new Date(m.date);
        const itemTime = itemDate.getTime();
        const now = new Date();

        if (dateRange === "TODAY") {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (itemTime < startOfToday) return false;
        } else if (dateRange === "YESTERDAY") {
          const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
          const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (itemTime < startOfYesterday || itemTime >= endOfYesterday) return false;
        } else if (dateRange === "7D") {
          if (Date.now() - itemTime > 7 * 24 * 60 * 60 * 1000) return false;
        } else if (dateRange === "30D") {
          if (Date.now() - itemTime > 30 * 24 * 60 * 60 * 1000) return false;
        } else if (dateRange === "THIS_MONTH") {
          if (itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (dateRange === "CUSTOM") {
          if (customDates.start) {
            const startTime = new Date(customDates.start).setHours(0, 0, 0, 0);
            if (itemTime < startTime) return false;
          }
          if (customDates.end) {
            const endTime = new Date(customDates.end).setHours(23, 59, 59, 999);
            if (itemTime > endTime) return false;
          }
        }
      }

      return true;
    });
  }, [movements, searchQuery, selectedPlatformId, activeFilter, dateRange, customDates]);

  // Overall statistics for the summary ticker
  const stats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalReturns = 0;

    filteredMovements.forEach((m) => {
      if (m.type === "IN") totalIn += m.quantity;
      else if (m.type === "OUT") totalOut += m.quantity;
      else if (m.type.startsWith("RETURN")) totalReturns += m.quantity;
    });

    return {
      totalLogs: filteredMovements.length,
      totalIn,
      totalOut,
      totalReturns,
    };
  }, [filteredMovements]);

  // Platform count helper for Channel Filter Modal
  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let manual = 0;

    movements.forEach((m) => {
      if (m.platformId) {
        counts[m.platformId] = (counts[m.platformId] || 0) + 1;
      } else {
        manual++;
      }
    });

    return { counts, manual };
  }, [movements]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / itemsPerPage));
  const paginatedList = filteredMovements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 📱 Mobile Grouping by Date (Banking / Ledger App Style)
  const groupedMobileMovements = useMemo(() => {
    const groupsMap = new Map<string, DateGroup>();
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yesterdayKey = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;

    paginatedList.forEach((m) => {
      const d = new Date(m.date);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      
      if (!groupsMap.has(dateKey)) {
        const isToday = dateKey === todayKey;
        const isYesterday = dateKey === yesterdayKey;
        let displayDate = "";
        if (isToday) {
          displayDate = `Today • ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
        } else if (isYesterday) {
          displayDate = `Yesterday • ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
        } else {
          displayDate = d.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          });
        }

        groupsMap.set(dateKey, {
          dateKey,
          displayDate,
          isToday,
          isYesterday,
          totalIn: 0,
          totalOut: 0,
          totalReturns: 0,
          items: [],
        });
      }

      const group = groupsMap.get(dateKey)!;
      group.items.push(m);
      if (m.type === "IN") group.totalIn += m.quantity;
      else if (m.type === "OUT") group.totalOut += m.quantity;
      else if (m.type.startsWith("RETURN")) group.totalReturns += m.quantity;
    });

    return Array.from(groupsMap.values());
  }, [paginatedList]);

  // Active filters count
  const activeFiltersCount = 
    (activeFilter !== "ALL" ? 1 : 0) +
    (dateRange !== "ALL" ? 1 : 0) +
    (selectedPlatformId !== "ALL" ? 1 : 0) +
    (searchQuery ? 1 : 0);

  const dateRangeLabelMap: Record<DateRangeType, string> = {
    ALL: "All Time",
    TODAY: "Today",
    YESTERDAY: "Yesterday",
    "7D": "Last 7 Days",
    "30D": "Last 30 Days",
    THIS_MONTH: "This Month",
    CUSTOM: customDates.start && customDates.end
      ? `${customDates.start} → ${customDates.end}`
      : customDates.start
      ? `From ${customDates.start}`
      : "Custom Range...",
  };

  const selectedChannelName = 
    selectedPlatformId === "ALL"
      ? "All Channels"
      : selectedPlatformId === "MANUAL"
      ? "Manual Entry"
      : platforms.find(p => p.id === selectedPlatformId)?.name || "Channel";

  return (
    <div className="space-y-4 md:space-y-6 pb-24 md:pb-8">
      {/* ============================================================== */}
      {/* 📱 Mobile Top App Bar                                          */}
      {/* ============================================================== */}
      <div className="md:hidden flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 active:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Stock Movements</h1>
            <p className="text-[11px] text-gray-500 font-medium">Chronological Stock Ledger</p>
          </div>
        </div>

        <Link
          href="/inventory"
          className="text-xs font-semibold px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-xl active:bg-gray-200"
        >
          Inventory →
        </Link>
      </div>

      {/* ============================================================== */}
      {/* 🖥️ Desktop Header                                              */}
      {/* ============================================================== */}
      <div className="hidden md:flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </Link>
            <span className="text-gray-300">•</span>
            <span className="text-xs text-gray-400">Ledger & Audit Trail</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Movements & Ledger</h1>
          <p className="mt-1 text-sm text-gray-500">
            Chronological audit log of all restocks, marketplace dispatches, and customer/RTO returns.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
          >
            Manage Inventory
          </Link>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📱 Mobile Compact Summary Strip (App Style Micro-Ticker)       */}
      {/* ============================================================== */}
      <div className="md:hidden bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
        <div className="grid grid-cols-3 divide-x divide-gray-100 text-center">
          <div className="px-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> In
            </p>
            <p className="font-mono font-black text-emerald-700 text-base mt-0.5">
              +{stats.totalIn}
            </p>
            <p className="text-[9px] text-gray-400">Restocked</p>
          </div>

          <div className="px-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Out
            </p>
            <p className="font-mono font-black text-rose-700 text-base mt-0.5">
              -{stats.totalOut}
            </p>
            <p className="text-[9px] text-gray-400">Dispatched</p>
          </div>

          <div className="px-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Ret
            </p>
            <p className="font-mono font-black text-orange-700 text-base mt-0.5">
              ↺{stats.totalReturns}
            </p>
            <p className="text-[9px] text-gray-400">Returns</p>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 🖥️ Desktop Summary Cards Grid                                  */}
      {/* ============================================================== */}
      <div className="hidden md:grid grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Filtered Entries</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{stats.totalLogs}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Stock Restocked</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">+{stats.totalIn} pcs</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Orders Sold</p>
            <p className="text-xl font-bold text-rose-700 mt-0.5">-{stats.totalOut} pcs</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Returns</p>
            <p className="text-xl font-bold text-orange-700 mt-0.5">↺{stats.totalReturns} pcs</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
            <Undo2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 🔍 Interactive Filter Toolbar & Trigger Buttons                */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 md:p-4 space-y-3">
        {/* Top: Search Bar + Filter Modals Triggers */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search product, SKU, channel, note..."
              className="w-full pl-10 pr-9 py-2 text-xs md:text-sm bg-gray-50/90 border border-gray-150 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Trigger 1: Date Filter Button */}
          <button
            type="button"
            onClick={() => setIsDateModalOpen(true)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border transition-all cursor-pointer shrink-0 ${
              dateRange !== "ALL"
                ? "bg-indigo-50 text-indigo-700 border-indigo-200/80 shadow-xs font-bold"
                : "bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span className="truncate max-w-[130px] sm:max-w-none">{dateRangeLabelMap[dateRange]}</span>
            </div>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* Trigger 2: Channel Filter Button */}
          <button
            type="button"
            onClick={() => setIsChannelModalOpen(true)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border transition-all cursor-pointer shrink-0 ${
              selectedPlatformId !== "ALL"
                ? "bg-indigo-50 text-indigo-700 border-indigo-200/80 shadow-xs font-bold"
                : "bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-indigo-600" />
              <span className="truncate max-w-[120px] sm:max-w-none">{selectedChannelName}</span>
            </div>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </div>

        {/* Movement Type Quick Segmented Pills */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 -mx-1 px-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase mr-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Type:
            </span>

            {[
              { id: "ALL", label: "All Logs" },
              { id: "IN", label: "Stock IN (+)" },
              { id: "OUT", label: "Dispatched (-)" },
              { id: "RETURNS_ALL", label: "All Returns (↺)" },
              { id: "RETURN_RTO", label: "RTO Good" },
              { id: "RETURN_RTO_DEFECTIVE", label: "RTO Defect" },
              { id: "RETURN_GOOD", label: "Cust Good" },
              { id: "RETURN_DEFECTIVE", label: "Cust Defect" },
            ].map((chip) => {
              const isSelected = activeFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    setActiveFilter(chip.id as FilterType);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setActiveFilter("ALL");
                setDateRange("ALL");
                setSelectedPlatformId("ALL");
                setCustomDates({ start: "", end: "" });
                setCurrentPage(1);
              }}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 shrink-0 px-2 py-0.5 rounded-md hover:bg-rose-50 cursor-pointer"
            >
              Reset ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📋 Movement List / Feed                                        */}
      {/* ============================================================== */}
      {paginatedList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
          <Layers className="w-10 h-10 text-gray-300 mb-2" />
          <p className="text-sm font-semibold text-gray-900">No matching movement entries</p>
          <p className="text-xs text-gray-500 mt-1">Try resetting your search query, channel, or date filters.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setActiveFilter("ALL");
              setDateRange("ALL");
              setSelectedPlatformId("ALL");
              setCustomDates({ start: "", end: "" });
              setCurrentPage(1);
            }}
            className="mt-3 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <>
          {/* ============================================================== */}
          {/* 📱 MOBILE VIEW: Banking / Ledger App Date Grouped Feed         */}
          {/* ============================================================== */}
          <div className="md:hidden space-y-4">
            {groupedMobileMovements.map((group) => (
              <div key={group.dateKey} className="space-y-2">
                {/* Date Group Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <h3 className="text-xs font-bold text-gray-800 tracking-tight">
                      {group.displayDate}
                    </h3>
                  </div>

                  {/* Daily Subtotal Pill */}
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold">
                    {group.totalIn > 0 && (
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                        +{group.totalIn}
                      </span>
                    )}
                    {group.totalOut > 0 && (
                      <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                        -{group.totalOut}
                      </span>
                    )}
                    {group.totalReturns > 0 && (
                      <span className="text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                        ↺{group.totalReturns}
                      </span>
                    )}
                  </div>
                </div>

                {/* Group Items */}
                <div className="space-y-2">
                  {group.items.map((m) => {
                    const badge = getMovementBadge(m.type);
                    const Icon = badge.icon;

                    return (
                      <div
                        key={m.id}
                        className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm flex flex-col gap-2.5 transition-all"
                      >
                        {/* Main Info Row */}
                        <div className="flex items-start justify-between gap-2.5">
                          {/* Left: Direction Icon + Details */}
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${badge.iconBg}`}>
                              <Icon className="w-4 h-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <span className="font-mono text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {m.product.sku}
                                </span>
                                {m.platform && (
                                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Store className="w-2.5 h-2.5" />
                                    {m.platform.name}
                                  </span>
                                )}
                                {m.product.category && (
                                  <span className="text-[10px] text-gray-400 font-medium">
                                    • {m.product.category.name}
                                  </span>
                                )}
                              </div>

                              <h4 className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">
                                {m.product.name}
                              </h4>

                              {m.note && (
                                <p className="text-[11px] text-gray-500 italic mt-0.5 line-clamp-1">
                                  "{m.note}"
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right: Quantity Badge & Rate */}
                          <div className="text-right shrink-0">
                            <span className={`inline-block font-mono font-black text-xs px-2.5 py-1 rounded-xl ${badge.badgeBg}`}>
                              {badge.prefix}{m.quantity} pcs
                            </span>
                            {m.unitCost && m.unitCost > 0 ? (
                              <p className="text-[10px] font-bold text-blue-700 mt-1">
                                @ ₹{m.unitCost}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {/* Bottom Row: Timestamp, Badge, and Undo Action */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100/80 text-[11px]">
                          <div className="flex items-center gap-1.5 text-gray-400 font-medium">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.badgeBg}`}>
                              {badge.label}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-300" />
                              {new Date(m.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setMovementToRevert(m)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-rose-600 active:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 active:bg-rose-100 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Undo</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ============================================================== */}
          {/* 🖥️ DESKTOP VIEW: Sleek Table                                   */}
          {/* ============================================================== */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Product</th>
                  <th className="px-6 py-3.5">Action Type</th>
                  <th className="px-6 py-3.5">Channel / Platform</th>
                  <th className="px-6 py-3.5 text-right">Quantity</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedList.map((m) => {
                  const badge = getMovementBadge(m.type);
                  const Icon = badge.icon;

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      {/* Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        {new Date(m.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* Product */}
                      <td className="px-6 py-4">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 hover:text-blue-600 transition-colors">
                            {m.product.name}
                          </p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">
                            SKU: {m.product.sku} {m.product.category && `• ${m.product.category.name}`}
                          </p>
                          {m.note && (
                            <p className="text-xs text-gray-400 italic mt-0.5">"{m.note}"</p>
                          )}
                        </div>
                      </td>

                      {/* Action Type Badge */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badge.badgeBg}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {badge.label}
                          </span>

                          {m.unitCost && m.unitCost > 0 && (
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                              @ ₹{m.unitCost}/unit
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Channel */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-medium">
                        {m.platform ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold">
                            <Store className="w-3 h-3" />
                            {m.platform.name}
                          </span>
                        ) : (
                          <span className="text-gray-400">Manual Entry</span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`font-mono font-bold text-sm px-2.5 py-1 rounded-lg border ${badge.badgeBg}`}>
                          {badge.prefix}{m.quantity}
                        </span>
                      </td>

                      {/* Undo Action */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => setMovementToRevert(m)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200/60 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="Undo / Delete this entry"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Undo</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ============================================================== */}
          {/* Pagination Controls                                            */}
          {/* ============================================================== */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3.5 md:p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                ← Previous
              </button>

              <span className="text-xs font-medium text-gray-500">
                Page <strong className="text-gray-900">{currentPage}</strong> of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ============================================================== */}
      {/* 📅 MODAL 1: Filter by Date Range (Presets & Custom Dates)      */}
      {/* ============================================================== */}
      {isDateModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Filter by Date Range
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Quick presets or choose custom calendar dates</p>
              </div>
              <button 
                type="button"
                onClick={() => setIsDateModalOpen(false)} 
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets Grid */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase">Quick Presets</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "ALL", label: "All Time" },
                  { id: "TODAY", label: "Today" },
                  { id: "YESTERDAY", label: "Yesterday" },
                  { id: "7D", label: "Last 7 Days" },
                  { id: "30D", label: "Last 30 Days" },
                  { id: "THIS_MONTH", label: "This Month" },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setDateRange(preset.id as DateRangeType);
                      setIsDateModalOpen(false);
                      setCurrentPage(1);
                    }}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left border transition-all cursor-pointer flex items-center justify-between ${
                      dateRange === preset.id
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-bold"
                        : "bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100"
                    }`}
                  >
                    <span>{preset.label}</span>
                    {dateRange === preset.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range Form */}
            <div className="pt-3 border-t border-gray-100 space-y-2.5">
              <p className="text-[11px] font-bold text-gray-400 uppercase">Custom Date Range</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 block mb-1">From Date</label>
                  <input
                    type="date"
                    value={customDates.start}
                    onChange={(e) => setCustomDates(p => ({ ...p, start: e.target.value }))}
                    className="w-full text-xs font-medium bg-gray-50 border border-gray-150 rounded-xl p-2 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 block mb-1">To Date</label>
                  <input
                    type="date"
                    value={customDates.end}
                    onChange={(e) => setCustomDates(p => ({ ...p, end: e.target.value }))}
                    className="w-full text-xs font-medium bg-gray-50 border border-gray-150 rounded-xl p-2 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (customDates.start) {
                    setDateRange("CUSTOM");
                    setIsDateModalOpen(false);
                    setCurrentPage(1);
                  }
                }}
                disabled={!customDates.start}
                className="w-full py-2.5 mt-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Apply Custom Date Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 🏪 MODAL 2: Filter by Sales Channel / Platform                 */}
      {/* ============================================================== */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-indigo-600" />
                  Filter by Sales Channel
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Select a channel to view its dispatches & returns</p>
              </div>
              <button 
                type="button"
                onClick={() => setIsChannelModalOpen(false)} 
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              {/* All Channels Option */}
              <button
                type="button"
                onClick={() => {
                  setSelectedPlatformId("ALL");
                  setIsChannelModalOpen(false);
                  setCurrentPage(1);
                }}
                className={`w-full p-3 rounded-2xl flex items-center justify-between text-xs font-bold border transition-all cursor-pointer ${
                  selectedPlatformId === "ALL"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 opacity-70" />
                  <span>All Channels (Combined)</span>
                </div>
                <span className="text-[11px] font-mono opacity-80">{movements.length}</span>
              </button>

              {/* Individual Platform Channels */}
              {platforms.map((p) => {
                const count = platformCounts.counts[p.id] || 0;
                const isSelected = selectedPlatformId === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlatformId(p.id);
                      setIsChannelModalOpen(false);
                      setCurrentPage(1);
                    }}
                    className={`w-full p-3 rounded-2xl flex items-center justify-between text-xs font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs"
                        : "bg-white text-gray-800 border-gray-100 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Store className="w-3.5 h-3.5 opacity-60" />
                      <span>{p.name}</span>
                    </div>
                    <span className="text-[11px] font-mono opacity-80">{count} entries</span>
                  </button>
                );
              })}

              {/* Manual Entry Channel */}
              {platformCounts.manual > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlatformId("MANUAL");
                    setIsChannelModalOpen(false);
                    setCurrentPage(1);
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between text-xs font-semibold border transition-all cursor-pointer ${
                    selectedPlatformId === "MANUAL"
                      ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                      : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 opacity-60" />
                    <span>Manual / Direct Warehouse</span>
                  </div>
                  <span className="text-[11px] font-mono opacity-80">{platformCounts.manual} entries</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ⚠️ MODAL 3: In-House Custom Undo Modal (Replaces window.confirm) */}
      {/* ============================================================== */}
      {movementToRevert && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-gray-100 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">Undo Stock Movement</h3>
                  <p className="text-xs text-gray-500">Is entry ko ledger se delete karein</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isReverting && setMovementToRevert(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Movement Summary Details Card */}
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Product:</span>
                <span className="font-bold text-gray-900 text-right truncate max-w-[200px]">{movementToRevert.product.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">SKU:</span>
                <span className="font-mono font-semibold text-gray-700">{movementToRevert.product.sku}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Transaction:</span>
                <span className="font-bold text-gray-800">{getMovementBadge(movementToRevert.type).label}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Quantity:</span>
                <span className="font-bold text-gray-900">{movementToRevert.quantity} units</span>
              </div>
              {movementToRevert.platform && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Channel:</span>
                  <span className="font-semibold text-indigo-700">{movementToRevert.platform.name}</span>
                </div>
              )}
              {movementToRevert.unitCost && movementToRevert.unitCost > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Rate:</span>
                  <span className="font-bold text-blue-700">₹{movementToRevert.unitCost}/unit</span>
                </div>
              )}
            </div>

            {/* Impact Warning Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Automatic Stock Reversal:
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-900">
                Is entry ko delete karne par warehouse stock aur product ki average purchase cost automatically pehle jaise restore ho jayegi.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={isReverting}
                onClick={() => setMovementToRevert(null)}
                className="flex-1 py-2.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isReverting}
                onClick={confirmRevertAction}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition-colors shadow-sm shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isReverting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Reverting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Yes, Revert Entry
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
