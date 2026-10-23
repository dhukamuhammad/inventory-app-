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

// Function to parse text from an individual Flipkart label page
function parseFlipkartPageText(pageText: string) {
  // 1. Order ID (e.g. OD438942197193229100)
  const orderIdMatch = pageText.match(/OD\d{16,22}/);
  const orderId = orderIdMatch ? orderIdMatch[0] : null;

  // 2. AWB Tracking Number (e.g. FMPC6661184765 or FMPP4401424272)
  const awbMatch = pageText.match(/FMP[A-Z0-9]{8,15}/i) || pageText.match(/AWB No\.?\s*([A-Z0-9]+)/i);
  const awb = awbMatch ? (awbMatch[1] || awbMatch[0]).trim() : null;

  // 3. Payment Mode (COD vs PREPAID)
  const paymentMatch = pageText.match(/\b(COD|PREPAID)\b/i);
  const paymentType = paymentMatch ? paymentMatch[1].toUpperCase() : "PREPAID";

  // 4. Customer Name
  const customerMatch = pageText.match(/Shipping\/Customer address:\s*Name:\s*([^,\n\r]+)/i);
  const customerName = customerMatch ? customerMatch[1].trim() : "";

  // 5. Destination City & Pincode
  const pinMatch = pageText.match(/([A-Za-z\s]+)\s*-\s*(\d{6}),\s*([A-Z\-]+)/);
  const destination = pinMatch ? pinMatch[0].trim() : "";

  // 6. Courier Logistics
  const courierMatch = pageText.match(/(E-Kart Logistics|Delhivery|Shadowfax|Xpressbees|Bluedart)/i);
  const courier = courierMatch ? courierMatch[1] : "E-Kart Logistics";

  // 7. Extract SKU items from the label table
  const items: { sku: string; description: string; quantity: number }[] = [];

  // Match section between "SKU ID | Description" and either "Tax Invoice" or "FMP"
  const skuSectionMatch = pageText.match(/SKU ID \| Description[\s\S]*?(?=Tax Invoice|FMP|Not for resale)/i);
  if (skuSectionMatch) {
    const lines = skuSectionMatch[0].split("\n");
    for (const line of lines) {
      // Row pattern: 1 SCV-SSPM-550 | ScoviX 700 ml Paneer Maker Strainer PMS 1
      const rowMatch = line.match(/^\s*\d+\s+([A-Za-z0-9\-_\/]+)\s*\|\s*(.+?)\s+(\d+)\s*$/);
      if (rowMatch) {
        items.push({
          sku: rowMatch[1].trim(),
          description: rowMatch[2].trim(),
          quantity: parseInt(rowMatch[3], 10) || 1,
        });
      }
    }
  }

  // Fallback: If SKU table had atypical wrapping, extract from lower invoice section
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

  return {
    orderId,
    awb,
    paymentType,
    customerName,
    destination,
    courier,
    items,
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No PDF file provided." }, { status: 400 });
    }

    // Convert file to ArrayBuffer then Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Require PDFParse from pdf-parse library
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse(uint8Array);
    const parsedPdf = await parser.getText();
    const fullText = parsedPdf.text || "";

    // Split text into individual pages
    // Flipkart multi-page PDFs separate pages with "-- X of Y --"
    let rawPages = fullText.split(/-- \d+ of \d+ --/);
    if (rawPages.length <= 1) {
      // Fallback split by E-Kart / Flipkart label header
      rawPages = fullText.split(/(?=E-Kart Logistics|OD\d{16,22})/i);
    }

    const validPageTexts = rawPages.map((p: string) => p.trim()).filter((p: string) => p.length > 80);

    if (validPageTexts.length === 0) {
      return NextResponse.json(
        { success: false, error: "No recognizable Flipkart shipping labels found in this PDF." },
        { status: 400 }
      );
    }

    // Parse each label page
    const parsedOrders = validPageTexts.map(parseFlipkartPageText).filter((o: any) => o.orderId || o.awb || o.items.length > 0);

    // Fetch all active products in inventory to map SKUs
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        costPrice: true,
      },
    });

    // Create SKU lookup map (case-insensitive)
    const productBySkuMap = new Map<string, typeof allProducts[0]>();
    for (const prod of allProducts) {
      productBySkuMap.set(prod.sku.toLowerCase().trim(), prod);
    }

    // Aggregate summary of SKUs needed
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

    const enrichedOrders = parsedOrders.map((order: any, idx: number) => {
      const enrichedItems = order.items.map((item: any) => {
        const matchedProduct = productBySkuMap.get(item.sku.toLowerCase().trim());
        const found = !!matchedProduct;

        // Update summary
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
        awb: order.awb || "N/A",
        paymentType: order.paymentType,
        customerName: order.customerName,
        destination: order.destination,
        courier: order.courier,
        items: enrichedItems,
      };
    });

    const skuSummary = Array.from(skuSummaryMap.values());
    const totalOrders = enrichedOrders.length;
    const totalUnits = skuSummary.reduce((sum, s) => sum + s.totalQuantity, 0);
    const allSkusFound = skuSummary.every((s) => s.found);

    return NextResponse.json({
      success: true,
      data: {
        totalOrders,
        totalUnits,
        allSkusFound,
        skuSummary,
        orders: enrichedOrders,
      },
    });
  } catch (error: any) {
    console.error("Error parsing Flipkart PDF:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to parse Flipkart shipping label PDF.",
      },
      { status: 500 }
    );
  }
}
