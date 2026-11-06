"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
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
  FileText,
  Search,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AvailableProduct {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
}

interface SkuSummaryItem {
  sku: string;
  name: string;
  totalQuantity: number;
  duplicateQuantity?: number;
  currentStock: number;
  afterStock: number;
  productId: string | null;
  found: boolean;
  isSubstituted?: boolean;
  originalSku?: string;
}

interface SubstitutedFromSnapshot {
  sku: string;
  originalSku?: string;
  description?: string;
  productId: string | null;
  productName: string;
  currentStock: number | null;
  found: boolean;
}

interface ParsedOrderItem {
  sku: string;
  originalSku?: string;
  description: string;
  quantity: number;
  productId: string | null;
  productName: string;
  currentStock: number | null;
  found: boolean;
  isSubstituted?: boolean;
  substitutedFrom?: SubstitutedFromSnapshot;
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
  isAlreadyDispatched?: boolean;
  dispatchedAt?: string | null;
  duplicateBatchFileName?: string | null;
}

interface ParsedData {
  channel: "MEESHO" | "FLIPKART" | "AMAZON" | "OTHER";
  channelLabel: string;
  totalOrders: number;
  totalUnits: number;
  allSkusFound: boolean;
  unreadOrdersCount?: number;
  duplicateOrdersCount?: number;
  allOrdersDuplicate?: boolean;
  skuSummary: SkuSummaryItem[];
  orders: ParsedOrder[];
  availableProducts?: AvailableProduct[];
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
  const abortControllerRef = useRef<AbortController | null>(null);

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
  const [substitutingSku, setSubstitutingSku] = useState<string | null>(null);
  const [selectedSubProduct, setSelectedSubProduct] = useState<Record<string, string>>({});
  const [editingItemSwapKey, setEditingItemSwapKey] = useState<string | null>(null);

  // Custom "Coding-Wala" Native Bottom-Sheet SKU Picker State
  const [mounted, setMounted] = useState(false);
  const [skuPicker, setSkuPicker] = useState<{
    isOpen: boolean;
    type: "BATCH" | "SINGLE";
    fromSku: string;
    orderIdx?: number;
    itemIdx?: number;
    selectedProductId: string;
  } | null>(null);
  const [skuSearchQuery, setSkuSearchQuery] = useState("");
  const [filterOnlyInStock, setFilterOnlyInStock] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (skuPicker?.isOpen) {
      document.body.style.overflow = "hidden";
    } else if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [skuPicker?.isOpen, isOpen]);

  const resetState = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStep("UPLOAD");
    setSelectedFile(null);
    setParsedData(null);
    setErrorMessage(null);
    setIsDragOver(false);
    setIsOrderListExpanded(true);
    setUsePdfDate(true);
    setCopiedAwb(null);
    setSuccessInfo(null);
    setSubstitutingSku(null);
    setSelectedSubProduct({});
    setEditingItemSwapKey(null);
    setSkuPicker(null);
    setSkuSearchQuery("");
    setFilterOnlyInStock(false);
  };

  const pickerAvailableProducts = useMemo(() => {
    if (!parsedData?.availableProducts || !skuPicker?.isOpen) return [];
    const fromSkuLower = (skuPicker.fromSku || "").toLowerCase().trim();
    const q = skuSearchQuery.toLowerCase().trim();

    return parsedData.availableProducts.filter((p) => {
      // Exclude the current SKU
      if (p.sku.toLowerCase().trim() === fromSkuLower) return false;

      // Filter only in stock if toggled
      if (filterOnlyInStock && p.currentStock <= 0) return false;

      // Search match
      if (!q) return true;
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
      );
    });
  }, [parsedData?.availableProducts, skuPicker, skuSearchQuery, filterOnlyInStock]);

  if (!isOpen) return null;

  const recalculateSummary = (
    orders: ParsedOrder[],
    availableProducts: AvailableProduct[] = []
  ): SkuSummaryItem[] => {
    const prodMap = new Map(availableProducts.map((p) => [p.id, p]));
    const summaryMap = new Map<string, SkuSummaryItem>();

    for (const ord of orders) {
      for (const it of ord.items) {
        const prod = it.productId ? prodMap.get(it.productId) : null;
        const skuKey = it.sku;
        const current = summaryMap.get(skuKey) || {
          sku: skuKey,
          name: it.productName || prod?.name || skuKey,
          totalQuantity: 0,
          duplicateQuantity: 0,
          currentStock: prod?.currentStock ?? (it.currentStock ?? 0),
          afterStock: prod?.currentStock ?? (it.currentStock ?? 0),
          productId: it.productId,
          found: it.found,
          isSubstituted: it.isSubstituted,
          originalSku: it.originalSku,
        };

        if (ord.isAlreadyDispatched) {
          current.duplicateQuantity = (current.duplicateQuantity || 0) + it.quantity;
        } else {
          current.totalQuantity += it.quantity;
          current.afterStock = current.currentStock - current.totalQuantity;
        }

        if (it.isSubstituted) {
          current.isSubstituted = true;
          current.originalSku = it.originalSku;
        }
        summaryMap.set(skuKey, current);
      }
    }

    return Array.from(summaryMap.values());
  };

  const handleSubstituteBatch = (fromSku: string, targetProductId: string) => {
    if (!parsedData || !targetProductId) return;
    const targetProduct = parsedData.availableProducts?.find((p) => p.id === targetProductId);
    if (!targetProduct) return;

    const updatedOrders = parsedData.orders.map((ord) => ({
      ...ord,
      items: ord.items.map((it) => {
        const matches =
          it.sku.toLowerCase().trim() === fromSku.toLowerCase().trim() ||
          (it.originalSku && it.originalSku.toLowerCase().trim() === fromSku.toLowerCase().trim());
        if (!matches) return it;

        const snapshot: SubstitutedFromSnapshot = it.substitutedFrom || {
          sku: it.sku,
          originalSku: it.originalSku,
          description: it.description,
          productId: it.productId,
          productName: it.productName,
          currentStock: it.currentStock,
          found: it.found,
        };

        return {
          ...it,
          substitutedFrom: snapshot,
          originalSku: it.originalSku || it.sku,
          sku: targetProduct.sku,
          productId: targetProduct.id,
          productName: targetProduct.name,
          currentStock: targetProduct.currentStock,
          found: true,
          isSubstituted: true,
        };
      }),
    }));

    const newSkuSummary = recalculateSummary(updatedOrders, parsedData.availableProducts);
    const unreadCount = updatedOrders.filter((o) => o.items.length === 0).length;
    const dupCount = updatedOrders.filter((o) => o.isAlreadyDispatched).length;
    const allDup = dupCount === updatedOrders.length && updatedOrders.length > 0;
    const allFound =
      newSkuSummary.length > 0 &&
      newSkuSummary.every((s) => s.found) &&
      unreadCount === 0;

    setParsedData({
      ...parsedData,
      orders: updatedOrders,
      skuSummary: newSkuSummary,
      allSkusFound: allFound,
      duplicateOrdersCount: dupCount,
      allOrdersDuplicate: allDup,
    });
    setSubstitutingSku(null);
  };

  const handleRevertBatchSubstitute = (currentSku: string) => {
    if (!parsedData) return;

    const updatedOrders = parsedData.orders.map((ord) => ({
      ...ord,
      items: ord.items.map((it) => {
        if (!it.isSubstituted) return it;
        if (it.sku.toLowerCase().trim() !== currentSku.toLowerCase().trim()) return it;

        if (it.substitutedFrom) {
          const from = it.substitutedFrom;
          return {
            ...it,
            sku: from.sku,
            originalSku: from.originalSku,
            productId: from.productId,
            productName: from.productName,
            currentStock: from.currentStock,
            found: from.found,
            isSubstituted: false,
            substitutedFrom: undefined,
          };
        }

        const origProd = parsedData.availableProducts?.find(
          (p) => p.sku.toLowerCase().trim() === it.originalSku?.toLowerCase().trim()
        );

        return {
          ...it,
          sku: it.originalSku || it.sku,
          originalSku: undefined,
          productId: origProd?.id || null,
          productName: origProd?.name || it.description,
          currentStock: origProd ? origProd.currentStock : null,
          found: !!origProd,
          isSubstituted: false,
        };
      }),
    }));

    const newSkuSummary = recalculateSummary(updatedOrders, parsedData.availableProducts);
    const unreadCount = updatedOrders.filter((o) => o.items.length === 0).length;
    const dupCount = updatedOrders.filter((o) => o.isAlreadyDispatched).length;
    const allDup = dupCount === updatedOrders.length && updatedOrders.length > 0;
    const allFound =
      newSkuSummary.length > 0 &&
      newSkuSummary.every((s) => s.found) &&
      unreadCount === 0;

    setParsedData({
      ...parsedData,
      orders: updatedOrders,
      skuSummary: newSkuSummary,
      allSkusFound: allFound,
      duplicateOrdersCount: dupCount,
      allOrdersDuplicate: allDup,
    });
  };

  const handleSubstituteSingleItem = (
    orderIdx: number,
    itemIdx: number,
    targetProductId: string
  ) => {
    if (!parsedData || !targetProductId) return;
    const targetProduct = parsedData.availableProducts?.find((p) => p.id === targetProductId);
    if (!targetProduct) return;

    const updatedOrders = [...parsedData.orders];
    const targetOrder = { ...updatedOrders[orderIdx] };
    const targetItems = [...targetOrder.items];
    const currentItem = targetItems[itemIdx];

    const snapshot: SubstitutedFromSnapshot = currentItem.substitutedFrom || {
      sku: currentItem.sku,
      originalSku: currentItem.originalSku,
      description: currentItem.description,
      productId: currentItem.productId,
      productName: currentItem.productName,
      currentStock: currentItem.currentStock,
      found: currentItem.found,
    };

    targetItems[itemIdx] = {
      ...currentItem,
      substitutedFrom: snapshot,
      originalSku: currentItem.originalSku || currentItem.sku,
      sku: targetProduct.sku,
      productId: targetProduct.id,
      productName: targetProduct.name,
      currentStock: targetProduct.currentStock,
      found: true,
      isSubstituted: true,
    };

    targetOrder.items = targetItems;
    updatedOrders[orderIdx] = targetOrder;

    const newSkuSummary = recalculateSummary(updatedOrders, parsedData.availableProducts);
    const unreadCount = updatedOrders.filter((o) => o.items.length === 0).length;
    const dupCount = updatedOrders.filter((o) => o.isAlreadyDispatched).length;
    const allDup = dupCount === updatedOrders.length && updatedOrders.length > 0;
    const allFound =
      newSkuSummary.length > 0 &&
      newSkuSummary.every((s) => s.found) &&
      unreadCount === 0;

    setParsedData({
      ...parsedData,
      orders: updatedOrders,
      skuSummary: newSkuSummary,
      allSkusFound: allFound,
      duplicateOrdersCount: dupCount,
      allOrdersDuplicate: allDup,
    });
    setEditingItemSwapKey(null);
  };

  const handleRevertSingleItem = (orderIdx: number, itemIdx: number) => {
    if (!parsedData) return;

    const updatedOrders = [...parsedData.orders];
    const targetOrder = { ...updatedOrders[orderIdx] };
    const targetItems = [...targetOrder.items];
    const currentItem = targetItems[itemIdx];

    if (!currentItem.isSubstituted) return;

    if (currentItem.substitutedFrom) {
      const from = currentItem.substitutedFrom;
      targetItems[itemIdx] = {
        ...currentItem,
        sku: from.sku,
        originalSku: from.originalSku,
        productId: from.productId,
        productName: from.productName,
        currentStock: from.currentStock,
        found: from.found,
        isSubstituted: false,
        substitutedFrom: undefined,
      };
    } else {
      const origProd = parsedData.availableProducts?.find(
        (p) => p.sku.toLowerCase().trim() === currentItem.originalSku?.toLowerCase().trim()
      );

      targetItems[itemIdx] = {
        ...currentItem,
        sku: currentItem.originalSku || currentItem.sku,
        originalSku: undefined,
        productId: origProd?.id || null,
        productName: origProd?.name || currentItem.description,
        currentStock: origProd ? origProd.currentStock : null,
        found: !!origProd,
        isSubstituted: false,
      };
    }

    targetOrder.items = targetItems;
    updatedOrders[orderIdx] = targetOrder;

    const newSkuSummary = recalculateSummary(updatedOrders, parsedData.availableProducts);
    const unreadCount = updatedOrders.filter((o) => o.items.length === 0).length;
    const dupCount = updatedOrders.filter((o) => o.isAlreadyDispatched).length;
    const allDup = dupCount === updatedOrders.length && updatedOrders.length > 0;
    const allFound =
      newSkuSummary.length > 0 &&
      newSkuSummary.every((s) => s.found) &&
      unreadCount === 0;

    setParsedData({
      ...parsedData,
      orders: updatedOrders,
      skuSummary: newSkuSummary,
      allSkusFound: allFound,
      duplicateOrdersCount: dupCount,
      allOrdersDuplicate: allDup,
    });
    setEditingItemSwapKey(null);
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

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch("/api/dispatch/parse", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to parse shipping labels.");
      }

      setParsedData(json.data);
      setStep("PREVIEW");
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error(err);
      if (err.name === "AbortError") {
        setErrorMessage("File reading took longer than expected. Please try again or upload a smaller file.");
      } else {
        setErrorMessage(err.message || "Error parsing PDF. Please verify it is a valid Flipkart, Meesho or Amazon label.");
      }
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

    if (allOrdersDuplicate) {
      setErrorMessage("Cannot dispatch: Is file ke sabhi orders pehle hi dispatch ho chuke hain.");
      return;
    }

    // Strict validation safety: prevent dispatch if any SKU missing
    const missingSkus = parsedData.skuSummary.filter((s) => !s.found);
    if (missingSkus.length > 0) {
      setErrorMessage(`Cannot dispatch: ${missingSkus.length} SKU(s) are not in inventory. Please add them first.`);
      return;
    }

    setStep("CONFIRMING");
    setErrorMessage(null);

    // Calculate courier partner summary breakdown
    const courierCounts: Record<string, number> = {};
    for (const ord of parsedData.orders) {
      const cName = ord.courier?.trim() || "Standard / Unspecified";
      courierCounts[cName] = (courierCounts[cName] || 0) + 1;
    }

    try {
      const res = await fetch("/api/dispatch/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: parsedData.channel,
          orders: parsedData.orders,
          usePdfDate,
          fileName: selectedFile?.name || `${parsedData.channelLabel}_Dispatch_${new Date().toISOString().slice(0, 10)}.pdf`,
          skuSummary: parsedData.skuSummary,
          courierSummary: courierCounts,
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

  const duplicateOrders = parsedData ? parsedData.orders.filter((o) => o.isAlreadyDispatched) : [];
  const duplicateOrdersCount = parsedData?.duplicateOrdersCount ?? duplicateOrders.length;
  const allOrdersDuplicate =
    parsedData?.allOrdersDuplicate ??
    (duplicateOrdersCount === (parsedData?.totalOrders ?? 0) && (parsedData?.totalOrders ?? 0) > 0);
  const hasDuplicateOrders = duplicateOrdersCount > 0;

  const missingSkus = parsedData ? parsedData.skuSummary.filter((s) => !s.found) : [];
  const unreadOrders = parsedData ? parsedData.orders.filter((o) => o.items.length === 0) : [];
  const hasUnreadSkus = unreadOrders.length > 0 || (parsedData?.unreadOrdersCount ?? 0) > 0;
  const isZeroUnits = parsedData ? parsedData.totalUnits === 0 : false;
  const hasMissingSkus =
    !allOrdersDuplicate && (missingSkus.length > 0 || hasUnreadSkus || isZeroUnits);

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

              <div className="flex flex-col items-center gap-2">
                {selectedFile && (
                  <span className="text-xs font-mono font-medium text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl">
                    {selectedFile.name}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (abortControllerRef.current) {
                      abortControllerRef.current.abort();
                    }
                    resetState();
                  }}
                  className="text-xs text-gray-500 hover:text-rose-600 underline transition-colors cursor-pointer mt-1"
                >
                  Cancel Scanning
                </button>
              </div>
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

              {/* Duplicate Orders Alert Banner */}
              {allOrdersDuplicate ? (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-950 text-xs space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    Duplicate File Alert: Yeh Sabhi Orders Pehle Hi Dispatch Ho Chuke Hain!
                  </div>
                  <p className="text-[11px] sm:text-xs text-amber-800 leading-relaxed">
                    Is file ke sabhi ({parsedData.totalOrders}) orders already dispatch ho chuke hain (Pechela batch:{" "}
                    <strong>
                      {parsedData.orders.find((o) => o.dispatchedAt)?.dispatchedAt
                        ? new Date(
                            parsedData.orders.find((o) => o.dispatchedAt)!.dispatchedAt!
                          ).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Earlier"}
                    </strong>
                    ). Double stock cut se bachne ke liye Confirm button block kar diya gaya hai.
                  </p>
                </div>
              ) : hasDuplicateOrders ? (
                <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-amber-950 text-xs space-y-1 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    {duplicateOrdersCount} Duplicate Order(s) Detected (No Double Deduction)
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    In {duplicateOrdersCount} order(s) ka stock pehle hi cut ho chuka hai. Inka double stock cut nahi hoga, sirf baaki naye orders dispatch honge.
                  </p>
                </div>
              ) : null}

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
                  {allOrdersDuplicate ? (
                    <span className="text-[11px] font-bold text-amber-900 bg-amber-100/90 border border-amber-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-amber-600" /> All Orders Already Dispatched
                    </span>
                  ) : isZeroUnits || parsedData.skuSummary.length === 0 ? (
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
                      className="p-3 rounded-xl bg-white flex flex-col gap-2 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md text-xs">
                              {item.sku}
                            </span>
                            {item.isSubstituted && (
                              <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200">
                                🔄 Substituted (Label: {item.originalSku})
                              </span>
                            )}
                            {!item.found && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md">
                                Not in Inventory
                              </span>
                            )}
                            {item.found && (item.currentStock <= 0 || item.afterStock < 0) && (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                                ⚠️ Stock Low / 0
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
                              Stock: {item.currentStock} →{" "}
                              <strong
                                className={
                                  item.afterStock < 0 ? "text-rose-600 font-bold" : "text-gray-700"
                                }
                              >
                                {item.afterStock}
                              </strong>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Swap Action Bar */}
                      <div className="flex items-center justify-between pt-1 border-t border-gray-100/80 text-[11px]">
                        {item.isSubstituted ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-purple-800 text-[10px] font-medium">
                              Swapped with {item.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRevertBatchSubstitute(item.sku)}
                              className="text-[10px] font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
                            >
                              Undo Swap
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-gray-400 text-[10px]">
                              {item.currentStock <= 0 || item.afterStock < 0
                                ? "Out of stock? Upgrade or substitute variant:"
                                : "Want to ship another variant?"}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setSubstitutingSku(substitutingSku === item.sku ? null : item.sku)
                              }
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>{substitutingSku === item.sku ? "Close" : "Substitute All"}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Inline Substitute Box (Native Theme with Custom Trigger Button) */}
                      {substitutingSku === item.sku && (
                        <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100/90 space-y-2.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                              <span className="text-xs font-bold text-gray-900 truncate">
                                Replacement for <span className="font-mono text-indigo-700">{item.sku}</span>:
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSubstitutingSku(null)}
                              className="text-gray-400 hover:text-gray-600 p-1 -mr-1 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {(() => {
                            const chosenProd = parsedData.availableProducts?.find(
                              (p) => p.id === selectedSubProduct[item.sku]
                            );
                            return (
                              <div className="space-y-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSkuPicker({
                                      isOpen: true,
                                      type: "BATCH",
                                      fromSku: item.sku,
                                      selectedProductId: selectedSubProduct[item.sku] || "",
                                    });
                                    setSkuSearchQuery("");
                                  }}
                                  className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-indigo-200/80 hover:border-indigo-400 rounded-xl text-xs font-semibold text-gray-900 shadow-2xs transition-all cursor-pointer text-left active:bg-gray-50"
                                >
                                  {chosenProd ? (
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px] shrink-0">
                                        {chosenProd.sku}
                                      </span>
                                      <span className="truncate text-gray-800 font-semibold">{chosenProd.name}</span>
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md shrink-0 ml-auto mr-1">
                                        Stock: {chosenProd.currentStock}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 font-normal flex items-center gap-1.5">
                                      <Search className="w-3.5 h-3.5 text-gray-400" />
                                      Tap to search & select replacement variant...
                                    </span>
                                  )}
                                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
                                </button>

                                <div className="flex items-center justify-between gap-2 pt-1">
                                  <p className="text-[10px] text-gray-500 leading-tight">
                                    💡 Physical stock naye variant se minus hogi.
                                  </p>
                                  <button
                                    type="button"
                                    disabled={!selectedSubProduct[item.sku]}
                                    onClick={() =>
                                      handleSubstituteBatch(item.sku, selectedSubProduct[item.sku])
                                    }
                                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Apply to {item.totalQuantity} Orders</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
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
                                value={
                                  ord.courier ||
                                  (parsedData.channel === "AMAZON"
                                    ? "ATSPL"
                                    : parsedData.channel === "FLIPKART"
                                    ? "E-Kart Logistics"
                                    : parsedData.channel === "MEESHO"
                                    ? "Valmo"
                                    : "DELHIVERY")
                                }
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

                        {/* AWB with copy button & Duplicate Dispatched Tag */}
                        <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl text-[11px] shadow-2xs flex-wrap gap-1.5">
                          <span className="font-mono text-gray-600">
                            AWB: <strong className="text-gray-900">{ord.awb}</strong>
                          </span>
                          <div className="flex items-center gap-1.5">
                            {ord.isAlreadyDispatched && (
                              <span className="text-[10px] font-bold text-amber-900 bg-amber-100/90 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3 text-amber-600" />
                                Dispatched ({ord.dispatchedAt ? new Date(ord.dispatchedAt).toLocaleDateString("en-IN") : "Earlier"})
                              </span>
                            )}
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
                        </div>

                        {ord.isAlreadyDispatched && (
                          <div className="text-[10px] text-amber-800 bg-amber-50/90 border border-amber-200/60 px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-medium">
                            <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Is order ka stock pehle hi cut ho chuka hai (Double deduction nahi hoga).</span>
                          </div>
                        )}

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
                            ord.items.map((item, itemIdx) => {
                              const swapKey = `${idx}-${itemIdx}`;
                              const isSwapping = editingItemSwapKey === swapKey;
                              return (
                                <div
                                  key={itemIdx}
                                  className="flex flex-col gap-1.5 text-xs p-2.5 rounded-xl bg-white shadow-2xs"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                      <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md text-xs">
                                        {item.sku}
                                      </span>
                                      {item.isSubstituted && (
                                        <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200">
                                          🔄 Substituted (Label: {item.originalSku})
                                        </span>
                                      )}
                                      {item.originalSku && !item.isSubstituted && (
                                        <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/50">
                                          Mapped: <strong className="font-mono">{item.originalSku}</strong>
                                        </span>
                                      )}
                                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px]">
                                        Qty: {item.quantity}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {item.isSubstituted ? (
                                        <button
                                          type="button"
                                          onClick={() => handleRevertSingleItem(idx, itemIdx)}
                                          className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                                        >
                                          Undo
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSkuPicker({
                                              isOpen: true,
                                              type: "SINGLE",
                                              fromSku: item.sku,
                                              orderIdx: idx,
                                              itemIdx: itemIdx,
                                              selectedProductId: item.productId || "",
                                            });
                                            setSkuSearchQuery("");
                                          }}
                                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-0.5 rounded-md cursor-pointer transition-colors border border-indigo-200/60 active:scale-95"
                                        >
                                          Swap
                                        </button>
                                      )}

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
                                </div>
                              );
                            })
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
                <Link
                  href="/dispatch-history"
                  onClick={handleClose}
                  className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View in History</span>
                </Link>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
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
            {allOrdersDuplicate ? (
              <button
                type="button"
                disabled={true}
                className="flex-1 py-2.5 px-3 bg-amber-50 border border-amber-200/90 text-amber-900 rounded-xl text-xs font-bold cursor-not-allowed flex items-center justify-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis shadow-none"
                title="Is file ke sabhi orders pehle hi dispatch ho chuke hain"
              >
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="truncate">
                  Blocked (All {parsedData.totalOrders} Orders Already Dispatched)
                </span>
              </button>
            ) : hasMissingSkus ? (
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

      {/* ======================================================== */}
      {/* 📱 NATIVE APP BOTTOM-SHEET SKU PICKER ("CODING WALA")    */}
      {/* ======================================================== */}
      {mounted &&
        skuPicker?.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              onClick={() => setSkuPicker(null)}
            />

            {/* Bottom-Sheet (Mobile) / Centered Modal (Desktop) */}
            <div className="relative z-10 w-full sm:max-w-lg bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom duration-250">
              
              {/* Top Grab Handle Notch (Mobile) */}
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 sm:hidden shrink-0" />

              {/* Sheet Header */}
              <div className="px-5 sm:px-6 pt-3 pb-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      Replacement Variant
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-xs text-gray-500 font-mono truncate">
                      Original: {skuPicker.fromSku}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mt-0.5 leading-tight">
                    Choose In-Stock Product
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSkuPicker(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors cursor-pointer shrink-0 ml-2"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Live Search & Filter Bar */}
              <div className="p-3.5 sm:px-6 bg-gray-50/70 border-b border-gray-100 shrink-0 space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={skuSearchQuery}
                    onChange={(e) => setSkuSearchQuery(e.target.value)}
                    placeholder="Search by SKU, product name..."
                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                    autoFocus
                  />
                  {skuSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSkuSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick Filters */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterOnlyInStock(!filterOnlyInStock)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 touch-manipulation ${
                      filterOnlyInStock
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>In-Stock Only</span>
                  </button>
                  <span className="text-[11px] text-gray-400 font-medium">
                    {pickerAvailableProducts.length} variants available
                  </span>
                </div>
              </div>

              {/* Product Candidates List */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-2">
                {pickerAvailableProducts.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400">
                    Koi matching product nahi mila.
                  </div>
                ) : (
                  pickerAvailableProducts.map((p) => {
                    const isSelected = skuPicker.selectedProductId === p.id;
                    const inStock = p.currentStock > 0;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (skuPicker.type === "BATCH") {
                            setSelectedSubProduct((prev) => ({
                              ...prev,
                              [skuPicker.fromSku]: p.id,
                            }));
                            setSkuPicker(null);
                          } else if (skuPicker.type === "SINGLE") {
                            handleSubstituteSingleItem(
                              skuPicker.orderIdx!,
                              skuPicker.itemIdx!,
                              p.id
                            );
                            setSkuPicker(null);
                          }
                        }}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99] touch-manipulation ${
                          isSelected
                            ? "bg-indigo-50/80 border-indigo-400 shadow-xs ring-1 ring-indigo-400"
                            : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 shadow-2xs"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                              {p.sku}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                inStock
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100/60"
                                  : "bg-rose-50 text-rose-700 border border-rose-100/60"
                              }`}
                            >
                              {inStock ? `Stock: ${p.currentStock}` : "Out of Stock"}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-gray-800 mt-1 line-clamp-1">
                            {p.name}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center">
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border border-gray-200 text-transparent flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-gray-200" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Sheet Footer */}
              <div className="p-3.5 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-500 shrink-0 flex items-center justify-between gap-2">
                <span className="truncate">
                  💡 Label par original SKU rahega, physical stock naye variant se minus hogi.
                </span>
                <button
                  type="button"
                  onClick={() => setSkuPicker(null)}
                  className="text-xs font-bold text-gray-700 hover:text-gray-900 active:bg-gray-100 px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl shrink-0 cursor-pointer shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
