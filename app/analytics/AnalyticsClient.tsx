"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle, 
  XOctagon, 
  Calendar, 
  BarChart2, 
  CheckCircle2, 
  RotateCcw,
  Package,
  Layers,
  ShoppingBag,
  AlertCircle,
  ShieldCheck,
  Percent,
  IndianRupee,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Store
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

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  defectiveStock: number;
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

interface AnalyticsClientProps {
  initialData: {
    products: ProductItem[];
    movements: MovementItem[];
    platforms: PlatformItem[];
  };
}

type DateRange = "7D" | "1M" | "3M" | "6M" | "1Y" | "ALL" | "CUSTOM";

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const sold = payload.find((p: any) => p.dataKey === "sales")?.value || 0;
    const returns = payload.find((p: any) => p.dataKey === "returns")?.value || 0;
    const retained = Math.max(sold - returns, 0);
    const returnRate = sold > 0 ? ((returns / sold) * 100).toFixed(1) : "0.0";

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-white/10 text-xs space-y-2 min-w-[170px] pointer-events-none">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10 font-bold text-slate-300">
          <span>{label}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
            Number(returnRate) > 20 ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
          }`}>
            {returnRate}% Ret
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Dispatched:
            </span>
            <span className="font-bold text-white text-sm">{sold} pcs</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-rose-400" /> Returned:
            </span>
            <span className="font-bold text-rose-400 text-sm">{returns} pcs</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/10">
            <span className="text-[11px] text-slate-400">Net Retained:</span>
            <span className="font-bold text-emerald-400">{retained} pcs</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function AnalyticsClient({ initialData }: AnalyticsClientProps) {
  const { products, movements, platforms } = initialData;

  const [dateRange, setDateRange] = useState<DateRange>("ALL");
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("ALL");
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter movements according to Date & Platform
  const filteredData = useMemo(() => {
    let list = movements;

    // Platform filter
    if (selectedPlatformId !== "ALL") {
      list = list.filter((m) => m.platformId === selectedPlatformId);
    }

    // Date filter
    const now = new Date();
    let startDate = new Date(0);

    if (dateRange !== "ALL") {
      if (dateRange === "7D") startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (dateRange === "1M") startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      else if (dateRange === "3M") startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      else if (dateRange === "6M") startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      else if (dateRange === "1Y") startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      else if (dateRange === "CUSTOM" && customDates.start) {
        startDate = new Date(customDates.start);
      }

      let endDate = now;
      if (dateRange === "CUSTOM" && customDates.end) {
        endDate = new Date(customDates.end);
        endDate.setHours(23, 59, 59, 999);
      }

      list = list.filter((m) => {
        const d = new Date(m.date);
        return d >= startDate && d <= endDate;
      });
    }

    // Compute overall global stats
    let totalSold = 0;
    let totalReturns = 0;
    let rtoGood = 0;
    let rtoDefective = 0;
    let customerGood = 0;
    let customerDefective = 0;

    const platformStats: Record<string, {
      name: string;
      sold: number;
      returns: number;
      rtoGood: number;
      rtoDefective: number;
      custGood: number;
      custDefective: number;
    }> = {};

    // Initialize all platforms
    platforms.forEach((p) => {
      platformStats[p.id] = {
        name: p.name,
        sold: 0,
        returns: 0,
        rtoGood: 0,
        rtoDefective: 0,
        custGood: 0,
        custDefective: 0,
      };
    });

    // Product-wise sales & returns for Top Returns calculation
    const productMetricsMap: Record<string, {
      product: ProductItem;
      sold: number;
      returns: number;
    }> = {};

    products.forEach((p) => {
      productMetricsMap[p.id] = {
        product: p,
        sold: 0,
        returns: 0,
      };
    });

    list.forEach((m) => {
      const isOut = m.type === "OUT";
      const isReturn = m.type.startsWith("RETURN");

      if (isOut) {
        totalSold += m.quantity;
        if (productMetricsMap[m.productId]) {
          productMetricsMap[m.productId].sold += m.quantity;
        }
        if (m.platformId && platformStats[m.platformId]) {
          platformStats[m.platformId].sold += m.quantity;
        }
      } else if (isReturn) {
        totalReturns += m.quantity;
        if (productMetricsMap[m.productId]) {
          productMetricsMap[m.productId].returns += m.quantity;
        }

        if (m.type === "RETURN_RTO") rtoGood += m.quantity;
        else if (m.type === "RETURN_RTO_DEFECTIVE") rtoDefective += m.quantity;
        else if (m.type === "RETURN_GOOD") customerGood += m.quantity;
        else if (m.type === "RETURN_DEFECTIVE") customerDefective += m.quantity;

        if (m.platformId && platformStats[m.platformId]) {
          platformStats[m.platformId].returns += m.quantity;
          if (m.type === "RETURN_RTO") platformStats[m.platformId].rtoGood += m.quantity;
          else if (m.type === "RETURN_RTO_DEFECTIVE") platformStats[m.platformId].rtoDefective += m.quantity;
          else if (m.type === "RETURN_GOOD") platformStats[m.platformId].custGood += m.quantity;
          else if (m.type === "RETURN_DEFECTIVE") platformStats[m.platformId].custDefective += m.quantity;
        }
      }
    });

    const overallReturnRate = totalSold > 0 ? (totalReturns / totalSold) * 100 : 0;
    const totalRto = rtoGood + rtoDefective;
    const totalCustomer = customerGood + customerDefective;

    // Platform performance list
    const platformList = Object.entries(platformStats)
      .map(([id, stat]) => ({
        id,
        ...stat,
        returnRate: stat.sold > 0 ? (stat.returns / stat.sold) * 100 : 0,
      }))
      .filter((p) => p.sold > 0 || p.returns > 0)
      .sort((a, b) => b.sold - a.sold);

    // Top 5 Return Products (minimum 1 return)
    const topReturnProducts = Object.values(productMetricsMap)
      .filter((item) => item.returns > 0)
      .map((item) => ({
        ...item,
        rate: item.sold > 0 ? (item.returns / item.sold) * 100 : 100,
      }))
      .sort((a, b) => b.returns - a.returns || b.rate - a.rate)
      .slice(0, 5);

    // Trend Chart Buckets (Daily or Monthly)
    const bucketsMap: Record<string, { label: string; sales: number; returns: number; date: Date }> = {};

    list.forEach((m) => {
      if (m.type === "IN") return;

      const d = new Date(m.date);
      let key = "";
      let label = "";

      if (dateRange === "1Y" || dateRange === "ALL") {
        key = `${d.getFullYear()}-${d.getMonth()}`;
        label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      } else {
        key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }

      if (!bucketsMap[key]) bucketsMap[key] = { label, sales: 0, returns: 0, date: d };

      if (m.type === "OUT") bucketsMap[key].sales += m.quantity;
      else if (m.type.startsWith("RETURN")) bucketsMap[key].returns += m.quantity;
    });

    let chartBuckets = Object.values(bucketsMap).sort((a, b) => a.date.getTime() - b.date.getTime());

    if (dateRange === "7D") {
      const days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          label: d.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
          date: d,
          sales: 0,
          returns: 0,
        };
      });
      list.forEach((m) => {
        if (m.type === "IN") return;
        const md = new Date(m.date);
        const day = days.find(
          (d) =>
            d.date.getDate() === md.getDate() &&
            d.date.getMonth() === md.getMonth() &&
            d.date.getFullYear() === md.getFullYear()
        );
        if (day) {
          if (m.type === "OUT") day.sales += m.quantity;
          else if (m.type.startsWith("RETURN")) day.returns += m.quantity;
        }
      });
      chartBuckets = days;
    }

    const maxVal = Math.max(...chartBuckets.flatMap((d) => [d.sales, d.returns]), 1);
    const chartData = chartBuckets.map((d) => ({
      ...d,
      salesPct: `${(d.sales / maxVal) * 100}%`,
      returnsPct: `${(d.returns / maxVal) * 100}%`,
    }));

    // Defective Stock Valuation across all products
    const totalDefectiveUnits = products.reduce((sum, p) => sum + (p.defectiveStock || 0), 0);
    const totalDefectiveValue = products.reduce(
      (sum, p) => sum + ((p.defectiveStock || 0) * (p.costPrice || 0)),
      0
    );

    return {
      stats: {
        totalSold,
        totalReturns,
        overallReturnRate,
        totalRto,
        totalCustomer,
        rtoGood,
        rtoDefective,
        customerGood,
        customerDefective,
        totalDefectiveUnits,
        totalDefectiveValue,
      },
      platformList,
      topReturnProducts,
      chartData,
    };
  }, [movements, products, platforms, dateRange, customDates, selectedPlatformId]);

  const { stats, platformList, topReturnProducts, chartData } = filteredData;

  // Rate Health Status
  const rateStatus = 
    stats.overallReturnRate < 15
      ? { label: "Healthy Performance", color: "text-emerald-700 bg-emerald-50 font-bold", icon: ShieldCheck }
      : stats.overallReturnRate <= 25
      ? { label: "Warning: High Returns", color: "text-amber-800 bg-amber-50 font-bold", icon: AlertTriangle }
      : { label: "Critical Alert: Action Needed", color: "text-rose-800 bg-rose-50 font-bold", icon: XOctagon };

  const StatusIcon = rateStatus.icon;

  const DATE_OPTIONS: { id: DateRange; label: string; desc: string; badge: string }[] = [
    { id: "ALL", label: "All Time", desc: "Complete historical orders & returns", badge: "ALL" },
    { id: "7D", label: "Last 7 Days", desc: "Past 1 week performance", badge: "7D" },
    { id: "1M", label: "Last 30 Days", desc: "Past 1 month orders", badge: "1M" },
    { id: "3M", label: "Last 90 Days", desc: "Quarterly seasonal trends", badge: "3M" },
    { id: "6M", label: "Last 6 Months", desc: "Half-yearly volume", badge: "6M" },
    { id: "1Y", label: "Last 1 Year", desc: "Annual business review", badge: "1Y" },
    { id: "CUSTOM", label: "Custom Date Range", desc: "Select custom start & end date", badge: "Custom" },
  ];

  const dateRangeLabelMap: Record<DateRange, string> = {
    ALL: "All Time",
    "7D": "Last 7 Days (7D)",
    "1M": "Last 30 Days (1M)",
    "3M": "Last 90 Days (3M)",
    "6M": "Last 6 Months (6M)",
    "1Y": "Last 1 Year (1Y)",
    CUSTOM: customDates.start && customDates.end
      ? `${customDates.start} → ${customDates.end}`
      : "Custom Range...",
  };

  const selectedChannelName = selectedPlatformId === "ALL"
    ? "All Channels"
    : platforms.find(p => p.id === selectedPlatformId)?.name || "Channel";

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* ============================================================== */}
      {/* 📱 Mobile Top Header                                           */}
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
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Business Analytics</h1>
            <p className="text-[11px] text-gray-500 font-medium">Sales, Returns & Channel Breakdown</p>
          </div>
        </div>

        <Link
          href="/movements"
          className="text-xs font-semibold px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-xl active:bg-gray-200"
        >
          Ledger →
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
            <span className="text-xs text-gray-400">Analytics & Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Cross-Platform Business Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Total sales volume, combined return rate, channel performance, and defective loss report.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/movements"
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors shadow-xs"
          >
            View Stock Ledger
          </Link>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 🗓️ Global Time & Platform Filters (Option 2: Responsive Dropdown) */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 sm:p-4 space-y-3">
        {/* 📱 Mobile View: Custom Modal Triggers (Zero Horizontal Scrolling) */}
        <div className="md:hidden grid grid-cols-2 gap-2.5">
          {/* 1. Date Range Trigger Button */}
          <div className="relative">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-600" /> Time Period
            </label>
            <button
              type="button"
              onClick={() => setIsTimeModalOpen(true)}
              className="w-full flex items-center justify-between text-xs font-bold text-gray-900 bg-gray-50 hover:bg-gray-100/80 active:scale-[0.98] border border-gray-100 rounded-xl px-2.5 py-2.5 transition-all text-left shadow-xs cursor-pointer"
            >
              <span className="truncate">{dateRangeLabelMap[dateRange]}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
            </button>
          </div>

          {/* 2. Platform Trigger Button */}
          <div className="relative">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <ShoppingBag className="w-3 h-3 text-indigo-600" /> Channel
            </label>
            <button
              type="button"
              onClick={() => setIsChannelModalOpen(true)}
              className="w-full flex items-center justify-between text-xs font-bold text-gray-900 bg-gray-50 hover:bg-gray-100/80 active:scale-[0.98] border border-gray-100 rounded-xl px-2.5 py-2.5 transition-all text-left shadow-xs cursor-pointer"
            >
              <span className="truncate">{selectedChannelName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
            </button>
          </div>
        </div>

        {/* 🖥️ Desktop View: Full Horizontal Chip Bar */}
        <div className="hidden md:flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase mr-1 shrink-0 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Time:
            </span>
            {(["7D", "1M", "3M", "6M", "1Y", "ALL", "CUSTOM"] as DateRange[]).map((range) => {
              const isSelected = dateRange === range;
              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => setDateRange(range)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100"
                  }`}
                >
                  {range === "CUSTOM" ? "Custom Range" : range}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Channel:</span>
            <div className="relative">
              <select
                value={selectedPlatformId}
                onChange={(e) => setSelectedPlatformId(e.target.value)}
                className="text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-100 rounded-xl pl-3 pr-8 py-2 outline-none focus:border-indigo-500 appearance-none cursor-pointer"
              >
                <option value="ALL">All Platforms</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Custom Date Pickers (Shown if CUSTOM is selected on either Mobile or Desktop) */}
        {dateRange === "CUSTOM" && (
          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Custom Date Range:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100 shadow-xs">
                <span className="text-[11px] font-semibold text-gray-500">From:</span>
                <input
                  type="date"
                  value={customDates.start}
                  onChange={(e) => setCustomDates((p) => ({ ...p, start: e.target.value }))}
                  className="text-xs font-medium text-gray-800 outline-none bg-transparent"
                />
              </div>
              <span className="text-xs font-medium text-indigo-400">to</span>
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100 shadow-xs">
                <span className="text-[11px] font-semibold text-gray-500">To:</span>
                <input
                  type="date"
                  value={customDates.end}
                  onChange={(e) => setCustomDates((p) => ({ ...p, end: e.target.value }))}
                  className="text-xs font-medium text-gray-800 outline-none bg-transparent"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 🌟 4 Key Executive Performance Cards                           */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Sold */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Total Orders Sold</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-gray-900">{stats.totalSold}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Across all registered SKUs</p>
          </div>
        </div>

        {/* Card 2: Total Returns */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Total Returned</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-orange-700">{stats.totalReturns}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              RTO: {stats.totalRto} • Customer: {stats.totalCustomer}
            </p>
          </div>
        </div>

        {/* Card 3: Overall Return Rate % */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Overall Return Rate</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-900">
                {stats.overallReturnRate.toFixed(1)}%
              </p>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${rateStatus.color}`}>
                <StatusIcon className="w-3 h-3" />
                {stats.overallReturnRate < 15 ? "Healthy" : stats.overallReturnRate <= 25 ? "Warning" : "Critical"}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Industry benchmark &lt; 15%</p>
          </div>
        </div>

        {/* Card 4: Defective Stock Loss */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Defective Loss Value</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-rose-700">₹{stats.totalDefectiveValue.toLocaleString()}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {stats.totalDefectiveUnits} defective units in warehouse
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📊 Sales vs Returns Trend Chart (Real App Interactive Chart)  */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4">
        {/* Chart Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-600" />
              Sales vs Returns Trend
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Daily order volume dispatched vs returned items with interactive touch breakdown
            </p>
          </div>

          <div className="flex items-center gap-2.5 text-xs font-semibold flex-wrap">
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Sold: <strong>{stats.totalSold}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 px-2.5 py-1 rounded-lg font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Returned: <strong>{stats.totalReturns}</strong></span>
            </div>
          </div>
        </div>

        {/* Chart Body */}
        {isMounted ? (
          chartData.length > 0 ? (
            <div>
              <div className="w-full h-72 sm:h-80 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={<CustomChartTooltip />}
                      cursor={{ fill: "rgba(241, 245, 249, 0.7)", radius: 8 }}
                    />
                    <Bar
                      dataKey="sales"
                      name="Sales (Out)"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="returns"
                      name="Returns"
                      fill="#f43f5e"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Mobile Touch Instruction Hint */}
              <p className="text-[11px] text-gray-400 text-center mt-2.5 font-medium flex items-center justify-center gap-1">
                <span>💡</span>
                <span>Phone me kisi bhi bar par tap karein exact pieces aur return rate dekhne ke liye</span>
              </p>
            </div>
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-gray-400 text-sm">
              <p>No transaction data found for this period.</p>
            </div>
          )
        ) : (
          <div className="h-72 sm:h-80 w-full bg-gray-50/50 rounded-xl animate-pulse flex items-center justify-center text-xs text-gray-400">
            Loading chart trends...
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 📦 Section: Platform Breakdown & Return Health Breakdown       */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Multi-Platform Performance */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">Platform Performance & Return Rate</h3>
              <p className="text-xs text-gray-500 mt-0.5">Breakdown of orders & returns across selling channels</p>
            </div>
            <span className="text-xs font-semibold text-gray-400">{platformList.length} Channels</span>
          </div>

          {platformList.length > 0 ? (
            <div className="space-y-3">
              {platformList.map((p) => {
                const isHigh = p.returnRate > 20;
                const isModerate = p.returnRate >= 12 && p.returnRate <= 20;
                const retainedUnits = Math.max(p.sold - p.returns, 0);
                const retainedPct = p.sold > 0 ? (retainedUnits / p.sold) * 100 : 0;
                const returnPct = p.sold > 0 ? (p.returns / p.sold) * 100 : 0;

                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl border border-gray-100 bg-white hover:bg-gray-50/50 shadow-sm transition-colors flex flex-col gap-3"
                  >
                    {/* Header: Platform info & Return Rate */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm leading-tight">{p.name}</h4>
                          <p className="text-[11px] text-gray-500 mt-0.5">{p.sold} Orders Dispatched</p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                        isHigh 
                          ? "bg-rose-50 text-rose-700" 
                          : isModerate 
                          ? "bg-amber-50 text-amber-800" 
                          : "bg-emerald-50 text-emerald-800"
                      }`}>
                        {p.returnRate.toFixed(1)}% Return
                      </span>
                    </div>

                    {/* Dual Split Visual Track (Delivered vs Returned) */}
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${retainedPct}%` }}
                        title={`Kept: ${retainedUnits}`}
                      />
                      <div
                        className="h-full bg-rose-500 transition-all"
                        style={{ width: `${returnPct}%` }}
                        title={`Returns: ${p.returns}`}
                      />
                    </div>

                    {/* 3 Metric Pills */}
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div className="bg-gray-50/80 p-2 rounded-xl">
                        <p className="text-gray-400 text-[10px] font-bold uppercase">Sold</p>
                        <p className="font-bold text-gray-900 text-sm mt-0.5">{p.sold}</p>
                      </div>
                      <div className="bg-rose-50/70 p-2 rounded-xl">
                        <p className="text-rose-500 text-[10px] font-bold uppercase">Returned</p>
                        <p className="font-bold text-rose-700 text-sm mt-0.5">{p.returns}</p>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-xl">
                        <p className="text-emerald-600 text-[10px] font-bold uppercase">Net Kept</p>
                        <p className="font-bold text-emerald-800 text-sm mt-0.5">{retainedUnits}</p>
                      </div>
                    </div>

                    {/* Micro breakdown: RTO vs Customer */}
                    <div className="flex items-center justify-between text-[11px] font-medium pt-2 border-t border-dashed border-gray-100 text-gray-600 flex-wrap gap-1">
                      <span>RTO: <strong className="text-gray-900">{p.rtoGood + p.rtoDefective}</strong> ({p.rtoGood} Good • {p.rtoDefective} Bad)</span>
                      <span>Cust: <strong className="text-gray-900">{p.custGood + p.custDefective}</strong> ({p.custGood} Good • {p.custDefective} Bad)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No platform sales data recorded yet.</p>
          )}
        </div>

        {/* Right (1 col): Return Quality Breakdown (Good vs Defective) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Return Condition Quality</h3>
            <p className="text-xs text-gray-500 mt-0.5">Resellable Goods vs Damaged Loss</p>

            <div className="mt-5 space-y-4">
              {/* 2 Big Touch Cards for Mobile & Desktop */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Good / Resellable */}
                <div className="bg-emerald-50/60 p-3.5 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Resellable</span>
                  </div>
                  <p className="text-xl font-black text-emerald-950 mt-1">
                    {stats.rtoGood + stats.customerGood} <span className="text-xs font-normal text-emerald-700">pcs</span>
                  </p>
                  <p className="text-[10px] text-emerald-700 mt-1">
                    {stats.totalReturns > 0
                      ? (((stats.rtoGood + stats.customerGood) / stats.totalReturns) * 100).toFixed(0)
                      : 0}% back in live stock
                  </p>
                </div>

                {/* Defective / Damaged */}
                <div className="bg-rose-50/60 p-3.5 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-rose-800 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Defective</span>
                  </div>
                  <p className="text-xl font-black text-rose-950 mt-1">
                    {stats.rtoDefective + stats.customerDefective} <span className="text-xs font-normal text-rose-700">pcs</span>
                  </p>
                  <p className="text-[10px] text-rose-700 font-semibold mt-1">
                    ₹{stats.totalDefectiveValue.toLocaleString()} Loss Quarantined
                  </p>
                </div>
              </div>

              {/* Progress Split Bar */}
              <div>
                <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                  <span className="text-emerald-700">
                    Good ({stats.totalReturns > 0 ? (((stats.rtoGood + stats.customerGood) / stats.totalReturns) * 100).toFixed(0) : 0}%)
                  </span>
                  <span className="text-rose-700">
                    Defective ({stats.totalReturns > 0 ? (((stats.rtoDefective + stats.customerDefective) / stats.totalReturns) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: `${stats.totalReturns > 0 ? ((stats.rtoGood + stats.customerGood) / stats.totalReturns) * 100 : 0}%`,
                    }}
                  />
                  <div
                    className="h-full bg-rose-500"
                    style={{
                      width: `${stats.totalReturns > 0 ? ((stats.rtoDefective + stats.customerDefective) / stats.totalReturns) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* RTO vs Customer Quick Badges */}
              <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50/80 p-2.5 rounded-xl">
                  <p className="text-gray-400 text-[10px] font-bold uppercase">RTO Returns</p>
                  <p className="font-bold text-gray-900 mt-0.5">{stats.totalRto} units</p>
                </div>
                <div className="bg-gray-50/80 p-2.5 rounded-xl">
                  <p className="text-gray-400 text-[10px] font-bold uppercase">Customer Returns</p>
                  <p className="font-bold text-gray-900 mt-0.5">{stats.totalCustomer} units</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/60 text-xs">
            <p className="font-bold text-blue-900">💡 Pro Tip for E-Commerce:</p>
            <p className="text-blue-700 mt-0.5 leading-relaxed">
              Agar kisi platform par RTO rate 20% se zyada hai, to buyer verification ya COD limit set karke return loss ko 50% tak kam kiya ja sakta hai.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* ⚠️ Section: Top 5 Highest Return Products (Watchlist)          */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              Highest Return Products Watchlist
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Top SKUs generating the most returns. Review packaging, size charts, or quality for these items.
            </p>
          </div>
          <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
            Action Recommended
          </span>
        </div>

        {topReturnProducts.length > 0 ? (
          <>
            {/* 📱 Mobile View: Native App Card Feed (Zero Horizontal Table Scroll) */}
            <div className="md:hidden space-y-3">
              {topReturnProducts.map((item, idx) => {
                const isHighRate = item.rate > 20;
                const isModerate = item.rate >= 12 && item.rate <= 20;
                const rankBadgeClass = 
                  idx === 0 
                    ? "bg-rose-600 text-white shadow-xs" 
                    : idx === 1 
                    ? "bg-amber-500 text-white shadow-xs" 
                    : "bg-indigo-600 text-white";

                return (
                  <div
                    key={item.product.id}
                    className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs space-y-3"
                  >
                    {/* Top Row: Rank, Product Name, SKU & Return Rate Badge */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 mt-0.5 ${rankBadgeClass}`}>
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">
                            {item.product.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="font-mono text-[11px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                              {item.product.sku}
                            </span>
                            <span className="text-[11px] text-gray-300">•</span>
                            <span className="text-[11px] text-gray-500">
                              {item.product.category?.name || "General"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold ${
                          isHighRate 
                            ? "bg-rose-50 text-rose-700" 
                            : isModerate 
                            ? "bg-amber-50 text-amber-700" 
                            : "bg-blue-50 text-blue-700"
                        }`}>
                          {item.rate.toFixed(1)}% Ret
                        </span>
                      </div>
                    </div>

                    {/* Visual Return Progress Track */}
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isHighRate ? "bg-rose-500" : isModerate ? "bg-amber-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min(item.rate, 100)}%` }}
                      />
                    </div>

                    {/* 3 Micro Metric Tiles */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="bg-gray-50/80 p-2 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Sold</span>
                        <p className="text-xs font-black text-gray-900 mt-0.5">{item.sold} pcs</p>
                      </div>
                      <div className="bg-rose-50/70 p-2 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-rose-500">Returned</span>
                        <p className="text-xs font-black text-rose-700 mt-0.5">{item.returns} pcs</p>
                      </div>
                      <div className="bg-emerald-50/60 p-2 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-emerald-600">Net Kept</span>
                        <p className="text-xs font-black text-emerald-700 mt-0.5">
                          {Math.max(item.sold - item.returns, 0)} pcs
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 🖥️ Desktop View: Detailed Wide Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/70 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Sold</th>
                    <th className="px-4 py-3 text-right">Returns</th>
                    <th className="px-4 py-3 text-right">Return Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topReturnProducts.map((item, idx) => {
                    const isHighRate = item.rate > 20;
                    return (
                      <tr key={item.product.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 font-bold text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-gray-900">{item.product.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-gray-500">
                          {item.product.sku}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-500">
                          {item.product.category?.name || "General"}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-gray-700">
                          {item.sold}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-rose-700">
                          {item.returns}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isHighRate ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                          }`}>
                            {item.rate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">
            🎉 Great job! No products have recorded excessive returns yet.
          </p>
        )}
      </div>

      {/* ============================================================== */}
      {/* 📱 Custom Modal / Bottom Sheet: Time Period Picker             */}
      {/* ============================================================== */}
      {isTimeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsTimeModalOpen(false)}
          />

          {/* Bottom Sheet Container */}
          <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Drag Handle Notch for Mobile */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">Select Time Period</h3>
                  <p className="text-xs text-gray-500">Filter sales & returns by date range</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTimeModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Options List */}
            <div className="p-4 pb-12 space-y-2 overflow-y-auto no-scrollbar max-h-[70vh]">
              {DATE_OPTIONS.map((opt) => {
                const isSelected = dateRange === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setDateRange(opt.id);
                      if (opt.id !== "CUSTOM") {
                        setIsTimeModalOpen(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-500/20"
                        : "bg-gray-50/70 hover:bg-gray-100/70 border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                        isSelected ? "bg-indigo-600 text-white" : "bg-white text-gray-700 shadow-xs border border-gray-100"
                      }`}>
                        {opt.badge}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${isSelected ? "text-indigo-950" : "text-gray-900"}`}>
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-gray-500">{opt.desc}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}

              {/* If Custom is selected inside modal */}
              {dateRange === "CUSTOM" && (
                <div className="mt-3 p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-3">
                  <p className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Choose Custom Dates:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-xs">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">From Date</label>
                      <input
                        type="date"
                        value={customDates.start}
                        onChange={(e) => setCustomDates(p => ({ ...p, start: e.target.value }))}
                        className="w-full text-xs font-semibold text-gray-800 outline-none mt-1 bg-transparent"
                      />
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-xs">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">To Date</label>
                      <input
                        type="date"
                        value={customDates.end}
                        onChange={(e) => setCustomDates(p => ({ ...p, end: e.target.value }))}
                        className="w-full text-xs font-semibold text-gray-800 outline-none mt-1 bg-transparent"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTimeModalOpen(false)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    Apply Custom Range
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 📱 Custom Modal / Bottom Sheet: Channel Picker                 */}
      {/* ============================================================== */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsChannelModalOpen(false)}
          />

          {/* Bottom Sheet Container */}
          <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Drag Handle Notch for Mobile */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">Select Selling Channel</h3>
                  <p className="text-xs text-gray-500">Filter data for a specific marketplace</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChannelModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Options List */}
            <div className="p-4 pb-12 space-y-2 overflow-y-auto no-scrollbar max-h-[70vh]">
              {/* Option: All Platforms */}
              <button
                type="button"
                onClick={() => {
                  setSelectedPlatformId("ALL");
                  setIsChannelModalOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedPlatformId === "ALL"
                    ? "bg-blue-50/80 border-blue-300 ring-1 ring-blue-500/20"
                    : "bg-gray-50/70 hover:bg-gray-100/70 border-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    selectedPlatformId === "ALL" ? "bg-blue-600 text-white" : "bg-white text-gray-600 shadow-xs border border-gray-100"
                  }`}>
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${selectedPlatformId === "ALL" ? "text-blue-950" : "text-gray-900"}`}>
                      All Channels (Combined)
                    </p>
                    <p className="text-[11px] text-gray-500">Amazon, Flipkart, Meesho, Offline & all others</p>
                  </div>
                </div>

                {selectedPlatformId === "ALL" && (
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>

              {/* Individual Platforms */}
              {platforms.map((p) => {
                const isSelected = selectedPlatformId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlatformId(p.id);
                      setIsChannelModalOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/80 border-blue-300 ring-1 ring-blue-500/20"
                        : "bg-gray-50/70 hover:bg-gray-100/70 border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSelected ? "bg-blue-600 text-white" : "bg-white text-gray-700 shadow-xs border border-gray-100"
                      }`}>
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${isSelected ? "text-blue-950" : "text-gray-900"}`}>
                          {p.name}
                        </p>
                        <p className="text-[11px] text-gray-500">Marketplace channel orders</p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
