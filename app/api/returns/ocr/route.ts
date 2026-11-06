import { NextRequest, NextResponse } from "next/server";
import { createWorker } from "tesseract.js";
import path from "path";
import sharp from "sharp";
import prisma from "@/lib/prisma";
import { lookupReturnOrder } from "@/app/actions/returns";

export const runtime = "nodejs";

// Cache worker instance to eliminate cold-start lag on repeated scans
let workerPromise: Promise<any> | null = null;

async function getTesseractWorker() {
  if (!workerPromise) {
    const workerPath = path.join(
      process.cwd(),
      "node_modules",
      "tesseract.js",
      "src",
      "worker-script",
      "node",
      "index.js"
    );
    workerPromise = createWorker("eng", 1, {
      workerPath,
    }).catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

function extractCandidates(text: string): string[] {
  if (!text) return [];
  const candidates: string[] = [];

  // 1. Amazon Order ID: 3 digits - 7 digits - 7 digits (e.g. 405-6052264-6554764)
  const amazonMatches = text.matchAll(/\b(\d{3})\s*[-–—.]\s*(\d{7})\s*[-–—.]\s*(\d{7})\b/g);
  for (const m of amazonMatches) {
    const id = `${m[1]}-${m[2]}-${m[3]}`;
    if (!candidates.includes(id)) candidates.push(id);
  }

  // 1b. Amazon with common OCR letter confusion (O/o->0, I/l->1)
  const fuzzyAmazon = text.matchAll(/\b([0-9OIl]{3})\s*[-–—.]\s*([0-9OIl]{7})\s*[-–—.]\s*([0-9OIl]{7})\b/g);
  for (const m of fuzzyAmazon) {
    const id = `${m[1]}-${m[2]}-${m[3]}`
      .replace(/[Oo]/g, "0")
      .replace(/[Il]/g, "1");
    if (!candidates.includes(id)) candidates.push(id);
  }

  // 2. Flipkart Order ID: Starts with OD followed by 14-22 digits
  const flipkartMatches = text.matchAll(/\b(OD\s*[0-9OIl]{14,22})\b/gi);
  for (const m of flipkartMatches) {
    const id = m[1].replace(/\s+/g, "").replace(/[Oo]/g, "0").replace(/[Il]/g, "1").toUpperCase();
    if (!candidates.includes(id)) candidates.push(id);
  }

  // 3. Meesho Order ID: 16 to 20 digits followed by optional _1 or _2
  const meeshoMatches = text.matchAll(/\b(\d{16,20}(?:_\d+)?)\b/g);
  for (const m of meeshoMatches) {
    if (!candidates.includes(m[1])) candidates.push(m[1]);
  }

  // 4. Labeled Order ID detection: "Order Id: XYZ" or "Order No: XYZ" (supports underscores)
  const labelMatches = text.matchAll(/(?:Order\s*(?:Id|No|Number|#)[\s.:;=\-]+)([A-Za-z0-9\-_]+)/gi);
  for (const m of labelMatches) {
    const raw = m[1].trim();
    if (raw.length >= 8 && !candidates.includes(raw)) candidates.push(raw);
  }

  // 5. Courier AWB labeled or 14-16 digit barcode numbers (e.g. Delhivery 1490842564913030)
  const awbMatches = text.matchAll(/(?:AWB[\s:#-]+)(\d{9,18})/gi);
  for (const m of awbMatches) {
    const raw = m[1].trim();
    if (!candidates.includes(raw)) candidates.push(raw);
  }
  const delhiveryMatches = text.matchAll(/\b(14\d{12,16})\b/g);
  for (const m of delhiveryMatches) {
    if (!candidates.includes(m[1])) candidates.push(m[1]);
  }

  // 6. If any candidate has a suffix like _1, also push the base ID as fallback candidate
  const additionalBaseCandidates: string[] = [];
  for (const c of candidates) {
    const base = c.replace(/[_\-\.][0-9a-zA-Z]+$/, "").trim();
    if (base && base !== c && !candidates.includes(base) && !additionalBaseCandidates.includes(base)) {
      additionalBaseCandidates.push(base);
    }
  }
  candidates.push(...additionalBaseCandidates);

  return candidates;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image } = body;

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { success: false, error: "Image data is required for OCR scanning." },
        { status: 400 }
      );
    }

    // Convert base64 data URL to buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const rawBuffer = Buffer.from(base64Data, "base64");

    // Preprocess image with sharp for optimal OCR contrast and edge sharpness
    let processedBuffer = rawBuffer;
    try {
      const meta = await sharp(rawBuffer).metadata();
      const width = meta.width || 800;
      let pipeline = sharp(rawBuffer);
      if (width < 1200) {
        pipeline = pipeline.resize(Math.round(width * 1.5));
      }
      processedBuffer = await pipeline
        .grayscale()
        .normalize()
        .sharpen()
        .toBuffer();
    } catch {
      // Fallback to raw buffer if sharp fails on corrupt payload
      processedBuffer = rawBuffer;
    }

    const worker = await getTesseractWorker();
    const { data } = await worker.recognize(processedBuffer);
    const rawText = data.text || "";

    const candidates = extractCandidates(rawText);

    if (candidates.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Order ID text detect nahi hua. Camera ko 'Order Id: ...' text ke bilkul samne rakhein.",
        rawText: rawText.slice(0, 300),
      });
    }

    // 1. Try exact match in DB for any candidate
    for (const candidate of candidates) {
      const lookup = await lookupReturnOrder(candidate);
      if (lookup.success && lookup.order) {
        return NextResponse.json({
          success: true,
          orderId: lookup.order.orderId,
          lookup,
          rawText: rawText.slice(0, 300),
        });
      }
    }

    // 2. Fuzzy fallback: If candidate is Amazon format (e.g. 405-6082264-6551764)
    // and OCR had 1-2 slightly blurred digits, match against active DispatchedOrders
    for (const candidate of candidates) {
      const parts = candidate.split("-");
      if (parts.length === 3 && parts[0].length === 3 && parts[1].length === 7) {
        const potentialOrders = await prisma.dispatchedOrder.findMany({
          where: {
            channel: "AMAZON",
            OR: [
              { orderId: { startsWith: `${parts[0]}-` } },
              { orderId: { contains: parts[1] } },
              { orderId: { contains: parts[2] } },
            ],
          },
          take: 5,
        });

        for (const po of potentialOrders) {
          // Compare Levenshtein distance on the 17-digit pattern
          const diffs = [...po.orderId].filter((ch, i) => ch !== candidate[i]).length;
          if (diffs <= 3) {
            // Highly confident match!
            const lookup = await lookupReturnOrder(po.orderId);
            return NextResponse.json({
              success: true,
              orderId: po.orderId,
              lookup,
              fuzzyCorrectedFrom: candidate,
              rawText: rawText.slice(0, 300),
            });
          }
        }
      }
    }

    // 3. Fallback: Return first candidate if not yet in dispatched database
    const primaryCandidate = candidates[0];
    const lookup = await lookupReturnOrder(primaryCandidate);

    return NextResponse.json({
      success: true,
      orderId: primaryCandidate,
      lookup,
      rawText: rawText.slice(0, 300),
    });
  } catch (error: any) {
    console.error("Returns OCR Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process text OCR." },
      { status: 500 }
    );
  }
}

