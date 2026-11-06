"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface SkuSummaryRecord {
  sku: string;
  name: string;
  totalQuantity: number;
  currentStock?: number;
  afterStock?: number;
  productId: string | null;
  found: boolean;
  isSubstituted?: boolean;
  originalSku?: string;
}

export interface DispatchBatchItem {
  id: string;
  fileName: string;
  channel: string;
  totalOrders: number;
  totalUnits: number;
  courierSummary: string | null;
  skuSummary: string | null;
  status: string;
  revertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    orders: number;
  };
}

export async function getDispatchBatches(): Promise<DispatchBatchItem[]> {
  try {
    const batches = await prisma.dispatchBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });
    return batches;
  } catch (error: any) {
    console.error("Error fetching dispatch batches:", error);
    return [];
  }
}

export async function getDispatchBatchDetails(batchId: string) {
  if (!batchId) throw new Error("Batch ID is required");

  try {
    const batch = await prisma.dispatchBatch.findUnique({
      where: { id: batchId },
      include: {
        orders: {
          orderBy: { createdAt: "asc" },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                    mappings: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return batch;
  } catch (error: any) {
    console.error("Error fetching dispatch batch details:", error);
    throw new Error(error.message || "Failed to load batch details.");
  }
}

export async function revertDispatchBatch(batchId: string) {
  if (!batchId) throw new Error("Batch ID is required");

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Fetch batch with all its orders and items
        const batch = await tx.dispatchBatch.findUnique({
          where: { id: batchId },
          include: {
            orders: {
              include: {
                items: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        });

        if (!batch) {
          throw new Error("Dispatch batch record nahi mila.");
        }

        if (batch.status === "REVERTED") {
          throw new Error("Yeh batch pehle se hi revert (undo) ho chuka hai.");
        }

        // Check if any order has already had return actions taken
        const alreadyReturnedOrders = batch.orders.filter(
          (o) => o.status === "RETURN_RTO" || o.status === "RETURN_CUSTOMER"
        );

        if (alreadyReturnedOrders.length > 0) {
          throw new Error(
            `Cannot revert: Is batch ke ${alreadyReturnedOrders.length} order(s) already return process ho chuke hain (e.g. Order ID: ${alreadyReturnedOrders[0].orderId}).`
          );
        }

        // 2. Aggregate quantities to restore per product
        const stockRestoreMap = new Map<string, number>();
        const orderIds: string[] = [];

        for (const order of batch.orders) {
          // Double-Undo Guard: If this order was already cancelled (e.g. undone via stock ledger), skip restoring its stock again!
          if (order.status === "CANCELLED") {
            continue;
          }

          orderIds.push(order.orderId);
          for (const item of order.items) {
            if (item.productId) {
              const qty = item.quantity || 1;
              stockRestoreMap.set(
                item.productId,
                (stockRestoreMap.get(item.productId) || 0) + qty
              );
            }
          }
        }

        // 3. Restore stock in Product table
        for (const [productId, restoreQty] of stockRestoreMap.entries()) {
          await tx.product.update({
            where: { id: productId },
            data: {
              currentStock: {
                increment: restoreQty,
              },
            },
          });
        }

        // 4. Delete associated OUT stock movements created for these orders
        for (const order of batch.orders) {
          await tx.stockMovement.deleteMany({
            where: {
              type: "OUT",
              note: {
                contains: order.orderId,
              },
            },
          });
        }

        // 5. Update orders status to CANCELLED
        await tx.dispatchedOrder.updateMany({
          where: { batchId: batch.id },
          data: {
            status: "CANCELLED",
          },
        });

        // 6. Update batch status to REVERTED
        const updatedBatch = await tx.dispatchBatch.update({
          where: { id: batch.id },
          data: {
            status: "REVERTED",
            revertedAt: new Date(),
          },
        });

        return {
          batch: updatedBatch,
          restoredProductsCount: stockRestoreMap.size,
          revertedOrdersCount: batch.orders.length,
        };
      },
      {
        timeout: 30000,
      }
    );

    // Revalidate all relevant routes
    revalidatePath("/dispatch-history");
    revalidatePath("/inventory");
    revalidatePath("/movements");
    revalidatePath("/dashboard");
    revalidatePath("/returns");

    return {
      success: true,
      message: `Batch "${result.batch.fileName}" successfully revert ho gaya. ${result.revertedOrdersCount} orders cancel ho gaye aur stock restore kar diya gaya.`,
      result,
    };
  } catch (error: any) {
    console.error("Error reverting dispatch batch:", error);
    return {
      success: false,
      error: error.message || "Failed to revert dispatch batch.",
    };
  }
}
