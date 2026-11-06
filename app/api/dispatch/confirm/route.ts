import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

function parseOrderDateString(str: string): Date {
  if (!str) return new Date();
  // 1. match DD-MM-YYYY or DD.MM.YYYY or DD/MM/YYYY
  const parts = str.match(/^(\d{2})[-/.](\d{2})[-/.](\d{2,4})$/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1;
    let year = parseInt(parts[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day, 12, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }
  // 2. match DD-MMM or DD-MMM-YYYY (e.g. 10-Aug or 10-Aug-2026)
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const mmmParts = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})(?:[-/ ](\d{2,4}))?$/i);
  if (mmmParts) {
    const day = parseInt(mmmParts[1], 10);
    const monStr = mmmParts[2].toLowerCase();
    const month = monthMap[monStr] ?? new Date().getMonth();
    let year = mmmParts[3] ? parseInt(mmmParts[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day, 12, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      orders,
      channel = "FLIPKART",
      usePdfDate = true,
      fileName,
      skuSummary,
      courierSummary,
    } = body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { success: false, error: "No orders provided for dispatch." },
        { status: 400 }
      );
    }

    // 0. DUPLICATE CHECK: Verify if any incoming orders were already dispatched
    const awbsToCheck = Array.from(
      new Set(
        orders
          .map((o: any) => o.awb?.trim())
          .filter((a: any): a is string => Boolean(a && a !== "N/A" && a.length > 3))
      )
    );
    const orderIdsToCheck = Array.from(
      new Set(
        orders
          .map((o: any) => o.orderId?.trim())
          .filter((id: any): id is string => Boolean(id && !id.startsWith("ORDER-") && id.length > 3))
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
              orderId: true,
              awb: true,
            },
          })
        : [];

    const existingAwbSet = new Set(
      existingDispatched
        .map((d) => d.awb?.toLowerCase().trim())
        .filter((a): a is string => Boolean(a))
    );
    const existingOrderIdSet = new Set(
      existingDispatched
        .map((d) => d.orderId?.toLowerCase().trim())
        .filter((id): id is string => Boolean(id))
    );

    const isDuplicateOrder = (o: any) => {
      const a = o.awb && o.awb !== "N/A" ? o.awb.toLowerCase().trim() : null;
      const id =
        o.orderId && !o.orderId.startsWith("ORDER-")
          ? o.orderId.toLowerCase().trim()
          : null;
      return (a && existingAwbSet.has(a)) || (id && existingOrderIdSet.has(id));
    };

    const eligibleOrders = orders.filter((o: any) => !isDuplicateOrder(o));

    if (eligibleOrders.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Dispatch Blocked: Yeh sabhi orders pehle hi dispatch ho chuke hain. Duplicate dispatch prevented.",
        },
        { status: 400 }
      );
    }

    // STRICT VALIDATION: Ensure ALL items in eligible orders have a valid matched productId
    for (const order of eligibleOrders) {
      for (const item of order.items || []) {
        if (!item.productId) {
          return NextResponse.json(
            {
              success: false,
              error: `Dispatch Blocked: SKU "${item.sku}" is not found in your inventory. Please register all products in inventory before dispatching.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const platformName =
      channel === "AMAZON" ? "Amazon" : channel === "MEESHO" ? "Meesho" : "Flipkart";

    // 1. Find or create the Platform (Meesho, Flipkart, or Amazon)
    let platform = await prisma.platform.findFirst({
      where: {
        name: {
          contains: platformName,
          mode: "insensitive",
        },
      },
    });

    if (!platform) {
      platform = await prisma.platform.create({
        data: { name: platformName },
      });
    }

    // 2. Pre-fetch distinct product cost prices in 1 single fast query
    const distinctProductIds = Array.from(
      new Set(
        eligibleOrders.flatMap((o: any) =>
          (o.items || []).map((it: any) => it.productId).filter(Boolean)
        )
      )
    ) as string[];

    const products = await prisma.product.findMany({
      where: { id: { in: distinctProductIds } },
      select: { id: true, costPrice: true },
    });
    const costPriceMap = new Map(products.map((p) => [p.id, p.costPrice || null]));

    // Generate unique batch ID for this upload session
    const batchId = crypto.randomUUID();
    const cleanFileName =
      fileName && typeof fileName === "string" && fileName.trim()
        ? fileName.trim()
        : `${platformName}_Labels_${new Date().toISOString().slice(0, 10)}.pdf`;

    // 3. Aggregate stock decrements & prepare bulk arrays (zero DB latency in memory)
    const stockDecrementMap = new Map<string, number>();
    const movementRows: any[] = [];
    const orderRows: any[] = [];
    const orderItemRows: any[] = [];

    let processedOrdersCount = 0;
    let processedUnitsCount = 0;

    for (const order of eligibleOrders) {
      if (!order.items || !Array.isArray(order.items)) continue;

      const orderDateObj =
        usePdfDate && order.orderDate
          ? parseOrderDateString(order.orderDate)
          : new Date();

      const dispatchedOrderId = crypto.randomUUID();
      const cleanOrderId =
        order.orderId && order.orderId.trim()
          ? order.orderId.trim()
          : `ORD-${Date.now()}-${processedOrdersCount + 1}`;
      let cleanAwb =
        order.awb && order.awb !== "N/A" && order.awb.trim() ? order.awb.trim() : null;
      if (cleanAwb === cleanOrderId) {
        cleanAwb = null;
      }

      orderRows.push({
        id: dispatchedOrderId,
        orderId: cleanOrderId,
        awb: cleanAwb,
        channel: platformName.toUpperCase(),
        courier: order.courier?.trim() || null,
        customerName: order.customerName?.trim() || null,
        destination: order.destination?.trim() || null,
        paymentType: order.paymentType?.trim() || null,
        status: "DISPATCHED",
        dispatchedAt: orderDateObj,
        batchId: batchId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      for (const item of order.items) {
        if (!item.productId) continue;

        const qty = Number(item.quantity) || 1;
        processedUnitsCount += qty;

        // Aggregate stock decrement count
        stockDecrementMap.set(
          item.productId,
          (stockDecrementMap.get(item.productId) || 0) + qty
        );

        const isSubstituted = Boolean(item.isSubstituted);
        const subTag = isSubstituted
          ? `[SUBSTITUTED: Sent ${item.sku} for Label ${item.originalSku || item.sku}]`
          : "";

        // Build descriptive ledger note
        const details = [
          `${platformName} Order: ${order.orderId}`,
          subTag,
          order.awb && order.awb !== "N/A" ? `AWB: ${order.awb}` : "",
          order.courier ? `(${order.courier})` : "",
          order.orderDate ? `Order Date: ${order.orderDate}` : "",
          order.paymentType ? `[${order.paymentType}]` : "",
          order.customerName ? `Buyer: ${order.customerName}` : "",
          order.destination ? `(${order.destination})` : "",
        ]
          .filter(Boolean)
          .join(" | ");

        movementRows.push({
          id: crypto.randomUUID(),
          productId: item.productId,
          type: "OUT",
          quantity: qty,
          unitCost: costPriceMap.get(item.productId) || null,
          platformId: platform.id,
          note: details,
          date: orderDateObj,
        });

        orderItemRows.push({
          id: crypto.randomUUID(),
          dispatchedOrderId: dispatchedOrderId,
          productId: item.productId,
          channelSku: item.originalSku || item.sku || null,
          quantity: qty,
          unitCost: null,
          createdAt: new Date(),
        });
      }

      processedOrdersCount++;
    }

    // Prepare JSON strings for batch summaries
    const courierSummaryStr =
      courierSummary && typeof courierSummary === "object"
        ? JSON.stringify(courierSummary)
        : null;

    const skuSummaryStr =
      skuSummary && Array.isArray(skuSummary)
        ? JSON.stringify(skuSummary)
        : null;

    // 4. Execute atomic batch update (Ultra Fast: 300 queries reduced to ~5 queries)
    await prisma.$transaction(
      async (tx) => {
        // Bulk update aggregated product stocks
        for (const [prodId, decQty] of stockDecrementMap.entries()) {
          await tx.product.update({
            where: { id: prodId },
            data: {
              currentStock: {
                decrement: decQty,
              },
            },
          });
        }

        // Create the DispatchBatch session record
        await tx.dispatchBatch.create({
          data: {
            id: batchId,
            fileName: cleanFileName,
            channel: platformName.toUpperCase(),
            totalOrders: processedOrdersCount,
            totalUnits: processedUnitsCount,
            courierSummary: courierSummaryStr,
            skuSummary: skuSummaryStr,
            status: "CONFIRMED",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Bulk insert all stock movements
        if (movementRows.length > 0) {
          await tx.stockMovement.createMany({
            data: movementRows,
          });
        }

        // Bulk insert all dispatched orders
        if (orderRows.length > 0) {
          await tx.dispatchedOrder.createMany({
            data: orderRows,
          });
        }

        // Bulk insert all dispatched order items
        if (orderItemRows.length > 0) {
          await tx.dispatchedOrderItem.createMany({
            data: orderItemRows,
          });
        }
      },
      {
        timeout: 30000,
      }
    );

    // Revalidate affected routes
    revalidatePath("/inventory");
    revalidatePath("/movements");
    revalidatePath("/dashboard");
    revalidatePath("/returns");
    revalidatePath("/dispatch-history");

    return NextResponse.json({
      success: true,
      batchId,
      fileName: cleanFileName,
      channel: platformName,
      processedOrders: processedOrdersCount,
      processedUnits: processedUnitsCount,
    });
  } catch (error: any) {
    console.error("Error executing bulk auto-dispatch:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to confirm bulk auto-dispatch.",
      },
      { status: 500 }
    );
  }
}
