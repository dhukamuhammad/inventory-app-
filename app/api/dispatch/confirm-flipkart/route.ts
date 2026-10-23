import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orders } = body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { success: false, error: "No orders to dispatch." },
        { status: 400 }
      );
    }

    // 1. Find or create the "Flipkart" Platform
    let platform = await prisma.platform.findFirst({
      where: {
        name: {
          contains: "Flipkart",
          mode: "insensitive",
        },
      },
    });

    if (!platform) {
      platform = await prisma.platform.create({
        data: { name: "Flipkart" },
      });
    }

    // 2. Process all movements in a single safe atomic database transaction
    let processedOrdersCount = 0;
    let processedUnitsCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const order of orders) {
        if (!order.items || !Array.isArray(order.items)) continue;

        for (const item of order.items) {
          if (!item.productId) continue; // Skip unmatched items

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

          // Build descriptive ledger note with AWB and Order ID
          const details = [
            `Flipkart Order: ${order.orderId}`,
            `AWB: ${order.awb}`,
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
              date: new Date(),
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
      processedOrders: processedOrdersCount,
      processedUnits: processedUnitsCount,
    });
  } catch (error: any) {
    console.error("Error executing Flipkart bulk dispatch:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to confirm Flipkart dispatch.",
      },
      { status: 500 }
    );
  }
}
