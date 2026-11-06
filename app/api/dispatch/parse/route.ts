import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import path from "path";

export const runtime = "nodejs";

// Ensure DOMMatrix is available for pdf-parse worker in Node/Next runtime
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const canvas = require("@napi-rs/canvas");
    if (canvas?.DOMMatrix) {
      (globalThis as any).DOMMatrix = canvas.DOMMatrix;
    }
  } catch {
    // ignore
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createCanvas } = require("@napi-rs/canvas");

// -------------------------------------------------------------
// HIGH-SPEED BARCODE DECODER (ZXing - Zero Tesseract Crashes)
// -------------------------------------------------------------
let zxingReaderInstance: any = null;
function getZxingReader() {
  if (!zxingReaderInstance) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ZXing = require("html5-qrcode/third_party/zxing-js.umd.js");
      const reader = new ZXing.MultiFormatReader();
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.CODE_128,
        ZXing.BarcodeFormat.QR_CODE,
        ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.EAN_13,
      ]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      reader.setHints(hints);
      zxingReaderInstance = { reader, ZXing };
    } catch (e) {
      console.warn("ZXing initialization warning:", e);
    }
  }
  return zxingReaderInstance;
}

// Candidate multi-zone barcode decoder (scans full page dynamically across zones with quiet zones & contrast enhancement)
function decodeDynamicBarcode(fullCanvas: any, width: number, height: number): string | null {
  try {
    const inst = getZxingReader();
    if (!inst) return null;
    const { reader, ZXing } = inst;

    // Candidate scanning zones across the entire page (covers any platform layout & paper size)
    const zones = [
      // Zone 1: Top-left quadrant (Standard Amazon, Delhivery, Flipkart)
      { x: 0, y: 0, w: Math.floor(width * 0.60), h: Math.floor(height * 0.25) },
      // Zone 2: Upper-middle left inside inner box (Speed Post, Meesho headers, shifted barcodes)
      { x: Math.floor(width * 0.09), y: Math.floor(height * 0.17), w: Math.floor(width * 0.42), h: Math.floor(height * 0.14) },
      // Zone 3: Full top width (Standard wider labels)
      { x: 0, y: 0, w: width, h: Math.floor(height * 0.25) },
      // Zone 4: Center band (Centered waybills, Delhivery B2B)
      { x: 0, y: Math.floor(height * 0.25), w: width, h: Math.floor(height * 0.35) },
      // Zone 5: Bottom band (Bottom-oriented waybills)
      { x: 0, y: Math.floor(height * 0.60), w: width, h: Math.floor(height * 0.35) },
    ];

    for (const z of zones) {
      if (z.w <= 0 || z.h <= 0) continue;
      // Add white margin (quiet zone) for barcode decoders to detect start/stop delimiters
      const pad = 18;
      const sub = createCanvas(z.w + pad * 2, z.h + pad * 2);
      const sctx = sub.getContext("2d");
      sctx.fillStyle = "#FFFFFF";
      sctx.fillRect(0, 0, sub.width, sub.height);
      sctx.drawImage(fullCanvas, z.x, z.y, z.w, z.h, pad, pad, z.w, z.h);

      const imgData = sctx.getImageData(0, 0, sub.width, sub.height);
      const len = imgData.data.length / 4;
      const lums = new Uint8ClampedArray(len);
      for (let i = 0; i < len; i++) {
        lums[i] = (imgData.data[i * 4] * 77 + imgData.data[i * 4 + 1] * 150 + imgData.data[i * 4 + 2] * 29) >> 8;
      }

      // Pass A: Standard Hybrid Binarizer
      try {
        const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.RGBLuminanceSource(lums, sub.width, sub.height)));
        const res = reader.decode(bmp);
        if (res && res.getText()) return res.getText().trim();
      } catch {}

      // Pass B: High-contrast binarizer (rescues anti-aliased 1-pixel barcode bars)
      for (const thresh of [115, 125, 135]) {
        const sharpLums = new Uint8ClampedArray(len);
        for (let i = 0; i < len; i++) {
          sharpLums[i] = lums[i] < thresh ? 0 : 255;
        }
        try {
          const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.RGBLuminanceSource(sharpLums, sub.width, sub.height)));
          const res = reader.decode(bmp);
          if (res && res.getText()) return res.getText().trim();
        } catch {}
      }
    }

    return null;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// DYNAMIC COURIER LOGISTICS DETECTOR (ZERO HARDCODING)
// -------------------------------------------------------------
function extractCourier(text: string): string {
  if (!text) return "";

  // 1. Direct carrier brand matches (case-insensitive)
  if (/\bdelhivery\b/i.test(text)) return "DELHIVERY";
  if (/\b(atspl_ips|india\s*post|speed\s*post|ems\s*speed)\b/i.test(text)) return "India Post";
  if (/\b(atspl|ats\b|amazon\s*transportation|easy\s*ship)\b/i.test(text)) return "ATSPL";
  if (/\b(e-?kart\s*logistics|e-?kart\b|ekart\b|fmp)\b/i.test(text)) return "E-Kart Logistics";
  if (/\b(blue\s*dart|bluedart)\b/i.test(text)) return "Blue Dart";
  if (/\bshadowfax\b/i.test(text)) return "Shadowfax";
  if (/\bxpressbees\b/i.test(text)) return "Xpressbees";
  if (/\bvalmo\b/i.test(text)) return "Valmo";
  if (/\bdtdc\b/i.test(text)) return "DTDC";
  if (/\bfedex\b/i.test(text)) return "FedEx";

  // 2. Generic carrier label detection (e.g. "Courier: Smartr Logistics")
  const labelMatch = text.match(
    /(?:Courier|Carrier|Logistics|Delivery Partner|Delivered By)[:\s]+([A-Za-z0-9\s\-]+?)(?=\n|\r|,|$)/i
  );
  if (labelMatch) {
    const raw = labelMatch[1].trim();
    if (raw.length >= 3 && raw.length <= 25) {
      return raw.toUpperCase();
    }
  }

  return "";
}

// Multi-Tier Courier Resolver: Label Text Priority > AWB Format Cross-Check > Marketplace Default
function resolveCourier(labelText: string, awb: string, channel: string): string {
  // 1. Label text (ground truth printed on label)
  const fromText = extractCourier(labelText);
  if (fromText) {
    if (/ATSPL_IPS/i.test(labelText) || /speed\s*post/i.test(labelText) || /india\s*post/i.test(labelText)) {
      return "India Post";
    }
    return fromText;
  }

  // 2. AWB Carrier Standard Series
  if (/^(?:13|14)\d{11,14}$/.test(awb)) {
    return "DELHIVERY";
  }
  if (/^(?:37|38|39)\d{10}$/.test(awb)) {
    return "ATSPL";
  }
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(awb)) {
    return "India Post";
  }
  if (/^FMP/i.test(awb)) {
    return "E-Kart Logistics";
  }

  // 3. Channel Default Fallback
  if (channel === "AMAZON") return "ATSPL";
  if (channel === "FLIPKART") return "E-Kart Logistics";
  if (channel === "MEESHO") return "Valmo";

  return "DELHIVERY";
}

function lcs(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// -------------------------------------------------------------
// INTELLIGENT SKU RESOLVER (EXACT + SAFE BOUNDARY + NORMALIZED + OCR NOISE TOLERANT)
// -------------------------------------------------------------
function findMatchingSku(text: string, knownSkus: string[]): string | null {
  if (!text || !knownSkus || knownSkus.length === 0) return null;

  const cleanText = text.trim().toLowerCase();

  // 1. Direct exact equality match (fastest & highest confidence)
  for (const kSku of knownSkus) {
    if (cleanText === kSku.trim().toLowerCase()) {
      return kSku;
    }
  }

  // 2. Safe custom boundary match (hyphens, underscores, slashes are treated as SKU characters, not word boundaries)
  for (const kSku of knownSkus) {
    const escaped = kSku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exactRegex = new RegExp("(?<=^|[^A-Za-z0-9\\-_/])" + escaped + "(?=$|[^A-Za-z0-9\\-_/])", "i");
    if (exactRegex.test(text)) return kSku;
  }

  // 3. Exact normalized alphanumeric match (without hyphens/spaces)
  const normText = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  for (const kSku of knownSkus) {
    const normSku = kSku.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (normText === normSku) return kSku;
  }

  // 4. Token-by-token normalized exact match
  const rawTokens = text.split(/[\s,;|()[\]{}]+/).filter((t) => t.trim().length >= 3);
  for (const kSku of knownSkus) {
    const normSku = kSku.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    for (const tok of rawTokens) {
      const normTok = tok.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (normTok === normSku) return kSku;
    }
  }

  // 5. High-confidence fuzzy match for OCR character substitutions
  let bestSku: string | null = null;
  let bestScore = 0;
  for (const tok of rawTokens) {
    const cleanTok = tok.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (cleanTok.length < 5) continue;
    for (const kSku of knownSkus) {
      const normSku = kSku.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      // Lengths must be close (diff at most 2 chars)
      if (Math.abs(cleanTok.length - normSku.length) > 2) continue;
      const common = lcs(cleanTok, normSku);
      const ratio = common / Math.max(cleanTok.length, normSku.length);
      if (ratio > bestScore && ratio >= 0.82) {
        bestScore = ratio;
        bestSku = kSku;
      }
    }
  }

  return bestSku;
}

// -------------------------------------------------------------
// 1. FLIPKART LABEL PARSER (UNIVERSAL: CROPPED & UNCROPPED)
// -------------------------------------------------------------
function parseFlipkartPage(pageText: string, knownSkus: string[] = []) {
  // Order ID (e.g. OD438942197193229100)
  const orderIdMatch = pageText.match(/OD\d{16,22}/);
  const orderId = orderIdMatch ? orderIdMatch[0] : null;

  // Order Date (checks Order Date, Invoice Date, or label print timestamp)
  const dateMatch =
    pageText.match(/Order Date[:\s]*([0-9]{2}[-/.][0-9]{2}[-/.][0-9]{2,4})/i) ||
    pageText.match(/Invoice Date[:\s]*([0-9]{2}[-/.][0-9]{2}[-/.][0-9]{2,4})/i) ||
    pageText.match(/Printed at \d+ hrs,\s*([0-9]{2}[-/.][0-9]{2}[-/.][0-9]{2,4})/i);
  const orderDate = dateMatch ? dateMatch[1].trim() : "";

  // AWB Tracking Number (Prioritize explicit AWB No., e.g. SF3743885045F or FMPC6661184765)
  const awbMatch =
    pageText.match(/AWB No\.?[\s:\r\n]*([A-Za-z0-9]+)/i) ||
    pageText.match(/FMP[A-Z0-9]{8,15}/i);
  const awb = awbMatch ? (awbMatch[1] || awbMatch[0]).trim() : "N/A";

  // Payment Mode (COD vs PREPAID)
  const paymentMatch = pageText.match(/\b(COD|PREPAID)\b/i);
  const paymentType = paymentMatch ? paymentMatch[1].toUpperCase() : "PREPAID";

  // Customer Name
  const customerMatch = pageText.match(/Shipping\/Customer address:\s*Name:\s*([^,\n\r]+)/i);
  const customerName = customerMatch ? customerMatch[1].trim() : "";

  // Destination City & Pincode
  const pinMatch = pageText.match(/([A-Za-z\s]+)\s*-\s*(\d{6}),\s*([A-Z\-]+)/);
  const destination = pinMatch ? pinMatch[0].trim() : "";

  // Courier Logistics - DYNAMICALLY EXTRACTED
  const courier = extractCourier(pageText);

  // -----------------------------------------------------------
  // MULTI-STRATEGY SKU EXTRACTION (ZERO HARDCODED FORMAT DEPENDENCY)
  // -----------------------------------------------------------
  const items: { sku: string; description: string; quantity: number }[] = [];

  // Strategy 1: Flexible Token-based Table Extraction (Cropped 4x6 & Thermal Labels)
  // Flipkart table header: "SKU ID | Description" followed by "QTY"
  // Rows can be multi-line: index, sku, "| description", qty
  const skuSectionMatch = pageText.match(
    /SKU ID\s*\|?\s*Description[\s\S]*?(?=FMP[A-Z0-9]{8,15}|AWB No|Not for resale|Tax Invoice|$)/i
  );
  if (skuSectionMatch) {
    const rawTokens = skuSectionMatch[0]
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && !/^SKU ID/i.test(t) && !/^QTY$/i.test(t) && t !== "|");

    let i = 0;
    while (i < rawTokens.length) {
      let token = rawTokens[i];

      // Skip row number (e.g. "1", "2") if followed by an alphanumeric SKU
      if (/^\d+$/.test(token) && i + 1 < rawTokens.length && /^[A-Za-z0-9\-_]{3,35}$/.test(rawTokens[i + 1])) {
        i++;
        token = rawTokens[i];
      }

      // Detect SKU token (3-35 alphanumeric with hyphens/underscores)
      if (/^[A-Za-z0-9\-_]{3,35}$/.test(token)) {
        const sku = token;
        i++;
        let description = "Flipkart Product";
        let quantity = 1;

        if (i < rawTokens.length && rawTokens[i].startsWith("|")) {
          description = rawTokens[i].replace(/^\|\s*/, "").trim();
          i++;
        }

        if (i < rawTokens.length && /^\d+$/.test(rawTokens[i])) {
          quantity = parseInt(rawTokens[i], 10) || 1;
          i++;
        }

        items.push({ sku, description, quantity });
      } else {
        i++;
      }
    }
  }

  // Strategy 2: Single-line regex matching table rows with pipes
  if (items.length === 0) {
    const lines = pageText.split("\n");
    for (const line of lines) {
      const rowMatch = line.match(/^\s*(?:\d+\s+)?([A-Za-z0-9\-_\/]{3,35})\s*\|\s*(.+?)\s+(\d+)\s*$/);
      if (rowMatch) {
        items.push({
          sku: rowMatch[1].trim(),
          description: rowMatch[2].trim(),
          quantity: parseInt(rowMatch[3], 10) || 1,
        });
      }
    }
  }

  // Strategy 3: Invoice table fallback (for full uncropped A4 pages)
  if (items.length === 0) {
    const invoiceSkuMatch = pageText.match(/\|\s*([A-Za-z0-9\-_\/]+)\s*\|\s*IMEI/i);
    const qtyMatch = pageText.match(/TOTAL QTY:\s*(\d+)/i);
    if (invoiceSkuMatch) {
      items.push({
        sku: invoiceSkuMatch[1].trim(),
        description: "Flipkart Product",
        quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 1,
      });
    }
  }

  // Strategy 4: Direct Inventory Cross-Match (Format-Agnostic Database Fallback)
  if (items.length === 0 && knownSkus && knownSkus.length > 0) {
    const matchedSku = findMatchingSku(pageText, knownSkus);
    if (matchedSku) {
      items.push({
        sku: matchedSku,
        description: "Flipkart Product",
        quantity: 1,
      });
    }
  }

  const hasMissingSku = items.length === 0;
  const missingSkuError = hasMissingSku
    ? "Label me SKU table ya code detect nahi ho paya. Kripya check karein ki SKU visible hai."
    : undefined;

  return {
    orderId,
    orderDate,
    awb,
    paymentType,
    customerName,
    destination,
    courier,
    items,
    hasMissingSku,
    missingSkuError,
  };
}

// -------------------------------------------------------------
// 2. MEESHO LABEL PARSER (DYNAMIC COURIER)
// -------------------------------------------------------------
function parseMeeshoPage(pageText: string, knownSkus: string[] = []) {
  // 1. Customer Name
  let customerName = "";
  const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);
  const custIdx = lines.findIndex((l) => /Customer\s*Address/i.test(l));
  if (custIdx !== -1) {
    for (let i = custIdx; i < Math.min(lines.length, custIdx + 4); i++) {
      let candidate = lines[i]
        .replace(/Customer\s*Address[.:\s]*/i, "")
        .replace(/(?:Prepaid|COD)[:\s]*(?:Do not collect cash|Check the payable amount[a-z\s]*)?/i, "")
        .replace(/Delhivery/i, "")
        .trim();
      candidate = candidate.replace(/^[^A-Za-z0-9]+/, "").trim();
      if (
        candidate.length >= 3 &&
        candidate.length <= 40 &&
        !/(?:Destination|Floor|Street|Road|Nagar|Colony|Village|Dist|Pin|Pincode|House|Plot|D\.?No|P\.?No|Near|Opp)/i.test(
          candidate
        ) &&
        /^[A-Za-z]/.test(candidate)
      ) {
        customerName = candidate;
        break;
      }
    }
  }

  // Order Date
  const dateMatch =
    pageText.match(/Order Date[\s:\n]*([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i) ||
    pageText.match(/Invoice Date[\s:\n]*([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i);
  const orderDate = dateMatch ? dateMatch[1].trim() : "";

  // 2. Destination City & Pincode from address or Destination Code
  const cityPinMatch = pageText.match(/([A-Za-z\s]+),\s*([A-Za-z\s]+),\s*(\d{6})/);
  const destCodeMatch = pageText.match(/Destination Code\s*\n([^\n\r]+)/i);

  let destination = "";
  if (cityPinMatch) {
    destination = `${cityPinMatch[1].trim()}, ${cityPinMatch[2].trim()} (${cityPinMatch[3]})`;
  } else if (destCodeMatch) {
    destination = destCodeMatch[1].trim().replace(/_/g, " ");
  }

  // 3. Payment Mode (Prepaid vs COD)
  const isCod = /COD:\s*Check the payable amount|\bCOD\b/i.test(pageText);
  const paymentType = isCod ? "COD" : "PREPAID";

  // 4. Courier Logistics - DYNAMICALLY EXTRACTED
  const courier = extractCourier(pageText);

  // 5. AWB Number (Meesho Delhivery 14-16 digits barcode)
  const awbMatch =
    pageText.match(/\b(14\d{14})\b/) ||
    pageText.match(/\b(14\d{12,16})\b/) ||
    pageText.match(/Return Code[\s\S]*?(\d{14,18})/i) ||
    pageText.match(/\b(14\d{10,18})\b/);
  const awb = awbMatch ? (awbMatch[1] || awbMatch[0]).trim() : "N/A";

  // 6. SKU Details from Product Details Table
  const items: { sku: string; description: string; quantity: number }[] = [];
  let orderId = "";

  // Strategy 1: Line-by-line structure
  const orderNoIdx = lines.findIndex((l) => /^Order\s*No\.?$/i.test(l));

  if (orderNoIdx !== -1 && orderNoIdx + 5 <= lines.length) {
    const rawSku = lines[orderNoIdx + 1];
    const rawSize = lines[orderNoIdx + 2];
    const rawQty = lines[orderNoIdx + 3];
    const rawColor = lines[orderNoIdx + 4];
    const rawOrder = lines[orderNoIdx + 5];

    if (rawSku && !/^(SKU|Size|Qty|Color|Product|Order)$/i.test(rawSku)) {
      const resolvedSku = findMatchingSku(rawSku, knownSkus) || rawSku;
      items.push({
        sku: resolvedSku,
        description: `Meesho - ${rawSize || "Product"}`,
        quantity: parseInt(rawQty, 10) || 1,
      });
      if (rawOrder) {
        orderId = rawOrder.trim();
      }
    }
  }

  // Strategy 2: Single-line regex
  if (items.length === 0) {
    const prodTableMatch = pageText.match(/SKU\s+Size\s+Qty\s+Color\s+Order No\.[\s\S]*?(?=TAX INVOICE|BILL TO|$)/i);
    if (prodTableMatch) {
      const pLines = prodTableMatch[0].split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of pLines) {
        if (/^(SKU|Product Details|Size|Qty|Color)/i.test(line)) continue;
        const m = line.match(/^([A-Za-z0-9\-_\/]+)\s+(.+?)\s+(\d+)\s+([A-Za-z0-9]+|NA)\s+([0-9_]+)/i);
        if (m && !/^(SKU|Product|Size|Qty|Color)$/i.test(m[1].trim())) {
          const rawSku = m[1].trim();
          const resolvedSku = findMatchingSku(rawSku, knownSkus) || rawSku;
          items.push({
            sku: resolvedSku,
            description: `Meesho - ${m[2].trim()}`,
            quantity: parseInt(m[3], 10) || 1,
          });
          if (!orderId) {
            orderId = m[5].trim();
          }
        }
      }
    }
  }

  // Strategy 3: Invoice Table
  if (items.length === 0) {
    const invoiceMatch = pageText.match(/1\s+([A-Za-z0-9\-_\/]+)\s+(\d{6,8})\s+(\d+)\s+₹/i);
    if (invoiceMatch && !/^(SKU|HSN|TAX)/i.test(invoiceMatch[1])) {
      const rawSku = invoiceMatch[1].trim();
      const resolvedSku = findMatchingSku(rawSku, knownSkus) || rawSku;
      items.push({
        sku: resolvedSku,
        description: "Meesho Product",
        quantity: parseInt(invoiceMatch[3], 10) || 1,
      });
    }
  }

  // Strategy 4: Direct Inventory Cross-Match with Intelligent Noise Tolerance
  if (items.length === 0 && knownSkus && knownSkus.length > 0) {
    const matchedSku = findMatchingSku(pageText, knownSkus);
    if (matchedSku) {
      const qMatch = pageText.match(/\b(?:Qty|QTY)[:\s]*(\d+)\b/i) || pageText.match(/Free Size\s+(\d+)/i);
      items.push({
        sku: matchedSku,
        description: "Meesho Product",
        quantity: qMatch ? parseInt(qMatch[1], 10) : 1,
      });
    }
  }

  if (!orderId) {
    const poMatch =
      pageText.match(/Order\s*No\.?[\s\S]*?([0-9_]{15,25})/i) ||
      pageText.match(/Purchase Order No\.?\s*([0-9_]+)/i) ||
      pageText.match(/\b(34\d{16}(?:_\d+)?)\b/);
    if (poMatch) orderId = (poMatch[1] || poMatch[0]).trim();
  }

  const hasMissingSku = items.length === 0;
  const missingSkuError = hasMissingSku
    ? "Label me SKU table ya code detect nahi ho paya. Kripya check karein ki SKU visible hai."
    : undefined;

  return {
    orderId: orderId || `MEESHO-${awb}`,
    orderDate,
    awb,
    paymentType,
    customerName,
    destination,
    courier,
    items,
    hasMissingSku,
    missingSkuError,
  };
}

// -------------------------------------------------------------
// 3. AMAZON MERGED ORDER PARSER (DYNAMIC COURIER & AWB)
// -------------------------------------------------------------
function parseAmazonOrderBlock(combinedText: string, knownSkus: string[] = []) {
  // 1. Amazon Order Number (e.g. 403-5760593-6668338)
  const orderMatch =
    combinedText.match(/Order\s*(?:Id|Number)[:\s]*([0-9]{3}-[0-9]{7}-[0-9]{7})/i) ||
    combinedText.match(/\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b/);
  const orderId = orderMatch ? orderMatch[1].trim() : null;

  // 2. Order Date (Full Date from Invoice preferred)
  const dateMatch =
    combinedText.match(/Order Date[:\s]*([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i) ||
    combinedText.match(/Invoice Date[:\s]*([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i) ||
    combinedText.match(/Ship Date[:\s]*([0-9]{2}-[A-Za-z]{3})/i);
  const orderDate = dateMatch ? dateMatch[1].trim() : "";

  // 3. Real AWB Tracking Number from Label (e.g. AWB 374111691359 or 13371887426321)
  const awbMatch =
    combinedText.match(/(?:AWB|AWS|AW|AB|Tracking\s*(?:No|Number)?)[#:\s]*([0-9]{10,14})/i) ||
    combinedText.match(/\b(37\d{10})\b/) ||
    combinedText.match(/\b(13\d{12})\b/) ||
    combinedText.match(/\b(37\d{8,11})\b/) ||
    combinedText.match(/AWB[#:\s]*([0-9A-Za-z]+)/i);

  let awb = awbMatch ? awbMatch[1].trim() : "N/A";
  // Never copy Order ID into AWB
  if (awb === orderId) {
    awb = "N/A";
  }

  // 4. Courier Logistics - DYNAMICALLY EXTRACTED FROM LABEL
  const courier = extractCourier(combinedText);

  // 5. Customer Name
  const custMatch =
    combinedText.match(/Shipping Address\s*:?[\s\r\n]+([^\n\r]+)/i) ||
    combinedText.match(/Ship To:\s*(?:[a-z]\s*[\r\n]+)?([^\n\r]+)/i) ||
    combinedText.match(/Billing Address\s*:?[\s\r\n]+([^\n\r]+)/i);
  const customerName = custMatch ? custMatch[1].trim() : "";

  // 6. Destination City, State & Pincode
  let destination = "";
  const shipSection = combinedText.split(/Shipping Address\s*:?/i)[1] || combinedText;
  const pinMatch = shipSection.match(/([A-Za-z\s]+),\s*([A-Za-z\s]+),\s*(\d{6})/);
  if (pinMatch) {
    const cityLines = pinMatch[1].trim().split("\n");
    const city = cityLines[cityLines.length - 1].trim();
    destination = `${city}, ${pinMatch[2].trim()} (${pinMatch[3]})`;
  }

  if (!destination) {
    const labelDestMatch = combinedText.match(/([A-Z\s]+)\s+(\d{6})\s*\n+([A-Z\s]+)/i);
    if (labelDestMatch) {
      destination = `${labelDestMatch[1].trim()} ${labelDestMatch[2]}, ${labelDestMatch[3].trim()}`;
    }
  }

  // 7. Payment Mode (Prepaid vs COD)
  const isCod = /\bCOD\b|\bCash Memo\b/i.test(combinedText);
  const paymentType = isCod ? "COD" : "PREPAID";

  // 8. SKU and Quantity from Amazon Tax Invoice description
  // Format: B0HCWQ4R3T ( SCV-SSSPM-700 )
  const items: { sku: string; description: string; quantity: number }[] = [];

  const skuMatch =
    combinedText.match(/B0[A-Z0-9]{8}\s*\(\s*([A-Za-z0-9\-_\/]+)\s*\)/i) ||
    combinedText.match(/\(\s*([A-Za-z0-9\-_\/]{4,30})\s*\)/);

  const qtyMatch =
    combinedText.match(/₹[\d\.]+\s+(\d+)\s+₹[\d\.]+/) ||
    combinedText.match(/Qty[:\s]*(\d+)/i) ||
    combinedText.match(/\|\s*(\d+)\s*\|\s*₹/);

  const descMatch = combinedText.match(/1\s+([A-Za-z0-9\s|&]+?(?=B0|\(|HSN|₹))/i);
  const itemDescription = descMatch ? descMatch[1].trim().slice(0, 45) : "Amazon Product";

  if (skuMatch) {
    items.push({
      sku: skuMatch[1].trim(),
      description: itemDescription,
      quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 1,
    });
  }

  // Strategy Fallback: Direct Inventory Cross-Match
  if (items.length === 0 && knownSkus && knownSkus.length > 0) {
    const matchedSku = findMatchingSku(combinedText, knownSkus);
    if (matchedSku) {
      items.push({
        sku: matchedSku,
        description: "Amazon Product",
        quantity: 1,
      });
    }
  }

  const hasMissingSku = items.length === 0;
  const missingSkuError = hasMissingSku
    ? "Label me SKU table ya code detect nahi ho paya. Kripya check karein ki SKU visible hai."
    : undefined;

  return {
    orderId,
    orderDate,
    awb,
    paymentType,
    customerName,
    destination,
    courier,
    items,
    hasMissingSku,
    missingSkuError,
  };
}

// -------------------------------------------------------------
// 4. GENERIC / FUTURE PLATFORM LABEL PARSER (UNIVERSAL FALLBACK)
// -------------------------------------------------------------
function parseGenericOrderBlock(blockText: string, knownSkus: string[] = []) {
  // 1. Order ID
  const orderIdMatch =
    blockText.match(/(?:Order\s*(?:Id|ID|No|Number|#)|Purchase\s*Order\s*No\.?)[:\s#]*([A-Za-z0-9-_]{6,30})/i) ||
    blockText.match(/\bOD\d{16,22}\b/) ||
    blockText.match(/\b\d{3}-[0-9]{7}-[0-9]{7}\b/) ||
    blockText.match(/\b\d{15,22}\b/);
  const orderId = orderIdMatch ? (orderIdMatch[1] || orderIdMatch[0]).trim() : null;

  // 2. Order Date
  const dateMatch =
    blockText.match(/(?:Order\s*Date|Invoice\s*Date|Date)[:\s]*([0-9]{2}[-/.][0-9]{2}[-/.][0-9]{2,4})/i) ||
    blockText.match(/\b([0-9]{2}[-/.][0-9]{2}[-/.][0-9]{2,4})\b/);
  const orderDate = dateMatch ? dateMatch[1].trim() : "";

  // 3. AWB / Tracking Number
  const awbMatch =
    blockText.match(/(?:AWB|Tracking\s*(?:No|Number|#)|Waybill)[:\s#]*([A-Za-z0-9]{8,25})/i) ||
    blockText.match(/\b(14\d{12,15})\b/) ||
    blockText.match(/\b(13\d{12})\b/) ||
    blockText.match(/\bFMP[A-Z0-9]{8,15}\b/);
  const awb = awbMatch ? (awbMatch[1] || awbMatch[0]).trim() : orderId || "N/A";

  // 4. Courier Logistics
  const courier = extractCourier(blockText);

  // 5. Customer Name
  let customerName = "";
  const custMatch =
    blockText.match(/(?:Ship\s*To|Deliver\s*To|Customer\s*Name|Buyer|Consignee)[:\s\n]+([^\n\r,]+)/i) ||
    blockText.match(/(?:Customer Address)[:\s\n]+([^\n\r,]+)/i);
  if (custMatch) {
    customerName = custMatch[1].trim().replace(/^[:\s-]+/, "");
  }

  // 6. Destination
  let destination = "";
  const pinMatch = blockText.match(/\b([1-9][0-9]{5})\b/);
  if (pinMatch) {
    destination = `PIN: ${pinMatch[1]}`;
  }

  // 7. Payment Type
  const isCod = /\bCOD\b|Cash on Delivery/i.test(blockText);
  const paymentType = isCod ? "COD" : "PREPAID";

  // 8. SKU and Quantity
  const items: { sku: string; description: string; quantity: number }[] = [];

  // Strategy 1: Explicit SKU label
  const skuLabelMatch = blockText.match(/(?:SKU|Item\s*Code|Product\s*Code)[:\s]*([A-Za-z0-9\-_\/]+)/i);
  if (skuLabelMatch) {
    const rawSku = skuLabelMatch[1].trim();
    const matched = findMatchingSku(rawSku, knownSkus);
    items.push({
      sku: matched || rawSku,
      description: "Product",
      quantity: 1,
    });
  }

  // Strategy 2: Direct Inventory Matching across block text
  if (items.length === 0) {
    const matchedSku = findMatchingSku(blockText, knownSkus);
    if (matchedSku) {
      const qMatch = blockText.match(/\b(?:Qty|Quantity)[:\s]*(\d+)\b/i);
      items.push({
        sku: matchedSku,
        description: "Product",
        quantity: qMatch ? parseInt(qMatch[1], 10) : 1,
      });
    }
  }

  const hasMissingSku = items.length === 0;
  const missingSkuError = hasMissingSku
    ? "Label me SKU code detect nahi ho paya. Kripya check karein ki SKU visible hai."
    : undefined;

  return {
    orderId: orderId || `ORD-${awb}`,
    orderDate,
    awb,
    paymentType,
    customerName,
    destination,
    courier,
    items,
    hasMissingSku,
    missingSkuError,
  };
}

// -------------------------------------------------------------
// POST HANDLER (SMART AUTO-DETECT: FLIPKART, MEESHO, AMAZON, OTHER)
// -------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No PDF file provided." }, { status: 400 });
    }

    // Convert file to Uint8Array for pdf-parse v2
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require("pdf-parse");
    const fontPath = path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts").replace(/\\/g, "/") + "/";
    const parser = new PDFParse({ data: uint8Array, standardFontDataUrl: fontPath });
    const doc = await parser.load();

    if (!doc || doc.numPages === 0) {
      return NextResponse.json(
        { success: false, error: "Empty or unreadable PDF. Please upload a valid shipping label PDF." },
        { status: 400 }
      );
    }

    // 1. EXTRACT ALL PAGE TEXT CONTENT FAST (DIGITAL TEXT FIRST)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas } = require("@napi-rs/canvas");

    const pageDataList: { pageNum: number; text: string; pageObj: any }[] = [];
    const CHUNK_SIZE = 25;
    for (let i = 1; i <= doc.numPages; i += CHUNK_SIZE) {
      const batchPromises = [];
      for (let p = i; p < i + CHUNK_SIZE && p <= doc.numPages; p++) {
        batchPromises.push(
          (async (pNum) => {
            const page = await doc.getPage(pNum);
            const tc = await page.getTextContent();
            const txt = tc.items.map((it: any) => it.str).join("\n").trim();
            return { pageNum: pNum, text: txt, pageObj: page };
          })(p)
        );
      }
      const results = await Promise.all(batchPromises);
      pageDataList.push(...results);
    }

    let combinedFullText = "";
    for (const p of pageDataList) {
      if (p.text.length > 20) combinedFullText += "\n" + p.text;
    }

    // 2. AUTO-DETECT MARKETPLACE (Amazon vs Meesho vs Flipkart vs Universal Other)
    const isAmazon = /amazon\.in|ASSPL-Amazon|\b\d{3}-\d{7}-\d{7}\b/i.test(combinedFullText);
    const isMeesho =
      /Prepaid:\s*Do not collect cash|COD:\s*Check the payable amount|Product Details[\s\S]*?Order No\.|Purchase Order No\.?\s*\d{15,20}|Meesho/i.test(
        combinedFullText
      );
    const isFlipkart = /OD\d{16,22}|FMP[A-Z0-9]{8,15}|E-Kart Logistics|Flipkart/i.test(combinedFullText);

    let channel: "AMAZON" | "MEESHO" | "FLIPKART" | "OTHER" = "OTHER";
    let channelLabel = "Other Platform";

    if (isAmazon) {
      channel = "AMAZON";
      channelLabel = "Amazon";
    } else if (isMeesho && !isFlipkart) {
      channel = "MEESHO";
      channelLabel = "Meesho";
    } else if (isFlipkart) {
      channel = "FLIPKART";
      channelLabel = "Flipkart";
    } else if (isMeesho) {
      channel = "MEESHO";
      channelLabel = "Meesho";
    } else {
      channel = "OTHER";
      channelLabel = "General / Other";
    }

    // 3. FETCH PRODUCTS & SKU MAPPINGS FOR MULTI-LISTING RESOLUTION
    const [allProducts, allMappings] = await Promise.all([
      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          sku: true,
          currentStock: true,
          costPrice: true,
        },
      }),
      prisma.skuMapping.findMany({
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              currentStock: true,
              costPrice: true,
            },
          },
        },
      }),
    ]);

    // Platform-Scoped SKU Mapping Lookup with Channel Prioritization
    // When channel is detected (e.g. MEESHO), filter out mappings belonging to other platforms (e.g. AMAZON).
    const relevantMappings = allMappings.filter((m) => {
      if (channel === "OTHER") return true;
      const plat = (m.platform || "ALL").toUpperCase();
      return plat === channel || plat === "ALL";
    });

    // Sort mappings so channel-specific takes precedence over "ALL"
    const sortedMappings = [...relevantMappings].sort((a, b) => {
      const aIsExact = (a.platform || "").toUpperCase() === channel ? 1 : 0;
      const bIsExact = (b.platform || "").toUpperCase() === channel ? 1 : 0;
      return aIsExact - bIsExact;
    });

    // Channel SKU Mapping Lookup (e.g. SCV-SSSPM-700-2 -> masterSku: Paneer Maker 700ML, multiplier: 1)
    const channelMappingMap = new Map<string, { masterSku: string; multiplier: number }>();
    for (const m of sortedMappings) {
      const clean = m.channelSku.toLowerCase().trim();
      const val = { masterSku: m.product.sku, multiplier: m.multiplier || 1 };
      channelMappingMap.set(clean, val);
      const norm = clean.replace(/[^A-Za-z0-9]/g, "");
      if (norm) {
        channelMappingMap.set(norm, val);
      }
    }

    // Known SKUs for parsing this specific label:
    // Only includes master product SKUs + channel-relevant listing SKUs.
    // Sorted by length descending so longer/more specific SKUs are tested first!
    const knownSkus = Array.from(
      new Set([
        ...allProducts.map((p) => p.sku),
        ...relevantMappings.map((m) => m.channelSku),
      ])
    ).sort((a, b) => b.length - a.length);

    const productBySkuMap = new Map<string, typeof allProducts[0]>();
    for (const prod of allProducts) {
      productBySkuMap.set(prod.sku.toLowerCase().trim(), prod);
    }

    // 4. PARSE ORDERS ACCORDING TO DETECTED MARKETPLACE
    let parsedOrders: (
      | ReturnType<typeof parseAmazonOrderBlock>
      | ReturnType<typeof parseMeeshoPage>
      | ReturnType<typeof parseFlipkartPage>
      | ReturnType<typeof parseGenericOrderBlock>
    )[] = [];

    if (channel === "AMAZON") {
      // Check if Amazon pairs: odd page (label image), even page (tax invoice digital text)
      const isAmazonPairs =
        doc.numPages >= 2 &&
        pageDataList[0].text.length < 30 &&
        /Tax Invoice|ASSPL-Amazon|Order Number/i.test(pageDataList[1]?.text || "");

      if (isAmazonPairs) {
        for (let i = 0; i < doc.numPages; i += 2) {
          const labelItem = pageDataList[i];
          const invoiceItem = i + 1 < doc.numPages ? pageDataList[i + 1] : null;

          // 1. Dynamic Barcode decode from label canvas (<15ms per page)
          let awb = "N/A";
          try {
            const vp = labelItem.pageObj.getViewport({ scale: 1.0 });
            const cvs = createCanvas(vp.width, vp.height);
            await labelItem.pageObj.render({ canvasContext: cvs.getContext("2d"), viewport: vp }).promise;

            const decoded = decodeDynamicBarcode(cvs, vp.width, vp.height);
            if (decoded) {
              awb = decoded;
            }
          } catch (e) {
            console.error("Barcode read error on page", i + 1, e);
          }

          // 2. Parse from invoice digital text
          const invText = invoiceItem ? invoiceItem.text : "";
          const ord = parseAmazonOrderBlock(invText, knownSkus);
          if (awb !== "N/A") {
            ord.awb = awb;
          }
          // Resolve accurate courier partner (Ground truth label text > AWB carrier series > Marketplace default)
          ord.courier = resolveCourier(labelItem.text || invText, ord.awb, "AMAZON");
          parsedOrders.push(ord);
        }
      } else {
        // Amazon non-paired or single pages
        for (let i = 0; i < pageDataList.length; i++) {
          const p = pageDataList[i];
          if (p.text.length >= 30) {
            const ord = parseAmazonOrderBlock(p.text, knownSkus);
            ord.courier = resolveCourier(p.text, ord.awb, "AMAZON");
            parsedOrders.push(ord);
          } else {
            try {
              const vp = p.pageObj.getViewport({ scale: 1.0 });
              const cvs = createCanvas(vp.width, vp.height);
              await p.pageObj.render({ canvasContext: cvs.getContext("2d"), viewport: vp }).promise;
              const decoded = decodeDynamicBarcode(cvs, vp.width, vp.height);
              const barcodeAwb = decoded || (pageDataList.length === 1 ? "AMAZON-1" : `AMAZON-${i + 1}`);
              const courier = resolveCourier(p.text, barcodeAwb, "AMAZON");
              parsedOrders.push({
                orderId: `ORD-${barcodeAwb}`,
                orderDate: "",
                awb: barcodeAwb,
                paymentType: "PREPAID",
                customerName: "",
                destination: "",
                courier,
                items: [],
                hasMissingSku: true,
                missingSkuError: "Label me SKU code detect nahi ho paya.",
              });
            } catch {
              // skip
            }
          }
        }
      }
    } else if (channel === "MEESHO") {
      parsedOrders = pageDataList
        .filter((p) => p.text.length > 20)
        .map((p) => {
          const ord = parseMeeshoPage(p.text, knownSkus);
          ord.courier = resolveCourier(p.text, ord.awb, "MEESHO");
          return ord;
        })
        .filter((o) => (o.orderId && o.orderId.length > 5) || o.items.length > 0);
    } else if (channel === "FLIPKART") {
      parsedOrders = pageDataList
        .filter((p) => p.text.length > 20)
        .map((p) => {
          const ord = parseFlipkartPage(p.text, knownSkus);
          ord.courier = resolveCourier(p.text, ord.awb, "FLIPKART");
          return ord;
        })
        .filter((o) => (o.orderId && o.orderId.length > 5) || o.items.length > 0);
    } else {
      for (const p of pageDataList) {
        if (p.text.length > 20) {
          const ord = parseGenericOrderBlock(p.text, knownSkus);
          ord.courier = resolveCourier(p.text, ord.awb, "OTHER");
          parsedOrders.push(ord);
        } else {
          try {
            const vp = p.pageObj.getViewport({ scale: 1.0 });
            const cvs = createCanvas(vp.width, vp.height);
            await p.pageObj.render({ canvasContext: cvs.getContext("2d"), viewport: vp }).promise;
            const decoded = decodeDynamicBarcode(cvs, vp.width, vp.height);
            if (decoded) {
              const courier = resolveCourier(p.text, decoded, "OTHER");
              parsedOrders.push({
                orderId: `ORD-${decoded}`,
                orderDate: "",
                awb: decoded,
                paymentType: "PREPAID",
                customerName: "",
                destination: "",
                courier,
                items: [],
                hasMissingSku: true,
                missingSkuError: "Label me SKU code detect nahi ho paya.",
              });
            }
          } catch {}
        }
      }
    }

    // Deduplicate orders by unique Order ID / AWB (keeps richest order if duplicate pages exist)
    const dedupedOrders: typeof parsedOrders = [];
    const seenOrderKeys = new Set<string>();

    for (const ord of parsedOrders) {
      const key =
        ord.awb && ord.awb !== "N/A"
          ? `AWB:${ord.awb.toUpperCase()}`
          : ord.orderId && !ord.orderId.startsWith("ORDER-") && !ord.orderId.startsWith("MEESHO-")
          ? `ORD:${ord.orderId.toUpperCase()}`
          : null;

      if (!key) {
        dedupedOrders.push(ord);
        continue;
      }

      if (!seenOrderKeys.has(key)) {
        seenOrderKeys.add(key);
        dedupedOrders.push(ord);
      } else {
        const existingIdx = dedupedOrders.findIndex(
          (o) =>
            (o.awb && `AWB:${o.awb.toUpperCase()}` === key) ||
            (o.orderId && `ORD:${o.orderId.toUpperCase()}` === key)
        );
        if (existingIdx !== -1 && dedupedOrders[existingIdx].items.length === 0 && ord.items.length > 0) {
          dedupedOrders[existingIdx] = ord;
        }
      }
    }
    parsedOrders = dedupedOrders;

    if (parsedOrders.length === 0) {
      return NextResponse.json(
        { success: false, error: "No recognizable shipping labels or invoices found in this PDF." },
        { status: 400 }
      );
    }

    // 4.5 CHECK FOR DUPLICATE DISPATCH (ORDERS ALREADY DISPATCHED)
    const awbsToCheck = Array.from(
      new Set(
        parsedOrders
          .map((o) => o.awb?.trim())
          .filter((a): a is string => Boolean(a && a !== "N/A" && a.length > 3))
      )
    );
    const orderIdsToCheck = Array.from(
      new Set(
        parsedOrders
          .map((o) => o.orderId?.trim())
          .filter((id): id is string => Boolean(id && !id.startsWith("ORDER-") && id.length > 3))
      )
    );

    const existingDispatched =
      awbsToCheck.length > 0 || orderIdsToCheck.length > 0
        ? await prisma.dispatchedOrder.findMany({
            where: {
              status: { not: "CANCELLED" },
              OR: [
                ...(awbsToCheck.length > 0 ? [{ awb: { in: awbsToCheck } }] : []),
                ...(orderIdsToCheck.length > 0 ? [{ orderId: { in: orderIdsToCheck } }] : []),
              ],
            },
            select: {
              id: true,
              orderId: true,
              awb: true,
              dispatchedAt: true,
              createdAt: true,
              status: true,
              batch: {
                select: {
                  fileName: true,
                  createdAt: true,
                },
              },
            },
          })
        : [];

    const duplicateByAwb = new Map<string, (typeof existingDispatched)[0]>();
    const duplicateByOrderId = new Map<string, (typeof existingDispatched)[0]>();

    for (const row of existingDispatched) {
      if (row.awb && row.awb !== "N/A") {
        duplicateByAwb.set(row.awb.toLowerCase().trim(), row);
      }
      if (row.orderId && !row.orderId.startsWith("ORDER-")) {
        duplicateByOrderId.set(row.orderId.toLowerCase().trim(), row);
      }
    }

    // 5. AGGREGATE SKU SUMMARY & ENRICH ORDERS
    const skuSummaryMap = new Map<
      string,
      {
        sku: string;
        name: string;
        totalQuantity: number;
        duplicateQuantity: number;
        currentStock: number;
        afterStock: number;
        productId: string | null;
        found: boolean;
      }
    >();

    const enrichedOrders = parsedOrders.map((order, idx) => {
      const cleanAwb = order.awb && order.awb !== "N/A" ? order.awb.toLowerCase().trim() : null;
      const cleanOrdId =
        order.orderId && !order.orderId.startsWith("ORDER-")
          ? order.orderId.toLowerCase().trim()
          : null;
      const duplicateRecord =
        (cleanAwb ? duplicateByAwb.get(cleanAwb) : null) ||
        (cleanOrdId ? duplicateByOrderId.get(cleanOrdId) : null);

      const isAlreadyDispatched = Boolean(duplicateRecord);
      const duplicateDispatchedAt = duplicateRecord
        ? (duplicateRecord.dispatchedAt || duplicateRecord.createdAt).toISOString()
        : null;
      const duplicateBatchFileName = duplicateRecord?.batch?.fileName || null;

      const enrichedItems = order.items.map((item) => {
        // 1. Resolve through SkuMapping lookup (Multi-listing support)
        const cleanSku = item.sku.toLowerCase().trim();
        const normSku = cleanSku.replace(/[^A-Za-z0-9]/g, "");
        const mapped = channelMappingMap.get(cleanSku) || channelMappingMap.get(normSku);

        const targetSku = mapped ? mapped.masterSku : item.sku;
        const finalQuantity = mapped ? item.quantity * mapped.multiplier : item.quantity;

        const matchedProduct = productBySkuMap.get(targetSku.toLowerCase().trim());
        const found = !!matchedProduct;

        const existing = skuSummaryMap.get(targetSku) || {
          sku: targetSku,
          name: matchedProduct ? matchedProduct.name : item.description,
          totalQuantity: 0,
          duplicateQuantity: 0,
          currentStock: matchedProduct ? matchedProduct.currentStock : 0,
          afterStock: matchedProduct ? matchedProduct.currentStock : 0,
          productId: matchedProduct ? matchedProduct.id : null,
          found,
        };

        if (isAlreadyDispatched) {
          existing.duplicateQuantity += finalQuantity;
        } else {
          existing.totalQuantity += finalQuantity;
          if (matchedProduct) {
            existing.afterStock = existing.currentStock - existing.totalQuantity;
          }
        }
        skuSummaryMap.set(targetSku, existing);

        return {
          sku: targetSku,
          originalSku: item.sku !== targetSku ? item.sku : undefined,
          description: item.description,
          quantity: finalQuantity,
          productId: matchedProduct?.id || null,
          productName: matchedProduct?.name || item.description,
          currentStock: matchedProduct?.currentStock ?? null,
          found,
        };
      });

      return {
        id: `label-${idx + 1}`,
        orderId: order.orderId || `ORDER-${idx + 1}`,
        orderDate: order.orderDate || "",
        awb: order.awb || "N/A",
        paymentType: order.paymentType,
        customerName: order.customerName,
        destination: order.destination,
        courier: order.courier, // Dynamically extracted directly from label!
        hasMissingSku: order.hasMissingSku ?? order.items.length === 0,
        missingSkuError: order.missingSkuError,
        items: enrichedItems,
        isAlreadyDispatched,
        dispatchedAt: duplicateDispatchedAt,
        duplicateBatchFileName,
      };
    });

    const skuSummary = Array.from(skuSummaryMap.values());
    const totalOrders = enrichedOrders.length;
    const totalUnits = skuSummary.reduce((sum, s) => sum + s.totalQuantity, 0);
    const duplicateOrdersCount = enrichedOrders.filter((o) => o.isAlreadyDispatched).length;
    const allOrdersDuplicate = duplicateOrdersCount === totalOrders && totalOrders > 0;
    const unreadOrdersCount = enrichedOrders.filter((o) => o.items.length === 0).length;
    const allSkusFound =
      skuSummary.length > 0 &&
      skuSummary.every((s) => s.found) &&
      unreadOrdersCount === 0;

    return NextResponse.json({
      success: true,
      data: {
        channel,
        channelLabel,
        totalOrders,
        totalUnits,
        duplicateOrdersCount,
        allOrdersDuplicate,
        allSkusFound,
        unreadOrdersCount,
        skuSummary,
        orders: enrichedOrders,
        availableProducts: allProducts.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          currentStock: p.currentStock,
        })),
      },
    });
  } catch (error: any) {
    console.error("PDF Parsing Server Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to parse shipping labels PDF." },
      { status: 500 }
    );
  }
}
