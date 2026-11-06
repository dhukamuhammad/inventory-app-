"use client";

import { useEffect, useRef, useState } from "react";
import { 
  X, 
  Camera, 
  Zap, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Volume2,
  ScanLine,
  Barcode,
  Type,
  Image as ImageIcon,
  ChevronRight,
  Eye
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { sound } from "@/lib/sound";
import { lookupReturnOrder, processOrderReturn } from "@/app/actions/returns";

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (code: string) => void;
  onOrderProcessed?: (order: any) => void;
}

export function CameraScannerModal({ isOpen, onClose, onScanResult, onOrderProcessed }: CameraScannerModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const scanCooldownRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Default mode is "OCR" (Scan Text Mode) as requested by user
  const [scanMode, setScanMode] = useState<"OCR" | "BARCODE">("OCR");
  const scanModeRef = useRef<"OCR" | "BARCODE">("OCR");

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [isTorchSupported, setIsTorchSupported] = useState(false);

  // OCR state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Rapid RTO Auto-Inward Mode
  const [rapidMode, setRapidMode] = useState(false);
  const rapidModeRef = useRef(false);
  const [rapidStatus, setRapidStatus] = useState<{
    type: "SUCCESS" | "WARNING" | "INFO";
    title?: string;
    message: string;
    orderId?: string;
  } | null>(null);
  const [rapidCount, setRapidCount] = useState(0);

  // Keep ref in sync to prevent stale closures inside html5-qrcode
  useEffect(() => {
    scanModeRef.current = scanMode;
    scanCooldownRef.current = false;
  }, [scanMode]);

  useEffect(() => {
    rapidModeRef.current = rapidMode;
  }, [rapidMode]);

  // Always reset to Standard Safe Inspection Mode whenever modal opens or closes
  useEffect(() => {
    scanCooldownRef.current = false;
    if (isOpen) {
      setRapidMode(false);
      setRapidStatus(null);
      setRapidCount(0);
      setOcrError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const scannerId = "interactive-barcode-reader";

    const startScanner = async () => {
      try {
        setErrorMessage(null);

        // Formats to decode (1D courier barcodes + QR codes + DataMatrix)
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ];

        const html5QrCode = new Html5Qrcode(scannerId, {
          formatsToSupport,
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 20,
            qrbox: { width: 300, height: 160 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            if (!mounted) return;
            // Only handle barcode callbacks if currently in Barcode Mode
            if (scanModeRef.current === "BARCODE") {
              handleDetectedCode(decodedText.trim());
            }
          },
          () => {
            // Frame scan failure ignored
          }
        );

        if (!mounted) return;
        setHasCameraPermission(true);
        isScanningRef.current = true;

        // Check torch support
        try {
          const track = html5QrCode.getRunningTrackCameraCapabilities();
          if (track && (track as any).torchFeature?.isSupported?.()) {
            setIsTorchSupported(true);
          }
        } catch {
          // torch check fallback
        }
      } catch (err: any) {
        console.error("Camera scanner error:", err);
        if (mounted) {
          setHasCameraPermission(false);
          setErrorMessage(
            err.message || "Camera access denied. Please allow camera permissions in your browser settings."
          );
        }
      }
    };

    // Small delay to ensure DOM container is mounted
    const timer = setTimeout(startScanner, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    scanCooldownRef.current = false;
    try {
      if (scannerRef.current && isScanningRef.current) {
        isScanningRef.current = false;
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (err) {
      console.warn("Error stopping scanner:", err);
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !isScanningRef.current) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn("Failed to toggle torch:", err);
    }
  };

  const handleDetectedCode = async (rawCode: string) => {
    if (!rawCode || scanCooldownRef.current) return;

    // Cooldown prevents scanning the same code 10 times in 1 second
    scanCooldownRef.current = true;

    if (!rapidModeRef.current) {
      // Normal Mode: Play sweet beep, pass code back, close scanner
      sound.playSuccessBeep();
      stopScanner();
      scanCooldownRef.current = false;
      onScanResult(rawCode);
      onClose();
      return;
    }

    // Rapid-Fire Mode (Continuous RTO Inward without closing camera)
    try {
      setRapidStatus({ type: "INFO", title: "Searching...", message: `Looking up "${rawCode}" in database...` });
      const lookup = await lookupReturnOrder(rawCode);

      if (!lookup.success || !lookup.order) {
        sound.playErrorBeep();
        setRapidStatus({
          type: "WARNING",
          title: "Order Database Mein Nahi Mila",
          message: `"${rawCode}" dispatched orders me record nahi hai.`,
        });
      } else if (lookup.order.status !== "DISPATCHED") {
        sound.playDuplicateBeep();
        setRapidStatus({
          type: "WARNING",
          title: "Order Pehle Hi Inward Ho Chuka Hai!",
          message: `Order #${lookup.order.orderId} ka return record system mein pehle se registered hai.`,
          orderId: lookup.order.orderId,
        });
      } else {
        // Auto process as RTO Good
        const res = await processOrderReturn({
          dispatchedOrderId: lookup.order.id,
          returnType: "RETURN_RTO",
          condition: "GOOD",
          note: "Auto Inward via Rapid Scanner",
        });

        const hasSub = lookup.order.hasSubstitutedItems || lookup.order.items?.some((it: any) => it.isSubstituted);
        sound.playSuccessBeep();
        setRapidCount((prev) => prev + 1);
        setRapidStatus({
          type: "SUCCESS",
          title: hasSub ? "Substituted Stock Restocked!" : "Stock Restock Ho Gaya!",
          message: hasSub
            ? `Order #${lookup.order.orderId} (⚠️ Upgraded Item: Physical variant restocked)`
            : `Order #${lookup.order.orderId} (+1 Stock RTO Restocked)`,
        });

        // Live notification to parent Returns page immediately
        const returnedOrder = res?.order || {
          ...lookup.order,
          status: "RETURN_RTO",
          condition: "GOOD",
          returnedAt: new Date(),
          returnNote: "Auto Inward via Rapid Scanner",
        };
        onOrderProcessed?.(returnedOrder);
      }
    } catch (err: any) {
      sound.playErrorBeep();
      setRapidStatus({
        type: "WARNING",
        title: "Processing Error",
        message: err.message || "Failed to process rapid return.",
      });
    } finally {
      // Cooldown for next packet: 1.8 seconds in rapid mode
      setTimeout(() => {
        scanCooldownRef.current = false;
      }, 1800);
    }
  };

  // -------------------------------------------------------------
  // TEXT OCR FRAME CAPTURE & AI ANALYSIS
  // -------------------------------------------------------------
  const captureAndProcessOcr = async () => {
    if (isOcrProcessing) return;

    try {
      setIsOcrProcessing(true);
      setOcrError(null);

      const videoEl = document.querySelector("#interactive-barcode-reader video") as HTMLVideoElement | null;
      if (!videoEl || !videoEl.videoWidth) {
        throw new Error("Camera feed is not ready yet. Please wait 1 second.");
      }

      // Draw high-resolution frame from live video
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize canvas for frame capture.");
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      const base64Data = canvas.toDataURL("image/jpeg", 0.9);

      const res = await fetch("/api/returns/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data }),
      });

      const data = await res.json();

      if (!data.success) {
        sound.playErrorBeep();
        setOcrError(data.error || "Order ID text detect nahi hua. Camera ko text ke thoda paas layein.");
        return;
      }

      const detectedId = data.orderId;

      if (!rapidModeRef.current) {
        sound.playSuccessBeep();
        stopScanner();
        onScanResult(detectedId);
        onClose();
        return;
      }

      // Rapid Mode with OCR
      if (!data.lookup?.order) {
        sound.playErrorBeep();
        setRapidStatus({
          type: "WARNING",
          title: "Order Database Mein Nahi Mila",
          message: `"${detectedId}" dispatched orders me record nahi hai.`,
        });
      } else if (data.lookup.order.status !== "DISPATCHED") {
        sound.playDuplicateBeep();
        setRapidStatus({
          type: "WARNING",
          title: "Order Pehle Hi Inward Ho Chuka Hai!",
          message: `Order #${detectedId} ka return record system mein pehle se registered hai.`,
          orderId: detectedId,
        });
      } else {
        const res = await processOrderReturn({
          dispatchedOrderId: data.lookup.order.id,
          returnType: "RETURN_RTO",
          condition: "GOOD",
          note: "Auto Inward via Rapid OCR",
        });

        sound.playSuccessBeep();
        setRapidCount((prev) => prev + 1);
        setRapidStatus({
          type: "SUCCESS",
          title: "Stock Restock Ho Gaya!",
          message: `Order #${detectedId} (+1 Stock RTO Restocked)`,
        });

        // Live notification to parent Returns page immediately
        const returnedOrder = res?.order || {
          ...data.lookup.order,
          status: "RETURN_RTO",
          condition: "GOOD",
          returnedAt: new Date(),
          returnNote: "Auto Inward via Rapid OCR",
        };
        onOrderProcessed?.(returnedOrder);
      }
    } catch (err: any) {
      console.error("OCR Capture Error:", err);
      sound.playErrorBeep();
      setOcrError(err.message || "Failed to read text. Please point closer and retry.");
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Image Upload Fallback (e.g. from gallery or saved photo)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsOcrProcessing(true);
      setOcrError(null);

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await fetch("/api/returns/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64Data }),
          });

          const data = await res.json();
          if (!data.success) {
            sound.playErrorBeep();
            setOcrError(data.error || "Order ID text nahi mila is image me.");
            return;
          }

          sound.playSuccessBeep();
          stopScanner();
          onScanResult(data.orderId);
          onClose();
        } catch (err: any) {
          sound.playErrorBeep();
          setOcrError(err.message || "Failed to analyze image.");
        } finally {
          setIsOcrProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      sound.playErrorBeep();
      setOcrError(err.message || "Failed to load image file.");
      setIsOcrProcessing(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-lg bg-white border border-gray-200 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* Hidden File Input for Gallery / Photo Fallback */}
        <input 
          ref={fileInputRef} 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleFileUpload} 
        />

        {/* Top Header - Clean Dashboard Theme */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              scanMode === "OCR" 
                ? "bg-indigo-50 text-indigo-600" 
                : "bg-amber-50 text-amber-600"
            }`}>
              {scanMode === "OCR" ? (
                <Type className="w-4.5 h-4.5 stroke-[2.2]" />
              ) : (
                <Barcode className="w-4.5 h-4.5 stroke-[2.2]" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 leading-tight">
                {scanMode === "OCR" ? "Live Text OCR Scanner" : "Live Barcode Scanner"}
              </h3>
              <p className="text-[11px] text-gray-500">
                {scanMode === "OCR" ? "Point camera at printed Order ID text" : "Scan courier AWB or Order barcode"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Gallery Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors"
              title="Upload label photo from gallery"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {/* Flashlight Button */}
            {isTorchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl border transition-all ${
                  torchOn 
                    ? "bg-amber-500 text-white border-amber-500 shadow-xs" 
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
                title="Toggle Torch/Flashlight"
              >
                <Zap className={`w-4 h-4 ${torchOn ? "fill-white" : ""}`} />
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-700 border border-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dual Mode Switcher Tabs - Dashboard Theme (OCR First) */}
        <div className="p-2 bg-gray-50 border-b border-gray-100 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setScanMode("OCR");
              setOcrError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              scanMode === "OCR"
                ? "bg-white text-indigo-600 shadow-xs border border-gray-200"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Scan Text Mode (OCR)</span>
            <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">
              Default
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScanMode("BARCODE");
              setOcrError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              scanMode === "BARCODE"
                ? "bg-white text-indigo-600 shadow-xs border border-gray-200"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>Barcode Mode</span>
          </button>
        </div>

        {/* Workflow Mode Tabs (Standard Inspection vs Rapid RTO) */}
        <div className="px-3 pt-2.5 pb-2 bg-slate-50 border-b border-slate-100 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Inward Mode
            </span>
            {rapidMode ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                ⚡ Auto RTO Mode Active {rapidCount > 0 ? `(${rapidCount} Done)` : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                Standard Safe Mode
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 bg-slate-200/60 p-1 rounded-xl">
            {/* Standard Mode Tab */}
            <button
              type="button"
              onClick={() => {
                setRapidMode(false);
                setRapidStatus(null);
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                !rapidMode
                  ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              <span>Standard (Inspect)</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                !rapidMode ? "bg-indigo-50 text-indigo-700" : "bg-slate-300/60 text-slate-600"
              }`}>
                Default
              </span>
            </button>

            {/* Rapid RTO Tab */}
            <button
              type="button"
              onClick={() => {
                setRapidMode(true);
                setRapidStatus(null);
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                rapidMode
                  ? "bg-amber-500 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Rapid RTO</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                rapidMode ? "bg-amber-600 text-white" : "bg-slate-300/60 text-slate-600"
              }`}>
                Bulk
              </span>
            </button>
          </div>

          {/* Mode Subtitle Explainer */}
          <div className="text-[10.5px] leading-tight px-0.5">
            {!rapidMode ? (
              <p className="text-slate-600 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Scan hone par packet inspect karke <strong>RTO / Customer</strong> aur <strong>Good / Defective</strong> choose karein.</span>
              </p>
            ) : (
              <p className="text-amber-800 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span>⚠️ Sirf sealed courier packets ke liye — bina puche seedha <strong>RTO Good (+1 Stock)</strong> restock hoga!</span>
              </p>
            )}
          </div>
        </div>

        {/* Viewport & Scanner Box - Clean Unobstructed View */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[340px]">
          
          {/* HTML5 QR Code Mount Node (Continuous Camera Stream) */}
          <div id="interactive-barcode-reader" className="w-full h-full" />

          {/* Targeting Box Overlay - 100% CLEAR INSIDE, NO TEXT OBSTRUCTION */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            
            {scanMode === "OCR" ? (
              /* OCR Text Aiming Box (Clean Corner Guide, NO TEXT INSIDE) */
              <div className="relative w-[320px] sm:w-[360px] h-[100px] sm:h-[110px] rounded-xl border border-indigo-400/40 flex items-center justify-center">
                {/* 4 Corner Focus Brackets */}
                <div className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-3 border-l-3 border-indigo-500 rounded-tl-sm" />
                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-3 border-r-3 border-indigo-500 rounded-tr-sm" />
                <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-3 border-l-3 border-indigo-500 rounded-bl-sm" />
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-3 border-r-3 border-indigo-500 rounded-br-sm" />

                {/* Subtle horizontal laser guideline */}
                <div className="absolute inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_6px_#6366f1] animate-pulse" />

                {/* COMPLETELY EMPTY & CLEAR INSIDE — NO TEXT LABELS */}
              </div>
            ) : (
              /* Barcode Aiming Box (Clean Corner Guide, NO TEXT INSIDE) */
              <div className="relative w-[300px] h-[160px] rounded-xl border border-amber-400/40 flex items-center justify-center">
                {/* 4 Corner Focus Brackets */}
                <div className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-3 border-l-3 border-amber-500 rounded-tl-sm" />
                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-3 border-r-3 border-amber-500 rounded-tr-sm" />
                <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-3 border-l-3 border-amber-500 rounded-bl-sm" />
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-3 border-r-3 border-amber-500 rounded-br-sm" />

                {/* Subtle bouncing laser line */}
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_6px_#f59e0b] animate-bounce" />

                {/* COMPLETELY EMPTY & CLEAR INSIDE — NO TEXT LABELS */}
              </div>
            )}
          </div>

          {/* OCR Bottom Action Shutter Button */}
          {scanMode === "OCR" && hasCameraPermission && (
            <div className="absolute bottom-4 inset-x-0 flex flex-col items-center justify-center gap-2 z-20 pointer-events-auto px-4">
              <button
                type="button"
                disabled={isOcrProcessing}
                onClick={captureAndProcessOcr}
                className="w-full sm:w-auto px-7 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 cursor-pointer"
              >
                {isOcrProcessing ? (
                  <>
                    <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                    <span>Analyzing Text via AI OCR...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4.5 h-4.5 fill-white/20" />
                    <span>Read Order ID Text</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* OCR Error Notification Toast */}
          {ocrError && scanMode === "OCR" && (
            <div className="absolute top-4 inset-x-4 z-30 animate-in slide-in-from-top duration-200">
              <div className="p-3 rounded-xl border border-rose-200 bg-white/95 text-rose-800 text-xs font-semibold shadow-lg flex items-start gap-2.5 backdrop-blur-md">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{ocrError}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    💡 Camera ko packet ke &ldquo;Order Id:&rdquo; text ke bilkul samne rakhein aur dobara tap karein.
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setOcrError(null)} 
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Camera Permission Error Overlay - Clean White Card */}
          {hasCameraPermission === false && (
            <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-6 text-center space-y-3 z-30">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-gray-900">Camera Access Required</h4>
              <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                {errorMessage || "Please allow camera access in your browser to scan shipping labels."}
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Upload Photo
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold rounded-xl transition-colors"
                >
                  Close & Enter Manually
                </button>
              </div>
            </div>
          )}

          {/* Rapid Mode Live Toast Notification (Zero Truncation & App Style) */}
          {rapidStatus && (
            <div className="absolute bottom-16 inset-x-3 z-30 animate-in slide-in-from-bottom duration-200">
              <div
                className={`p-3.5 rounded-2xl border text-xs shadow-xl flex items-start gap-2.5 backdrop-blur-md ${
                  rapidStatus.type === "SUCCESS"
                    ? "bg-emerald-50/95 border-emerald-200 text-emerald-900"
                    : rapidStatus.type === "WARNING"
                    ? "bg-amber-50/95 border-amber-200 text-amber-900"
                    : "bg-blue-50/95 border-blue-200 text-blue-900"
                }`}
              >
                {rapidStatus.type === "SUCCESS" ? (
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  {rapidStatus.title && (
                    <h5 className="font-bold text-xs leading-tight mb-0.5">
                      {rapidStatus.title}
                    </h5>
                  )}
                  <p className="text-[11px] font-medium leading-relaxed break-words opacity-90">
                    {rapidStatus.message}
                  </p>
                  
                  {rapidStatus.orderId && (
                    <button
                      type="button"
                      onClick={() => {
                        stopScanner();
                        onScanResult(rapidStatus.orderId!);
                        onClose();
                      }}
                      className="mt-2 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 text-[10px] font-bold hover:bg-amber-100/60 active:scale-95 transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <span>Order Details & History Dekhein</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setRapidStatus(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-black/5 shrink-0 cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Bottom Helper Bar - Clean Dashboard Theme */}
        <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Audio confirmation active</span>
          </div>

          <span className="font-mono text-gray-400 text-[10px]">
            {scanMode === "OCR" ? "AI Text Extraction (Amazon • Flipkart • Meesho)" : "AWB • Order Barcode • QR"}
          </span>
        </div>

      </div>

    </div>
  );
}
