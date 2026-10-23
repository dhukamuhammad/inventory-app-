"use client";

import { useState, useRef } from "react";
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  PackageCheck,
  Zap,
  ShoppingBag,
  MapPin,
  ChevronDown,
  ChevronUp,
  Truck,
  Copy,
  Check,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface SkuSummaryItem {
  sku: string;
  name: string;
  totalQuantity: number;
  currentStock: number;
  afterStock: number;
  productId: string | null;
  found: boolean;
}

interface ParsedOrderItem {
  sku: string;
  description: string;
  quantity: number;
  productId: string | null;
  productName: string;
  currentStock: number | null;
  found: boolean;
}

interface ParsedOrder {
  id: string;
  orderId: string;
  orderDate: string;
  awb: string;
  paymentType: string;
  customerName: string;
  destination: string;
  courier: string;
  hasMissingSku?: boolean;
  missingSkuError?: string;
  items: ParsedOrderItem[];
}

interface ParsedData {
  channel: "MEESHO" | "FLIPKART" | "AMAZON" | "OTHER";
  channelLabel: string;
  totalOrders: number;
  totalUnits: number;
  allSkusFound: boolean;
  unreadOrdersCount?: number;
  skuSummary: SkuSummaryItem[];
  orders: ParsedOrder[];
}

interface BulkDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BulkDispatchModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkDispatchModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"UPLOAD" | "PARSING" | "PREVIEW" | "CONFIRMING" | "SUCCESS">("UPLOAD");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isOrderListExpanded, setIsOrderListExpanded] = useState(true);
  const [usePdfDate, setUsePdfDate] = useState(true);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    orders: number;
    units: number;
    channel: string;
  } | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStep("UPLOAD");
    setSelectedFile(null);
    setParsedData(null);
    setErrorMessage(null);
    setIsDragOver(false);
    setIsOrderListExpanded(true);
    setUsePdfDate(true);
    setCopiedAwb(null);
    setSuccessInfo(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const updateOrderCourier = (orderIndex: number, newCourier: string) => {
    if (!parsedData) return;
    const updatedOrders = [...parsedData.orders];
    updatedOrders[orderIndex] = {
      ...updatedOrders[orderIndex],
      courier: newCourier,
    };
    setParsedData({
      ...parsedData,
      orders: updatedOrders,
    });
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedAwb(text);
      setTimeout(() => setCopiedAwb(null), 2000);
    }
  };

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMessage("Please upload an official PDF shipping label or invoice file.");
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setStep("PARSING");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/dispatch/parse", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to parse shipping labels.");
      }

      setParsedData(json.data);
      setStep("PREVIEW");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error parsing PDF. Please verify it is a valid Flipkart, Meesho or Amazon label.");
      setStep("UPLOAD");
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!parsedData || parsedData.orders.length === 0) return;

    // Strict validation safety: prevent dispatch if any SKU missing
    const missingSkus = parsedData.skuSummary.filter((s) => !s.found);
    if (missingSkus.length > 0) {
      setErrorMessage(`Cannot dispatch: ${missingSkus.length} SKU(s) are not in inventory. Please add them first.`);
      return;
    }

    setStep("CONFIRMING");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/dispatch/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: parsedData.channel,
          orders: parsedData.orders,
          usePdfDate,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to confirm dispatch movements.");
      }

      setSuccessInfo({
        orders: json.processedOrders,
        units: json.processedUnits,
        channel: json.channel || parsedData.channelLabel,
      });
      setStep("SUCCESS");
      router.refresh();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to process stock dispatch.");
      setStep("PREVIEW");
    }
  };

  const isMeesho = parsedData?.channel === "MEESHO";
  const isAmazon = parsedData?.channel === "AMAZON";
  const isFlipkart = parsedData?.channel === "FLIPKART";
  const isOther = parsedData?.channel === "OTHER";

  const missingSkus = parsedData ? parsedData.skuSummary.filter((s) => !s.found) : [];
  const unreadOrders = parsedData ? parsedData.orders.filter((o) => o.items.length === 0) : [];
  const hasUnreadSkus = unreadOrders.length > 0 || (parsedData?.unreadOrdersCount ?? 0) > 0;
  const isZeroUnits = parsedData ? parsedData.totalUnits === 0 : false;
  const hasMissingSkus = missingSkus.length > 0 || hasUnreadSkus || isZeroUnits;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={step === "CONFIRMING" ? undefined : handleClose}
      />

      {/* Modal Sheet Container: Mobile Native Bottom-Sheet, Desktop Centered Card */}
      <div className="relative z-10 w-full sm:max-w-2xl bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        
        {/* Mobile Native App Pull Bar Notch */}
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 sm:hidden shrink-0" />

        {/* Modal Header - Borderless Soft Design */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100/70 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs transition-colors shrink-0 ${
                isAmazon
                  ? "bg-amber-50 text-amber-600"
                  : isMeesho
                  ? "bg-pink-50 text-pink-600"
                  : isFlipkart
                  ? "bg-blue-50 text-blue-600"
                  : "bg-purple-50 text-purple-600"
              }`}
            >
              <Zap
                className={`w-5 h-5 ${
                  isAmazon
                    ? "fill-amber-500"
                    : isMeesho
                    ? "fill-pink-500"
                    : isFlipkart
                    ? "fill-blue-500"
                    : "fill-purple-500"
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-gray-900 leading-tight">
                  Auto Bulk Dispatch
                </h3>
                {parsedData ? (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      isAmazon
                        ? "bg-amber-100/70 text-amber-900"
                        : isMeesho
                        ? "bg-pink-100/70 text-pink-900"
                        : isFlipkart
                        ? "bg-blue-100/70 text-blue-900"
                        : "bg-purple-100/70 text-purple-900"
                    }`}
                  >
                    {parsedData.channelLabel}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                    Smart Auto-Detect
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                Flipkart, Meesho, Amazon & Universal labels auto stock-out
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={step === "CONFIRMING"}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain">
          {/* ======================================================== */}
          {/* STEP 1: UPLOAD DROPZONE                                 */}
          {/* ======================================================== */}
          {step === "UPLOAD" && (
            <div className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processFile(e.target.files[0]);
                  }
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-7 sm:p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  isDragOver
                    ? "border-indigo-400 bg-indigo-50/60 scale-[0.99]"
                    : "border-indigo-150/70 hover:border-indigo-300 bg-gray-50/50 hover:bg-indigo-50/30"
                }`}
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                  <UploadCloud className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-800">
                    Drop your Shipping Label or Invoice PDF here
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Supports <strong>Flipkart</strong>, <strong>Meesho</strong>, <strong>Amazon</strong> & all multi-label A4 sheets
                  </p>
                </div>

                <div className="flex items-center gap-1.5 mt-2 flex-wrap justify-center">
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl">
                    ⚡ Auto-Detects Platforms
                  </span>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl">
                    Flipkart
                  </span>
                  <span className="text-[11px] font-semibold text-pink-700 bg-pink-50 px-2.5 py-1 rounded-xl">
                    Meesho
                  </span>
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl">
                    Amazon
                  </span>
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl">
                    + Any Partner
                  </span>
                </div>
              </div>

              {/* Instructions banner */}
              <div className="bg-indigo-50/50 rounded-2xl p-4 text-xs text-indigo-950 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-indigo-900">
                  <ShoppingBag className="w-3.5 h-3.5 text-indigo-600" /> How Smart Auto-Dispatch Works:
                </p>
                <p className="text-indigo-800/90 leading-relaxed text-[11px]">
                  Flipkart, Meesho ya Amazon seller portal se downloaded PDF yahan upload karein. System har label ka SKU, Courier partner, Order Date, AWB Barcode aur Customer address automatic extract karke live preview dikhayega.
                </p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: PARSING LOADER                                  */}
          {/* ======================================================== */}
          {step === "PARSING" && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-25" />
              </div>

              <div>
                <h4 className="text-base font-bold text-gray-900">Scanning Shipping Labels...</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Detecting marketplace, extracting SKUs, couriers, dates, and AWBs
                </p>
              </div>

              {selectedFile && (
                <span className="text-xs font-mono font-medium text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl">
                  {selectedFile.name}
                </span>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 3: PREVIEW & VERIFICATION                           */}
          {/* ======================================================== */}
          {(step === "PREVIEW" || step === "CONFIRMING") && parsedData && (
            <div className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 3 Executive Stats Pills - Soft Borderless Look */}
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                <div className="bg-gray-50/90 p-3 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Orders</span>
                  <p className="text-xl font-black text-gray-900 mt-0.5">{parsedData.totalOrders}</p>
                </div>
                <div className="bg-indigo-50/80 p-3 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">Units Out</span>
                  <p className="text-xl font-black text-indigo-700 mt-0.5">-{parsedData.totalUnits}</p>
                </div>
                <div
                  className={`p-3 rounded-2xl text-center shadow-2xs ${
                    isAmazon
                      ? "bg-amber-50/90 text-amber-800"
                      : isMeesho
                      ? "bg-pink-50/90 text-pink-700"
                      : isFlipkart
                      ? "bg-blue-50/90 text-blue-700"
                      : "bg-purple-50/90 text-purple-700"
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold opacity-75 tracking-wider">Marketplace</span>
                  <p className="text-base font-black mt-0.5 tracking-tight truncate">
                    {parsedData.channelLabel}
                  </p>
                </div>
              </div>

              {/* Missing SKU Blocked Banner - Soft Warning */}
              {missingSkus.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-800 text-xs space-y-1 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    Dispatch Blocked: {missingSkus.length} SKU(s) inventory me nahi mile!
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    Stock mismatch se bachne ke liye batch hold par hai. Pehle in SKUs ko add karein:{" "}
                    <strong>{missingSkus.map((s) => s.sku).join(", ")}</strong>.
                  </p>
                </div>
              )}

              {/* Unread Orders / SKU Not Detected Banner */}
              {hasUnreadSkus && (
                <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-900 text-xs space-y-1 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    SKU Missing Alert: {unreadOrders.length} order(s) me SKU detect nahi ho paya!
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Label me se product SKU table ya code read nahi ho saka. Kripya niche individual orders me check karein ki label sahi se upload hua hai ya nahi.
                  </p>
                </div>
              )}

              {/* SKU Impact Breakdown - Borderless Soft Container */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    SKU Stock Impact ({parsedData.skuSummary.length})
                  </h4>
                  {isZeroUnits || parsedData.skuSummary.length === 0 ? (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> 0 Units Detected
                    </span>
                  ) : !hasMissingSkus ? (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> All SKUs Matched
                    </span>
                  ) : missingSkus.length > 0 ? (
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600" /> {missingSkus.length} Missing
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> {unreadOrders.length} Unread
                    </span>
                  )}
                </div>

                <div className="rounded-2xl bg-gray-50/60 p-1.5 space-y-1">
                  {parsedData.skuSummary.map((item) => (
                    <div
                      key={item.sku}
                      className="p-3 rounded-xl bg-white flex items-center justify-between gap-3 text-xs shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md text-xs">
                            {item.sku}
                          </span>
                          {!item.found && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md">
                              Not in Inventory
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-rose-600 font-bold">
                          -{item.totalQuantity} units
                        </span>
                        {item.found && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Stock: {item.currentStock} → <strong className="text-gray-700">{item.afterStock}</strong>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Mode Toggle - Soft Pill */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/80 text-xs">
                <span className="text-gray-600 font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  Ledger Date:
                </span>
                <div className="flex items-center gap-1 bg-gray-200/50 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setUsePdfDate(true)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      usePdfDate
                        ? "bg-white text-gray-900 shadow-xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    PDF Date
                  </button>
                  <button
                    type="button"
                    onClick={() => setUsePdfDate(false)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      !usePdfDate
                        ? "bg-white text-gray-900 shadow-xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* Expandable Per-Order Inspection - Native Mobile Cards with NO Title, SKU Only */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOrderListExpanded(!isOrderListExpanded)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-gray-50 hover:bg-gray-100/70 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-gray-500" />
                    Inspect Individual Orders ({parsedData.orders.length})
                  </span>
                  {isOrderListExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isOrderListExpanded && (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-0.5">
                    {parsedData.orders.map((ord, idx) => (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-2xl bg-gray-50/70 hover:bg-gray-50 text-xs space-y-2.5 transition-colors shadow-2xs"
                      >
                        {/* Header: Order ID + Courier Partner + Payment + Date */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-gray-400">#{idx + 1}</span>
                            <span className="font-mono font-bold text-gray-900 text-xs">
                              {ord.orderId}
                            </span>
                            {/* Individual Order's Delivery Partner (Detected dynamically from label, with quick edit) */}
                            <div className="relative inline-flex items-center">
                              <select
                                value={ord.courier || "DELHIVERY"}
                                onChange={(e) => updateOrderCourier(idx, e.target.value)}
                                className="appearance-none bg-blue-50 hover:bg-blue-100/70 text-blue-700 text-[10px] font-bold pl-5 pr-4 py-0.5 rounded-md cursor-pointer transition-colors focus:outline-none"
                                title="Delivery Partner (Detected from label, click to change)"
                              >
                                {ord.courier && ![
                                  "DELHIVERY", "ATSPL", "E-Kart Logistics", "Blue Dart", "Shadowfax", "Xpressbees", "Valmo", "DTDC", "India Post"
                                ].includes(ord.courier) && (
                                  <option value={ord.courier}>{ord.courier}</option>
                                )}
                                <option value="DELHIVERY">DELHIVERY</option>
                                <option value="ATSPL">ATSPL (Amazon Shipping)</option>
                                <option value="E-Kart Logistics">E-Kart Logistics</option>
                                <option value="Blue Dart">Blue Dart</option>
                                <option value="Shadowfax">Shadowfax</option>
                                <option value="Xpressbees">Xpressbees</option>
                                <option value="Valmo">Valmo</option>
                                <option value="DTDC">DTDC</option>
                                <option value="India Post">India Post</option>
                              </select>
                              <Truck className="w-3 h-3 text-blue-500 absolute left-1.5 pointer-events-none" />
                              <ChevronDown className="w-2.5 h-2.5 text-blue-400 absolute right-1 pointer-events-none" />
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {ord.orderDate && (
                              <span className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                {ord.orderDate}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                ord.paymentType === "COD"
                                  ? "bg-amber-100/70 text-amber-900"
                                  : "bg-emerald-100/70 text-emerald-900"
                              }`}
                            >
                              {ord.paymentType}
                            </span>
                          </div>
                        </div>

                        {/* Customer & Destination */}
                        <div className="flex items-center justify-between text-[11px] text-gray-600">
                          <span className="font-semibold text-gray-800 truncate max-w-[200px]">
                            {ord.customerName || "Customer"}
                          </span>
                          {ord.destination && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-500 truncate max-w-[220px]">
                              <MapPin className="w-3 h-3 shrink-0 text-gray-400" />
                              <span className="truncate">{ord.destination}</span>
                            </span>
                          )}
                        </div>

                        {/* AWB with copy button */}
                        <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl text-[11px] shadow-2xs">
                          <span className="font-mono text-gray-600">
                            AWB: <strong className="text-gray-900">{ord.awb}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(ord.awb)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer"
                            title="Copy AWB Number"
                          >
                            {copiedAwb === ord.awb ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Per-Order SKU Strip - NO Product Title, ONLY SKU & Quantity */}
                        <div className="space-y-1.5 pt-0.5">
                          {ord.items.length === 0 ? (
                            <div className="flex items-center gap-2 text-xs p-2.5 rounded-xl bg-amber-50/90 text-amber-900 shadow-2xs font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="text-[11px]">
                                {ord.missingSkuError || "Is label me SKU detect nahi ho paya (Label format check karein)"}
                              </span>
                            </div>
                          ) : (
                            ord.items.map((item, itemIdx) => (
                              <div
                                key={itemIdx}
                                className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-white shadow-2xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md text-xs">
                                    {item.sku}
                                  </span>
                                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px]">
                                    Qty: {item.quantity}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {item.found ? (
                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Matched
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Not in Inventory
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 4: SUCCESS CONFIRMATION                             */}
          {/* ======================================================== */}
          {step === "SUCCESS" && successInfo && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20 animate-in zoom-in-75 duration-300">
                <PackageCheck className="w-9 h-9" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-gray-900">
                  {successInfo.channel} Orders Dispatched!
                </h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  <strong>{successInfo.units} units</strong> stock se deduct ho gaye hain aur sabhi AWB numbers & dates Movements Ledger me save ho chuke hain.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  Done & Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (PREVIEW step): Strict Single-Line Native Action Bar - NEVER WRAPS */}
        {(step === "PREVIEW" || step === "CONFIRMING") && parsedData && (
          <div className="p-3 sm:px-6 sm:py-4 bg-white/95 backdrop-blur-md border-t border-gray-100/80 flex items-center gap-2.5 w-full shrink-0">
            {/* Upload Another / Re-upload Button: Compact & Never Wraps */}
            <button
              type="button"
              disabled={step === "CONFIRMING"}
              onClick={() => {
                setStep("UPLOAD");
                setSelectedFile(null);
                setParsedData(null);
              }}
              className="shrink-0 px-3.5 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-200 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
              title="Upload Another PDF"
            >
              <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
              <span>Upload New</span>
            </button>

            {/* Primary Action Button: Flexible, Single Line, Adaptive Label */}
            {hasMissingSkus ? (
              <button
                type="button"
                disabled={true}
                className="flex-1 py-2.5 px-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold cursor-not-allowed flex items-center justify-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis shadow-none"
                title={
                  isZeroUnits
                    ? "Cannot dispatch 0 units"
                    : missingSkus.length > 0
                    ? `Cannot dispatch: ${missingSkus.length} SKU(s) missing from inventory`
                    : `Cannot dispatch: SKU not detected in ${unreadOrders.length} order(s)`
                }
              >
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="truncate">
                  {isZeroUnits
                    ? "Blocked (0 Units Detected)"
                    : missingSkus.length > 0
                    ? `Blocked (${missingSkus.length} Missing in Inv)`
                    : `Blocked (${unreadOrders.length} SKU Unread)`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={step === "CONFIRMING" || parsedData.totalUnits === 0}
                onClick={handleConfirmDispatch}
                className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis ${
                  isAmazon
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-orange-500/20"
                    : isMeesho
                    ? "bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 shadow-pink-500/20"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-indigo-500/20"
                }`}
              >
                {step === "CONFIRMING" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span className="truncate">Dispatching...</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      Confirm Out ({parsedData.totalUnits} Units)
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
