import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

// -------------------------------------------------------------
// DYNAMIC COURIER LOGISTICS DETECTOR (ZERO HARDCODING)
// -------------------------------------------------------------
function extractCourier(text: string): string {
  if (!text) return "";

  // 1. Check known carrier names (case-insensitive)
  if (/\bdelhivery\b/i.test(text)) return "DELHIVERY";
  if (/\b(atspl|ats|amazon\s*transportation|easy\s*ship)\b/i.test(text)) return "ATSPL";
  if (/\b(e-?kart\s*logistics|e-?kart)\b/i.test(text)) return "E-Kart Logistics";
  if (/\b(blue\s*dart|bluedart)\b/i.test(text)) return "Blue Dart";
  if (/\bshadowfax\b/i.test(text)) return "Shadowfax";
  if (/\bxpressbees\b/i.test(text)) return "Xpressbees";
  if (/\bvalmo\b/i.test(text)) return "Valmo";
  if (/\bdtdc\b/i.test(text)) return "DTDC";
  if (/\b(india\s*post|speed\s*post)\b/i.test(text)) return "India Post";
  if (/\bfedex\b/i.test(text)) return "FedEx";

  // 2. Generic carrier label detection
  const labelMatch = text.match(
    /(?:Courier|Carrier|Logistics|Delivery Partner|Delivered By)[:\s]+([A-Za-z0-9\s\-]+?)(?=\n|\r|,|$)/i
  );
  if (labelMatch) {
    const raw = labelMatch[1].trim();
    if (raw.length >= 3 && raw.length <= 25) {
      return raw.toUpperCase();
    }
  }

  // Never return a hardcoded fake courier!
  return "";
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
// INTELLIGENT SKU RESOLVER (EXACT + NORMALIZED + OCR NOISE TOLERANT)
// -------------------------------------------------------------
function findMatchingSku(text: string, knownSkus: string[]): string | null {
  if (!text || !knownSkus || knownSkus.length === 0) return null;

  // 1. Exact word-boundary match
  for (const kSku of knownSkus) {
    const escaped = kSku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exactRegex = new RegExp("\\b" + escaped + "\\b", "i");
    if (exactRegex.test(text)) return kSku;
  }

  // 2. Normalized alphanumeric match (removes spaces, hyphens)
  const normText = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  for (const kSku of knownSkus) {
    const normSku = kSku.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (normText.includes(normSku)) return kSku;
  }

  // 3. Substring & Token LCS Fuzzy Match (handles OCR noise like M<->IT, 7<->0, C<->O, spaced digits)
  const rawTokens = text.match(/\b[A-Za-z0-9\-]{3,25}\b/g) || [];
  const tokens: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const clean = rawTokens[i].replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    tokens.push(clean);
    if (i + 1 < rawTokens.length) {
      const nextClean = rawTokens[i + 1].replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      tokens.push(clean + nextClean);
    }
  }

  let bestSku: string | null = null;
  let bestScore = 0;

  for (const tok of tokens) {
    if (tok.length < 5) continue;
    for (const kSku of knownSkus) {
      const normSku = kSku.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      const common = lcs(tok, normSku);
      const ratio = common / Math.max(tok.length, normSku.length);
      if (ratio > bestScore && ratio >= 0.58) {
        bestScore = ratio;
        bestSku = kSku;
      }
    }
  }

  return bestSku;
}

// -------------------------------------------------------------
// DYNAMIC MULTI-ORDER BLOCK SPLITTER (GRID & SUB-LABEL SUPPORT)
// -------------------------------------------------------------
function splitMultipleOrdersInBlock(text: string): string[] {
  if (!text || text.length < 80) return [text];

  const meeshoPoMatches = [...text.matchAll(/Purchase Order No\.?\s*\d{15,20}/gi)];
  const fkMatches = [...text.matchAll(/\bOD\d{16,22}\b/g)];
  const amzMatches = [...text.matchAll(/\b\d{3}-[0-9]{7}-[0-9]{7}\b/g)];
  const delAwbMatches = [...text.matchAll(/\b14\d{13,15}\b/g)];

  const maxMatches = Math.max(
    meeshoPoMatches.length,
    fkMatches.length,
    amzMatches.length,
    delAwbMatches.length > 1 ? delAwbMatches.length : 0
  );

  if (maxMatches > 1) {
    const delimiterRegex =
      /(?=Purchase Order No\.?\s*\d{15,20}|Customer Address|OD\d{16,22}|Order\s*Id[:\s]*\d{3}-\d{7}-\d{7}|\b14\d{13,15}\b)/i;
    const parts = text
      .split(delimiterRegex)
      .map((p) => p.trim())
      .filter((p) => p.length > 60 && /(?:AWB|Order|SKU|Delhivery|Logistics|Prepaid|COD|Customer|Ship)/i.test(p));
    if (parts.length > 1) {
      return parts;
    }
  }

  return [text];
}

// -------------------------------------------------------------
// DYNAMIC MULTI-LABEL PAGE EXTRACTOR (A4 SHEETS & IMAGE LABELS)
// -------------------------------------------------------------
async function extractPageLabels(page: any, pageNum: number): Promise<string[]> {
  try {
    const tc = await page.getTextContent();
    const pageText = tc.items.map((it: any) => it.str).join("\n").trim();

    // 1. DIGITAL TEXT PATH
    if (pageText.length >= 60) {
      const splitOrders = splitMultipleOrdersInBlock(pageText);
      if (splitOrders.length > 1) {
        return splitOrders;
      }
      return [pageText];
    }

    // 2. IMAGE / FLATTENED VECTOR DRAWING PATH (e.g. Print-to-PDF, Scanned labels)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas } = require("@napi-rs/canvas");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = require("os");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execFileSync } = require("child_process");

    const viewport = page.getViewport({ scale: 2.8 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Check if aspect ratio is A4 sheet (e.g. height >= 1000px, width >= 700px)
    const isA4Sheet = viewport.height >= 1000 && viewport.width >= 700;

    if (isA4Sheet) {
      const qw = Math.floor(canvas.width / 2);
      const qh = Math.floor(canvas.height / 2);

      const quadrants = [
        { name: "TL", x: 0, y: 0 },
        { name: "TR", x: qw, y: 0 },
        { name: "BL", x: 0, y: qh },
        { name: "BR", x: qw, y: qh },
      ];

      const tmpFiles: string[] = [];
      quadrants.forEach((q, idx) => {
        const qc = createCanvas(qw, qh);
        const qctx = qc.getContext("2d");
        qctx.drawImage(canvas, q.x, q.y, qw, qh, 0, 0, qw, qh);
        const tmp = path.join(
          os.tmpdir(),
          `quad_${Date.now()}_p${pageNum}_${idx}_${Math.random().toString(36).substring(7)}.png`
        );
        fs.writeFileSync(tmp, qc.toBuffer("image/png"));
        tmpFiles.push(tmp);
      });

      const workerScript = path.join(process.cwd(), "lib", "ocrWorker.js");
      let results: { file: string; success: boolean; text: string }[] = [];
      try {
        const resJsonStr = execFileSync("node", [workerScript, ...tmpFiles], {
          timeout: 45000,
          encoding: "utf8",
        });
        const parsed = JSON.parse(resJsonStr);
        results = parsed.results || [];
      } catch (ocrErr) {
        console.error("Batch OCR worker error:", ocrErr);
      } finally {
        tmpFiles.forEach((f) => {
          try {
            fs.unlinkSync(f);
          } catch {}
        });
      }

      // Filter out empty quadrants (keeps only valid shipping labels)
      const validTexts: string[] = [];
      for (const r of results) {
        const txt = (r.text || "").trim();
        if (
          txt.length > 80 &&
          /(?:AWB|Order|SKU|Delhivery|Logistics|Prepaid|COD|Customer|Ship|Return Code|Product Details)/i.test(txt)
        ) {
          validTexts.push(txt);
        }
      }

      if (validTexts.length > 0) {
        const finalExtracted: string[] = [];
        for (const vt of validTexts) {
          const subOrders = splitMultipleOrdersInBlock(vt);
          finalExtracted.push(...subOrders);
        }
        return finalExtracted;
      }
    }

    // 3. Single full page OCR fallback (e.g. 4x6 thermal label)
    const fullTmp = path.join(
      os.tmpdir(),
      `single_page_${Date.now()}_p${pageNum}_${Math.random().toString(36).substring(7)}.png`
    );
    fs.writeFileSync(fullTmp, canvas.toBuffer("image/png"));
    const workerScript = path.join(process.cwd(), "lib", "ocrWorker.js");
    let fullText = "";
    try {
      const resJsonStr = execFileSync("node", [workerScript, fullTmp], {
        timeout: 30000,
        encoding: "utf8",
      });
      const parsed = JSON.parse(resJsonStr);
      fullText = parsed.text || "";
    } catch (err) {
      console.error("Full page OCR error:", err);
    } finally {
      try {
        fs.unlinkSync(fullTmp);
      } catch {}
    }

    return fullText.length > 30 ? splitMultipleOrdersInBlock(fullText) : [];
  } catch (err) {
    console.error(`Error processing page ${pageNum}:`, err);
    return [];
  }
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
    for (const kSku of knownSkus) {
      const escaped = kSku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const skuRegex = new RegExp("\\b" + escaped + "\\b", "i");
      if (skuRegex.test(pageText)) {
        items.push({
          sku: kSku,
          description: "Flipkart Product",
          quantity: 1,
        });
        break;
      }
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
        orderId = rawOrder.split("_")[0].trim();
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
            orderId = m[5].split("_")[0].trim();
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
      pageText.match(/Purchase Order No\.?\s*([0-9_]+)/i) ||
      pageText.match(/Order\s*No\.?[\s\S]*?(\d{15,22})/i) ||
      pageText.match(/\b(34\d{16})\b/);
    if (poMatch) orderId = (poMatch[1] || poMatch[0]).split("_")[0].trim();
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

  // 3. Real AWB Tracking Number from Label (e.g. AWB# 13371887426321)
  const awbMatch =
    combinedText.match(/AWB[#:\s]*([0-9A-Za-z]+)/i) ||
    combinedText.match(/\b(13\d{12})\b/) ||
    combinedText.match(/\b(37\d{10})\b/);
  const awb = awbMatch ? awbMatch[1].trim() : orderId || "N/A";

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
  const shipAddrMatch = combinedText.match(/Shipping Address\s*:?[\s\S]*?(?=Place of supply|Place of delivery|Invoice Number|$)/i);
  if (shipAddrMatch) {
    const pinMatch = shipAddrMatch[0].match(/([A-Za-z\s]+),\s*([A-Za-z\s]+),\s*(\d{6})/);
    if (pinMatch) {
      const cleanCity = pinMatch[1].replace(/\n/g, " ").trim();
      destination = `${cleanCity}, ${pinMatch[2].trim()} (${pinMatch[3]})`;
    }
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
    for (const kSku of knownSkus) {
      const escaped = kSku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const skuRegex = new RegExp("\\b" + escaped + "\\b", "i");
      if (skuRegex.test(combinedText)) {
        items.push({
          sku: kSku,
          description: "Amazon Product",
          quantity: 1,
        });
        break;
      }
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
    const parser = new PDFParse(uint8Array);
    const doc = await parser.load();

    if (!doc || doc.numPages === 0) {
      return NextResponse.json(
        { success: false, error: "Empty or unreadable PDF. Please upload a valid shipping label PDF." },
        { status: 400 }
      );
    }

    // 1. EXTRACT ALL SHIPPING LABELS ACROSS PAGES (WITH DYNAMIC GRID SPLITTING & OCR)
    const labelTexts: string[] = [];
    let combinedFullText = "";

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const extractedLabels = await extractPageLabels(page, i);
      for (const lbl of extractedLabels) {
        const clean = lbl.trim();
        if (clean.length > 30) {
          labelTexts.push(clean);
          combinedFullText += "\n" + clean;
        }
      }
    }

    if (labelTexts.length === 0 || combinedFullText.length < 30) {
      return NextResponse.json(
        { success: false, error: "Unable to read contents from this PDF. Please check file format." },
        { status: 400 }
      );
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

    // 3. FETCH PRODUCTS FOR DYNAMIC SKU MATCHING & SAFETY FALLBACK
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        costPrice: true,
      },
    });

    const knownSkus = allProducts.map((p) => p.sku);
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
      // Group Amazon Shipping Label (Page 1) and Tax Invoice (Page 2) by Order ID
      const amazonOrdersMap = new Map<string, string>();

      for (const pt of labelTexts) {
        const orderMatch =
          pt.match(/Order\s*(?:Id|Number)[:\s]*([0-9]{3}-[0-9]{7}-[0-9]{7})/i) ||
          pt.match(/\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b/);

        const orderId = orderMatch ? orderMatch[1].trim() : `AMAZON-${amazonOrdersMap.size + 1}`;
        const prev = amazonOrdersMap.get(orderId) || "";
        amazonOrdersMap.set(orderId, prev + "\n\n" + pt);
      }

      parsedOrders = Array.from(amazonOrdersMap.values())
        .map((combinedText) => parseAmazonOrderBlock(combinedText, knownSkus))
        .filter((o) => (o.orderId && o.orderId.length > 5) || o.items.length > 0);
    } else if (channel === "MEESHO") {
      parsedOrders = labelTexts
        .map((pt) => parseMeeshoPage(pt, knownSkus))
        .filter((o) => (o.orderId && o.orderId.length > 5) || o.items.length > 0);
    } else if (channel === "FLIPKART") {
      parsedOrders = labelTexts
        .map((pt) => parseFlipkartPage(pt, knownSkus))
        .filter((o) => (o.orderId && o.orderId.length > 5) || o.items.length > 0);
    } else {
      parsedOrders = labelTexts
        .map((pt) => parseGenericOrderBlock(pt, knownSkus))
        .filter((o) => (o.orderId && o.orderId.length > 5) || o.items.length > 0);
    }

    if (parsedOrders.length === 0) {
      return NextResponse.json(
        { success: false, error: "No recognizable shipping labels or invoices found in this PDF." },
        { status: 400 }
      );
    }

    // 5. AGGREGATE SKU SUMMARY & ENRICH ORDERS
    const skuSummaryMap = new Map<
      string,
      {
        sku: string;
        name: string;
        totalQuantity: number;
        currentStock: number;
        afterStock: number;
        productId: string | null;
        found: boolean;
      }
    >();

    const enrichedOrders = parsedOrders.map((order, idx) => {
      const enrichedItems = order.items.map((item) => {
        const matchedProduct = productBySkuMap.get(item.sku.toLowerCase().trim());
        const found = !!matchedProduct;

        const existing = skuSummaryMap.get(item.sku) || {
          sku: item.sku,
          name: matchedProduct ? matchedProduct.name : item.description,
          totalQuantity: 0,
          currentStock: matchedProduct ? matchedProduct.currentStock : 0,
          afterStock: matchedProduct ? matchedProduct.currentStock : 0,
          productId: matchedProduct ? matchedProduct.id : null,
          found,
        };

        existing.totalQuantity += item.quantity;
        if (matchedProduct) {
          existing.afterStock = existing.currentStock - existing.totalQuantity;
        }
        skuSummaryMap.set(item.sku, existing);

        return {
          ...item,
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
      };
    });

    const skuSummary = Array.from(skuSummaryMap.values());
    const totalOrders = enrichedOrders.length;
    const totalUnits = skuSummary.reduce((sum, s) => sum + s.totalQuantity, 0);
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
        allSkusFound,
        unreadOrdersCount,
        skuSummary,
        orders: enrichedOrders,
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
