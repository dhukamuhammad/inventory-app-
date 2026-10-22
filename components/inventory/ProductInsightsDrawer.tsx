"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  TrendingUp, 
  AlertTriangle, 
  XOctagon, 
  Loader2, 
  BarChart2, 
  Calendar, 
  RotateCcw, 
  AlertCircle,
  ArrowLeft,
  Store,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Package,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Undo2,
  XCircle,
  ChevronRight,
  ChevronDown,
  Check
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";
import { getProductInsights, deleteStockMovement } from "@/app/actions/inventory";

interface ProductInsightsDrawerProps {
  productId: string | null;
  initialTab?: TabType;
  onClose: () => void;
}

type DateRange = "ALL" | "TODAY" | "YESTERDAY" | "7D" | "30D" | "THIS_MONTH" | "CUSTOM";
type TabType = "OVERVIEW" | "PLATFORMS" | "HISTORY";

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const sold = payload.find((p: any) => p.dataKey === "sales")?.value || 0;
    const returns = payload.find((p: any) => p.dataKey === "returns")?.value || 0;
    const retained = Math.max(sold - returns, 0);
    const returnRate = sold > 0 ? ((returns / sold) * 100).toFixed(1) : "0.0";

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-white/10 text-xs space-y-2 min-w-[160px] pointer-events-none">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10 font-bold text-slate-300">
          <span>{label}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
            Number(returnRate) > 20 ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
          }`}>
            {returnRate}% Ret
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Dispatched:
            </span>
            <span className="font-bold text-white text-xs">{sold} pcs</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-rose-400" /> Returned:
            </span>
            <span className="font-bold text-rose-400 text-xs">{returns} pcs</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/10">
            <span className="text-[11px] text-slate-400">Net Kept:</span>
            <span className="font-bold text-emerald-400">{retained} pcs</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

function getMovementBadge(type: string) {
  switch (type) {
    case "IN":
      return {
        label: "Stock Added",
        badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
        iconBg: "bg-emerald-100 text-emerald-700",
        icon: ArrowDownRight,
        prefix: "+",
      };
    case "OUT":
      return {
        label: "Sold / Dispatched",
        badgeBg: "bg-rose-50 text-rose-800 border-rose-200",
        iconBg: "bg-rose-100 text-rose-700",
        icon: ArrowUpRight,
        prefix: "-",
      };
    case "RETURN_RTO":
      return {
        label: "RTO Return (Good)",
        badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
        iconBg: "bg-amber-100 text-amber-700",
        icon: Undo2,
        prefix: "↺+",
      };
    case "RETURN_RTO_DEFECTIVE":
      return {
        label: "RTO Defective",
        badgeBg: "bg-red-50 text-red-800 border-red-200",
        iconBg: "bg-red-100 text-red-700",
        icon: AlertTriangle,
        prefix: "↺!",
      };
    case "RETURN_GOOD":
      return {
        label: "Customer Return (Good)",
        badgeBg: "bg-teal-50 text-teal-800 border-teal-200",
        iconBg: "bg-teal-100 text-teal-700",
        icon: CheckCircle2,
        prefix: "↺+",
      };
    case "RETURN_DEFECTIVE":
      return {
        label: "Customer Return (Defective)",
        badgeBg: "bg-orange-50 text-orange-800 border-orange-200",
        iconBg: "bg-orange-100 text-orange-700",
        icon: XCircle,
        prefix: "↺!",
      };
    default:
      return {
        label: type,
        badgeBg: "bg-gray-50 text-gray-700 border-gray-200",
        iconBg: "bg-gray-100 text-gray-700",
        icon: Undo2,
        prefix: "",
      };
  }
}

export function ProductInsightsDrawer({ productId, initialTab = "OVERVIEW", onClose }: ProductInsightsDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [dateRange, setDateRange] = useState<DateRange>("ALL");
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("ALL");

  // Popup Modals for Date & Channels (matching Movements & Analytics)
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  const [historyFilter, setHistoryFilter] = useState<"ALL" | "IN" | "OUT" | "RETURN">("ALL");
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [movementToRevert, setMovementToRevert] = useState<any | null>(null);
  const [isReverting, setIsReverting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const confirmRevertAction = async () => {
    if (!movementToRevert) return;
    try {
      setIsReverting(true);
      setRevertingId(movementToRevert.id);
      await deleteStockMovement(movementToRevert.id);
      if (productId) {
        const freshData = await getProductInsights(productId);
        setData(freshData);
      }
      setMovementToRevert(null);
    } catch (err: any) {
      console.error("Failed to delete movement:", err);
      alert(err?.message || "Failed to revert movement entry");
    } finally {
      setIsReverting(false);
      setRevertingId(null);
    }
  };

  useEffect(() => {
    if (productId && initialTab) {
      setActiveTab(initialTab);
    } else if (!productId) {
      setActiveTab("OVERVIEW");
      setDateRange("ALL");
      setSelectedPlatformId("ALL");
    }
  }, [productId, initialTab]);

  useEffect(() => {
    if (productId) {
      setIsLoading(true);
      getProductInsights(productId).then((res) => {
        setData(res);
        setIsLoading(false);
      });
    } else {
      setData(null);
    }
  }, [productId]);

  // Platforms with sales counts for Channel Modal
  const availablePlatforms = useMemo(() => {
    if (!data || !data.history) return [];
    const platformsMap = new Map<string, { id: string; name: string; count: number }>();
    data.history.forEach((m: any) => {
      if (m.platformId && m.platform) {
        const existing = platformsMap.get(m.platformId);
        if (existing) {
          existing.count += 1;
        } else {
          platformsMap.set(m.platformId, { id: m.platformId, name: m.platform.name, count: 1 });
        }
      }
    });
    return Array.from(platformsMap.values());
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data || !data.history) return null;

    // 1. Filter History by Platform
    let filteredHistory = data.history;
    if (selectedPlatformId !== "ALL") {
      filteredHistory = filteredHistory.filter((m: any) => m.platformId === selectedPlatformId);
    }

    // 2. Filter History by Date
    const now = new Date();
    let startDate = new Date(0);

    if (dateRange !== "ALL") {
      const itemTime = now.getTime();
      if (dateRange === "TODAY") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateRange === "YESTERDAY") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      } else if (dateRange === "7D") {
        startDate = new Date(itemTime - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === "30D") {
        startDate = new Date(itemTime - 30 * 24 * 60 * 60 * 1000);
      } else if (dateRange === "THIS_MONTH") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (dateRange === "CUSTOM" && customDates.start) {
        startDate = new Date(customDates.start);
      }

      let endDate = now;
      if (dateRange === "YESTERDAY") {
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateRange === "CUSTOM" && customDates.end) {
        endDate = new Date(customDates.end);
        endDate.setHours(23, 59, 59, 999);
      }

      filteredHistory = filteredHistory.filter((m: any) => {
        const d = new Date(m.date);
        return d >= startDate && d <= endDate;
      });
    }

    // 3. Re-calculate stats with detailed RTO vs Customer breakdown
    let totalSold = 0, totalReturns = 0, rtoReturns = 0, customerReturns = 0;
    let rtoGood = 0, rtoDefective = 0, customerGood = 0, customerDefective = 0;
    const platformStats: Record<string, any> = {};

    filteredHistory.forEach((movement: any) => {
      const isReturn = movement.type.startsWith("RETURN");
      const isOut = movement.type === "OUT";

      if (isOut) totalSold += movement.quantity;
      else if (isReturn) {
        totalReturns += movement.quantity;
        if (movement.type === "RETURN_RTO") {
          rtoReturns += movement.quantity;
          rtoGood += movement.quantity;
        } else if (movement.type === "RETURN_RTO_DEFECTIVE") {
          rtoReturns += movement.quantity;
          rtoDefective += movement.quantity;
        } else if (movement.type === "RETURN_GOOD") {
          customerReturns += movement.quantity;
          customerGood += movement.quantity;
        } else if (movement.type === "RETURN_DEFECTIVE") {
          customerReturns += movement.quantity;
          customerDefective += movement.quantity;
        }
      }

      if (movement.platformId && movement.platform) {
        const pid = movement.platformId;
        if (!platformStats[pid]) {
          platformStats[pid] = {
            id: pid,
            platformName: movement.platform.name,
            sold: 0,
            returns: 0,
            rtoTotal: 0,
            rtoGood: 0,
            rtoDefective: 0,
            customerTotal: 0,
            customerGood: 0,
            customerDefective: 0,
          };
        }

        if (isOut) platformStats[pid].sold += movement.quantity;
        else if (isReturn) {
          platformStats[pid].returns += movement.quantity;
          if (movement.type === "RETURN_RTO") {
            platformStats[pid].rtoTotal += movement.quantity;
            platformStats[pid].rtoGood += movement.quantity;
          } else if (movement.type === "RETURN_RTO_DEFECTIVE") {
            platformStats[pid].rtoTotal += movement.quantity;
            platformStats[pid].rtoDefective += movement.quantity;
          } else if (movement.type === "RETURN_GOOD") {
            platformStats[pid].customerTotal += movement.quantity;
            platformStats[pid].customerGood += movement.quantity;
          } else if (movement.type === "RETURN_DEFECTIVE") {
            platformStats[pid].customerTotal += movement.quantity;
            platformStats[pid].customerDefective += movement.quantity;
          }
        }
      }
    });

    const overallReturnRate = totalSold > 0 ? (totalReturns / totalSold) * 100 : 0;
    const rtoRate = totalSold > 0 ? (rtoReturns / totalSold) * 100 : 0;
    const customerRate = totalSold > 0 ? (customerReturns / totalSold) * 100 : 0;

    const platformPerformance = Object.values(platformStats)
      .map((stat: any) => ({
        ...stat,
        returnRate: stat.sold > 0 ? (stat.returns / stat.sold) * 100 : 0,
        rtoRate: stat.sold > 0 ? (stat.rtoTotal / stat.sold) * 100 : 0,
        customerRate: stat.sold > 0 ? (stat.customerTotal / stat.sold) * 100 : 0,
      }))
      .sort((a: any, b: any) => b.sold - a.sold);

    // 4. Chart Data Generation
    const bucketsMap: Record<string, { label: string, sales: number, returns: number, date: Date }> = {};

    filteredHistory.forEach((m: any) => {
      if (m.type === 'IN') return;

      const d = new Date(m.date);
      let key = "", label = "";

      if (dateRange === "ALL") {
        key = `${d.getFullYear()}-${d.getMonth()}`;
        label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      } else {
        key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      if (!bucketsMap[key]) bucketsMap[key] = { label, sales: 0, returns: 0, date: d };

      if (m.type === 'OUT') bucketsMap[key].sales += m.quantity;
      else if (m.type.startsWith('RETURN')) bucketsMap[key].returns += m.quantity;
    });

    let chartBuckets = Object.values(bucketsMap).sort((a, b) => a.date.getTime() - b.date.getTime());

    // Ensure at least 7 days for 7D view even if empty
    if (dateRange === "7D") {
      const days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return { label: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), date: d, sales: 0, returns: 0 };
      });
      filteredHistory.forEach((m: any) => {
        if (m.type === 'IN') return;
        const md = new Date(m.date);
        const day = days.find(d => d.date.getDate() === md.getDate() && d.date.getMonth() === md.getMonth() && d.date.getFullYear() === md.getFullYear());
        if (day) { if (m.type === 'OUT') day.sales += m.quantity; else if (m.type.startsWith('RETURN')) day.returns += m.quantity; }
      });
      chartBuckets = days;
    }

    const chartData = chartBuckets.map(d => ({ ...d }));

    return {
      stats: { 
        totalSold, 
        totalReturns, 
        rtoReturns, 
        customerReturns, 
        rtoGood, 
        rtoDefective, 
        customerGood, 
        customerDefective, 
        overallReturnRate,
        rtoRate,
        customerRate
      },
      platformPerformance,
      history: filteredHistory,
      chartData
    };
  }, [data, dateRange, customDates, selectedPlatformId]);

  // Grouped history for Ledger tab
  const groupedHistory = useMemo(() => {
    if (!filteredData) return [];
    const list = filteredData.history.filter((m: any) => {
      if (historyFilter === "ALL") return true;
      if (historyFilter === "RETURN") return m.type.startsWith("RETURN");
      return m.type === historyFilter;
    });

    const groupsMap = new Map<string, { dateKey: string; displayDate: string; items: any[] }>();
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yesterdayKey = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;

    list.forEach((m: any) => {
      const d = new Date(m.date);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      if (!groupsMap.has(dateKey)) {
        let displayDate = "";
        if (dateKey === todayKey) {
          displayDate = `Today • ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
        } else if (dateKey === yesterdayKey) {
          displayDate = `Yesterday • ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
        } else {
          displayDate = d.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
          });
        }
        groupsMap.set(dateKey, { dateKey, displayDate, items: [] });
      }

      groupsMap.get(dateKey)!.items.push(m);
    });

    return Array.from(groupsMap.values());
  }, [filteredData, historyFilter]);

  if (!productId || !mounted) return null;

  const product = data?.product;
  const isOutOfStock = product ? product.currentStock <= 0 : false;
  const isLowStock = product ? !isOutOfStock && product.currentStock <= product.lowStockAlertAt : false;
  const retainedUnits = filteredData ? Math.max(filteredData.stats.totalSold - filteredData.stats.totalReturns, 0) : 0;
  const retainedPct = filteredData && filteredData.stats.totalSold > 0 
    ? (retainedUnits / filteredData.stats.totalSold) * 100 
    : 0;
  const returnPct = filteredData && filteredData.stats.totalSold > 0 
    ? (filteredData.stats.totalReturns / filteredData.stats.totalSold) * 100 
    : 0;

  const dateRangeLabelMap: Record<DateRange, string> = {
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
      : availablePlatforms.find(p => p.id === selectedPlatformId)?.name || "Channel";

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[80] transition-opacity animate-in fade-in" 
        onClick={onClose} 
      />

      {/* Drawer / Full Mobile Sheet */}
      <div className="fixed inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-[620px] bg-gray-50 z-[90] flex flex-col shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-right duration-200">

        {/* ============================================================== */}
        {/* 📱 Mobile & Desktop Top Navigation Bar                         */}
        {/* ============================================================== */}
        <div className="bg-white px-4 py-3.5 border-b border-gray-100 shrink-0 shadow-2xs">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* Back button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -ml-1 text-gray-700 hover:text-gray-900 active:bg-gray-100 rounded-full transition-colors cursor-pointer shrink-0"
                title="Back to Inventory"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {product?.sku && (
                    <span className="font-mono text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded">
                      {product.sku}
                    </span>
                  )}
                  {product?.category?.name && (
                    <span className="text-[10px] text-gray-400 font-medium truncate">
                      • {product.category.name}
                    </span>
                  )}
                </div>

                <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate leading-tight mt-0.5">
                  {product ? product.name : "Loading SKU..."}
                </h2>
              </div>
            </div>

            {/* Live Stock & Valuation Badge */}
            {product && (
              <div className="text-right shrink-0">
                <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black font-mono border ${
                  isOutOfStock 
                    ? "bg-rose-50 text-rose-700 border-rose-200" 
                    : isLowStock 
                    ? "bg-amber-50 text-amber-800 border-amber-200" 
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}>
                  {product.currentStock} Units
                </span>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                  Cost: ₹{product.costPrice}
                </p>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* 🏷️ Segmented App Pill Switcher (Tabs)                           */}
          {/* ============================================================== */}
          <div className="mt-3 grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold">
            {[
              { id: "OVERVIEW", label: "Performance", icon: BarChart2 },
              { id: "PLATFORMS", label: "Channels", icon: Store },
              { id: "HISTORY", label: "Ledger", icon: Clock },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`py-2 px-1 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-sm font-bold"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 📅 Interactive Filter Toolbar with Popup Modals Triggers        */}
        {/* ============================================================== */}
        <div className="bg-white px-4 py-2.5 border-b border-gray-100 sticky top-0 z-10 flex items-center gap-2">
          {/* Trigger 1: Date Filter Popup Trigger */}
          <button
            type="button"
            onClick={() => setIsDateModalOpen(true)}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-1.5 border transition-all cursor-pointer ${
              dateRange !== "ALL"
                ? "bg-indigo-50 text-indigo-700 border-indigo-200/80 font-bold"
                : "bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">{dateRangeLabelMap[dateRange]}</span>
            </div>
            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
          </button>

          {/* Trigger 2: Channel Filter Popup Trigger */}
          <button
            type="button"
            onClick={() => setIsChannelModalOpen(true)}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-1.5 border transition-all cursor-pointer ${
              selectedPlatformId !== "ALL"
                ? "bg-indigo-50 text-indigo-700 border-indigo-200/80 font-bold"
                : "bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <Store className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">{selectedChannelName}</span>
            </div>
            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
          </button>

          {/* Reset button if filtered */}
          {(dateRange !== "ALL" || selectedPlatformId !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setDateRange("ALL");
                setSelectedPlatformId("ALL");
                setCustomDates({ start: "", end: "" });
              }}
              className="px-2 py-1.5 text-xs text-rose-600 hover:text-rose-700 font-bold hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
              title="Reset Filters"
            >
              Reset
            </button>
          )}
        </div>

        {/* ============================================================== */}
        {/* 📱 TAB CONTENT: Native Scrollable App Body                     */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-600" />
              <p className="text-xs font-semibold">Fetching detailed SKU analytics...</p>
            </div>
          ) : filteredData ? (
            <>
              {/* ============================================================== */}
              {/* TAB 1: OVERVIEW / PERFORMANCE                                  */}
              {/* ============================================================== */}
              {activeTab === "OVERVIEW" && (
                <div className="space-y-3.5">
                  {/* 3 Executive Touch Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-gray-400 text-[10px] font-bold uppercase">Dispatched</p>
                      <p className="font-bold text-gray-900 text-base mt-0.5">{filteredData.stats.totalSold}</p>
                      <p className="text-[10px] text-gray-400">Total Sold</p>
                    </div>

                    <div className="bg-rose-50/60 p-3 rounded-2xl shadow-sm border-0">
                      <p className="text-rose-500 text-[10px] font-bold uppercase">Returned</p>
                      <p className="font-bold text-rose-700 text-base mt-0.5">{filteredData.stats.totalReturns}</p>
                      <p className="text-[10px] text-rose-600 font-semibold">{filteredData.stats.overallReturnRate.toFixed(1)}% Rate</p>
                    </div>

                    <div className="bg-emerald-50/60 p-3 rounded-2xl shadow-sm border-0">
                      <p className="text-emerald-600 text-[10px] font-bold uppercase">Net Kept</p>
                      <p className="font-bold text-emerald-800 text-base mt-0.5">{retainedUnits}</p>
                      <p className="text-[10px] text-emerald-700 font-semibold">{retainedPct.toFixed(0)}% Retained</p>
                    </div>
                  </div>

                  {/* 🎯 RTO Return % vs Customer Return % Dedicated Split Cards */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <div>
                        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                          Return Type Breakdown & Percentage
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Calculated against {filteredData.stats.totalSold} total dispatched orders
                        </p>
                      </div>
                      <span className="text-xs font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg">
                        {filteredData.stats.overallReturnRate.toFixed(1)}% Total
                      </span>
                    </div>

                    {/* 2 Big Cards: RTO Return % vs Customer Return % */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Card A: RTO Courier Return */}
                      <div className="bg-amber-50/60 p-3.5 rounded-2xl text-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-900 flex items-center gap-1 text-[11px]">
                              <Undo2 className="w-3.5 h-3.5 text-amber-600" />
                              RTO Courier Return
                            </span>
                          </div>

                          <div className="mt-1.5">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xl font-black text-amber-950 font-mono">
                                {filteredData.stats.rtoReturns}
                              </span>
                              <span className="text-xs font-normal text-amber-700">pcs</span>
                            </div>
                            <p className="text-xs font-black text-amber-800 mt-0.5">
                              {filteredData.stats.rtoRate.toFixed(1)}% of Sold
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 mt-2 border-t border-amber-200/40 text-[10px] text-amber-800">
                          <p>Good: <strong>{filteredData.stats.rtoGood}</strong> • Damaged: <strong>{filteredData.stats.rtoDefective}</strong></p>
                        </div>
                      </div>

                      {/* Card B: Customer Buyer Return */}
                      <div className="bg-teal-50/60 p-3.5 rounded-2xl text-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-teal-900 flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                              Customer Return
                            </span>
                          </div>

                          <div className="mt-1.5">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xl font-black text-teal-950 font-mono">
                                {filteredData.stats.customerReturns}
                              </span>
                              <span className="text-xs font-normal text-teal-700">pcs</span>
                            </div>
                            <p className="text-xs font-black text-teal-800 mt-0.5">
                              {filteredData.stats.customerRate.toFixed(1)}% of Sold
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 mt-2 border-t border-teal-200/40 text-[10px] text-teal-800">
                          <p>Good: <strong>{filteredData.stats.customerGood}</strong> • Defect: <strong>{filteredData.stats.customerDefective}</strong></p>
                        </div>
                      </div>
                    </div>

                    {/* Dual Split Track: Delivered vs RTO vs Cust */}
                    <div className="space-y-1.5 pt-1">
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${retainedPct}%` }}
                          title={`Net Kept: ${retainedUnits}`}
                        />
                        <div
                          className="h-full bg-amber-500 transition-all"
                          style={{ width: `${filteredData.stats.totalSold > 0 ? (filteredData.stats.rtoReturns / filteredData.stats.totalSold) * 100 : 0}%` }}
                          title={`RTO: ${filteredData.stats.rtoReturns}`}
                        />
                        <div
                          className="h-full bg-rose-500 transition-all"
                          style={{ width: `${filteredData.stats.totalSold > 0 ? (filteredData.stats.customerReturns / filteredData.stats.totalSold) * 100 : 0}%` }}
                          title={`Customer: ${filteredData.stats.customerReturns}`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500">
                        <span className="text-emerald-700">Kept ({retainedPct.toFixed(0)}%)</span>
                        <span className="text-amber-700">RTO ({filteredData.stats.rtoRate.toFixed(1)}%)</span>
                        <span className="text-rose-700">Cust ({filteredData.stats.customerRate.toFixed(1)}%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Return Quality Breakdown (Good vs Defective Quarantined) */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2.5">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Return Condition Quality
                    </h3>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-emerald-50/60 p-3 rounded-xl text-xs">
                        <div className="flex items-center gap-1 font-bold text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Resellable Good</span>
                        </div>
                        <p className="text-lg font-black text-emerald-950 mt-0.5">
                          {filteredData.stats.rtoGood + filteredData.stats.customerGood} pcs
                        </p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">Restocked into active inventory</p>
                      </div>

                      <div className="bg-rose-50/60 p-3 rounded-xl text-xs">
                        <div className="flex items-center gap-1 font-bold text-rose-800">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Defective Loss</span>
                        </div>
                        <p className="text-lg font-black text-rose-950 mt-0.5">
                          {filteredData.stats.rtoDefective + filteredData.stats.customerDefective} pcs
                        </p>
                        <p className="text-[10px] text-rose-700 font-semibold mt-0.5">
                          ₹{((filteredData.stats.rtoDefective + filteredData.stats.customerDefective) * (product?.costPrice || 0)).toLocaleString()} Quarantined
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recharts Sales vs Returns Trend */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                        <BarChart2 className="w-4 h-4 text-indigo-600" />
                        Sales vs Returns Trend
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] font-bold">
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          +{filteredData.stats.totalSold} Sold
                        </span>
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                          ↺{filteredData.stats.totalReturns} Ret
                        </span>
                      </div>
                    </div>

                    {filteredData.chartData.length > 0 ? (
                      <div>
                        <div className="w-full h-52 pt-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={filteredData.chartData}
                              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                              barGap={3}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }}
                                dy={6}
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#94a3b8", fontSize: 10 }}
                                allowDecimals={false}
                              />
                              <Tooltip
                                content={<CustomChartTooltip />}
                                cursor={{ fill: "rgba(241, 245, 249, 0.7)", radius: 6 }}
                              />
                              <Bar
                                dataKey="sales"
                                name="Sales (Out)"
                                fill="#10b981"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={26}
                              />
                              <Bar
                                dataKey="returns"
                                name="Returns"
                                fill="#f43f5e"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={26}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-gray-400 text-center mt-2 font-medium">
                          💡 Bar par tap karein exact pieces aur return rate dekhne ke liye
                        </p>
                      </div>
                    ) : (
                      <div className="h-36 flex items-center justify-center text-gray-400 text-xs">
                        No transactions found for this period.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 2: CHANNELS / PLATFORMS (WITH RTO % & CUST % BREAKDOWN)     */}
              {/* ============================================================== */}
              {activeTab === "PLATFORMS" && (
                <div className="space-y-3">
                  {filteredData.platformPerformance.length > 0 ? (
                    filteredData.platformPerformance.map((p: any) => {
                      const isHigh = p.returnRate > 20;
                      const isModerate = p.returnRate >= 12 && p.returnRate <= 20;
                      const netKept = Math.max(p.sold - p.returns, 0);
                      const channelKeptPct = p.sold > 0 ? (netKept / p.sold) * 100 : 0;
                      const channelRetPct = p.sold > 0 ? (p.returns / p.sold) * 100 : 0;

                      return (
                        <div
                          key={p.id}
                          className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3"
                        >
                          {/* Channel Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                {p.platformName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 text-sm leading-tight">{p.platformName}</h4>
                                <p className="text-[10px] text-gray-400">{p.sold} Orders Dispatched</p>
                              </div>
                            </div>

                            <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                              isHigh 
                                ? "bg-rose-50 text-rose-700" 
                                : isModerate 
                                ? "bg-amber-50 text-amber-800" 
                                : "bg-emerald-50 text-emerald-800"
                            }`}>
                              {p.returnRate.toFixed(1)}% Total Ret
                            </span>
                          </div>

                          {/* Split Bar */}
                          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex">
                            <div className="h-full bg-emerald-500" style={{ width: `${channelKeptPct}%` }} />
                            <div className="h-full bg-rose-500" style={{ width: `${channelRetPct}%` }} />
                          </div>

                          {/* 3 Metrics: Sold, Returned, Net Kept */}
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-gray-50/80 p-2 rounded-xl">
                              <p className="text-gray-400 text-[9px] font-bold uppercase">Sold</p>
                              <p className="font-bold text-gray-900 text-sm mt-0.5">{p.sold}</p>
                            </div>
                            <div className="bg-rose-50/70 p-2 rounded-xl">
                              <p className="text-rose-500 text-[9px] font-bold uppercase">Returned</p>
                              <p className="font-bold text-rose-700 text-sm mt-0.5">{p.returns}</p>
                            </div>
                            <div className="bg-emerald-50/70 p-2 rounded-xl">
                              <p className="text-emerald-600 text-[9px] font-bold uppercase">Net Kept</p>
                              <p className="font-bold text-emerald-800 text-sm mt-0.5">{netKept}</p>
                            </div>
                          </div>

                          {/* 🎯 RTO % vs Customer % Micro Split for this Channel */}
                          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
                            {/* Channel RTO with % */}
                            <div className="bg-amber-50/60 p-2.5 rounded-xl">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-amber-800">RTO Courier</span>
                                <span className="font-black text-amber-900 font-mono text-[11px]">{p.rtoRate.toFixed(1)}%</span>
                              </div>
                              <p className="font-bold text-amber-950 mt-0.5">{p.rtoTotal} pcs</p>
                              <p className="text-[9px] text-amber-700 mt-0.5">({p.rtoGood} Good • {p.rtoDefective} Bad)</p>
                            </div>

                            {/* Channel Customer Return with % */}
                            <div className="bg-teal-50/60 p-2.5 rounded-xl">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-teal-800">Cust Return</span>
                                <span className="font-black text-teal-900 font-mono text-[11px]">{p.customerRate.toFixed(1)}%</span>
                              </div>
                              <p className="font-bold text-teal-950 mt-0.5">{p.customerTotal} pcs</p>
                              <p className="text-[9px] text-teal-700 mt-0.5">({p.customerGood} Good • {p.customerDefective} Bad)</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-xs border border-gray-100">
                      No marketplace sales recorded for this SKU.
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 3: LEDGER HISTORY (BANKING / APP STYLE DATE GROUPING)       */}
              {/* ============================================================== */}
              {activeTab === "HISTORY" && (
                <div className="space-y-3.5">
                  {/* History Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {[
                      { id: "ALL", label: "All Logs" },
                      { id: "IN", label: "Stock IN (+)" },
                      { id: "OUT", label: "Dispatched (-)" },
                      { id: "RETURN", label: "Returns (↺)" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setHistoryFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                          historyFilter === f.id
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-white text-gray-600 border border-gray-100 hover:bg-gray-50"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Date Grouped Transaction Cards */}
                  {groupedHistory.length > 0 ? (
                    groupedHistory.map((group) => (
                      <div key={group.dateKey} className="space-y-2">
                        {/* Group Header */}
                        <div className="flex items-center gap-1.5 px-1 pt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                          <h4 className="text-xs font-bold text-gray-800 tracking-tight">
                            {group.displayDate}
                          </h4>
                        </div>

                        {/* Group Items */}
                        <div className="space-y-2">
                          {group.items.map((m: any) => {
                            const badge = getMovementBadge(m.type);
                            const Icon = badge.icon;
                            const isDeleting = revertingId === m.id;

                            return (
                              <div
                                key={m.id}
                                className={`bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm flex items-center justify-between gap-2.5 transition-all ${
                                  isDeleting ? "opacity-50 pointer-events-none" : ""
                                }`}
                              >
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${badge.iconBg}`}>
                                    <Icon className="w-4 h-4" />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-gray-900 text-xs">
                                        {badge.label}
                                      </span>
                                      {m.platform && (
                                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
                                          {m.platform.name}
                                        </span>
                                      )}
                                      {m.unitCost && m.unitCost > 0 && (
                                        <span className="text-[10px] font-bold text-blue-700">
                                          @ ₹{m.unitCost}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                                      <Clock className="w-3 h-3 text-gray-300" />
                                      <span>
                                        {new Date(m.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                      {m.note && (
                                        <>
                                          <span>•</span>
                                          <span className="italic text-gray-500 truncate max-w-[140px]">
                                            "{m.note}"
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`font-mono font-black text-xs px-2 py-0.5 rounded-lg border ${badge.badgeBg}`}>
                                    {badge.prefix}{m.quantity}
                                  </span>

                                  {/* Undo Button */}
                                  <button
                                    type="button"
                                    onClick={() => setMovementToRevert(m)}
                                    disabled={isDeleting}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 active:bg-rose-50 transition-colors cursor-pointer"
                                    title="Undo this entry"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-xs border border-gray-100">
                      No ledger history for this selection.
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📅 MODAL 1: Date Range Filter Bottom Sheet                     */}
      {/* ============================================================== */}
      {isDateModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Filter by Date Range
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Select a preset or custom calendar dates</p>
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
                      setDateRange(preset.id as DateRange);
                      setIsDateModalOpen(false);
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

            {/* Custom Date Range */}
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
      {/* 🏪 MODAL 2: Channel Filter Bottom Sheet                        */}
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
                  Filter by Marketplace Channel
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Select a channel to view its orders & returns for this SKU</p>
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
                {selectedPlatformId === "ALL" && <Check className="w-4 h-4 text-white" />}
              </button>

              {/* Individual Platform Channels */}
              {availablePlatforms.map((p) => {
                const isSelected = selectedPlatformId === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlatformId(p.id);
                      setIsChannelModalOpen(false);
                    }}
                    className={`w-full p-3 rounded-2xl flex items-center justify-between text-xs font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                        : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Store className="w-3.5 h-3.5 opacity-60" />
                      <span>{p.name}</span>
                    </div>
                    <span className="text-[11px] font-mono opacity-80">{p.count} entries</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ⚠️ MODAL 3: In-House Custom Undo Confirmation Modal            */}
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
                  <h3 className="font-bold text-base text-gray-900">Undo Stock Entry</h3>
                  <p className="text-xs text-gray-500">Delete this transaction from history</p>
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

            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Product:</span>
                <span className="font-bold text-gray-900 text-right truncate max-w-[200px]">
                  {product?.name || "Product"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">SKU:</span>
                <span className="font-mono font-semibold text-gray-700">
                  {product?.sku || ""}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Entry Type:</span>
                <span className="font-bold text-gray-800">
                  {getMovementBadge(movementToRevert.type).label}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Quantity:</span>
                <span className="font-bold text-gray-900">{movementToRevert.quantity} units</span>
              </div>
              {movementToRevert.unitCost && movementToRevert.unitCost > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Purchase Rate:</span>
                  <span className="font-bold text-blue-700">₹{movementToRevert.unitCost}/unit</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Automatic Stock Reversal:
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-900">
                Is entry ko delete karne se stock aur product ki average purchase cost automatically pehle jaise restore ho jayegi.
              </p>
            </div>

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
    </>,
    document.body
  );
}
