import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
    const { orders, channel = "FLIPKART", usePdfDate = true } = body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { success: false, error: "No orders provided for dispatch." },
        { status: 400 }
      );
    }

    // STRICT VALIDATION: Ensure ALL items have a valid matched productId
    for (const order of orders) {
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

    // 2. Process all movements in a single safe atomic database transaction
    let processedOrdersCount = 0;
    let processedUnitsCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const order of orders) {
        if (!order.items || !Array.isArray(order.items)) continue;

        const orderDateObj = usePdfDate && order.orderDate
          ? parseOrderDateString(order.orderDate)
          : new Date();

        for (const item of order.items) {
          if (!item.productId) continue;

          const qty = Number(item.quantity) || 1;

          // Deduct inventory stock
          const updatedProduct = await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: {
                decrement: qty,
              },
            },
          });

          // Build descriptive ledger note with Order ID, AWB, Courier, Buyer, Date
          const details = [
            `${platformName} Order: ${order.orderId}`,
            order.awb && order.awb !== "N/A" ? `AWB: ${order.awb}` : "",
            order.courier ? `(${order.courier})` : "",
            order.orderDate ? `Order Date: ${order.orderDate}` : "",
            order.paymentType ? `[${order.paymentType}]` : "",
            order.customerName ? `Buyer: ${order.customerName}` : "",
            order.destination ? `(${order.destination})` : "",
          ]
            .filter(Boolean)
            .join(" | ");

          // Create stock out movement entry
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "OUT",
              quantity: qty,
              unitCost: updatedProduct.costPrice || null,
              platformId: platform.id,
              note: details,
              date: orderDateObj,
            },
          });

          processedUnitsCount += qty;
        }

        processedOrdersCount++;
      }
    });

    // Revalidate all affected routes
    revalidatePath("/inventory");
    revalidatePath("/movements");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");

    return NextResponse.json({
      success: true,
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
