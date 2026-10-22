"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// --- CATEGORIES ---
export async function getCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function addCategory(name: string) {
  const category = await prisma.category.create({ data: { name } });
  revalidatePath("/inventory");
  return category;
}

export async function updateCategory(id: string, name: string) {
  const category = await prisma.category.update({ where: { id }, data: { name } });
  revalidatePath("/inventory");
  return category;
}

export async function deleteCategory(id: string) {
  await prisma.category.delete({ where: { id } });
  revalidatePath("/inventory");
}

// --- PLATFORMS ---
export async function getPlatforms() {
  return prisma.platform.findMany({ orderBy: { name: "asc" } });
}

export async function addPlatform(name: string) {
  const platform = await prisma.platform.create({ data: { name } });
  revalidatePath("/inventory");
  return platform;
}

export async function updatePlatform(id: string, name: string) {
  const platform = await prisma.platform.update({ where: { id }, data: { name } });
  revalidatePath("/inventory");
  return platform;
}

export async function deletePlatform(id: string) {
  await prisma.platform.delete({ where: { id } });
  revalidatePath("/inventory");
}

// --- PRODUCTS ---
export async function getProducts() {
  return prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      movements: {
        orderBy: { date: "desc" },
        take: 5,
        include: { platform: true }
      },
    },
  });
}

export async function addProduct(data: { name: string; sku: string; categoryId: string; costPrice?: number; lowStockAlertAt: number }) {
  const { categoryId, costPrice = 0, ...restData } = data;
  const product = await prisma.product.create({
    data: {
      ...restData,
      costPrice: costPrice ?? 0,
      category: {
        connect: { id: categoryId }
      }
    }
  });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return product;
}

export async function updateProduct(id: string, data: { name: string; sku: string; categoryId: string; costPrice?: number; lowStockAlertAt: number }) {
  const { categoryId, costPrice, ...restData } = data;
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...restData,
      ...(costPrice !== undefined && { costPrice }),
      category: {
        connect: { id: categoryId }
      }
    },
  });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return product;
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({
    where: { id },
  });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

import { sendWhatsAppAlert } from "@/lib/whatsapp";

export async function updateStock(data: {
  productId: string;
  type: "IN" | "OUT" | "RETURN_RTO" | "RETURN_GOOD" | "RETURN_DEFECTIVE";
  quantity: number;
  unitCost?: number;
  platformId?: string;
  note?: string;
}) {
  const { productId, type, quantity, unitCost, platformId, note } = data;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Fetch current product to calculate Weighted Average Cost
    const currentProduct = await tx.product.findUnique({
      where: { id: productId },
    });

    if (!currentProduct) {
      throw new Error("Product not found");
    }

    let calculatedNewCostPrice: number | undefined = undefined;

    // Weighted Average Cost (WAC) logic on Stock IN:
    if (type === "IN" && typeof unitCost === "number" && unitCost > 0) {
      const oldQty = currentProduct.currentStock;
      const oldPrice = currentProduct.costPrice;
      const newQty = quantity;
      const newIncomingPrice = unitCost;

      if (oldQty <= 0 || oldPrice <= 0) {
        // If there was no existing stock or cost was 0, set to incoming rate
        calculatedNewCostPrice = newIncomingPrice;
      } else {
        // Formula: (Old Total Value + New Inward Value) / Total Quantity
        const oldTotalVal = oldQty * oldPrice;
        const newTotalVal = newQty * newIncomingPrice;
        const totalQty = oldQty + newQty;
        const weightedAvg = (oldTotalVal + newTotalVal) / totalQty;
        calculatedNewCostPrice = Number(weightedAvg.toFixed(2));
      }
    }

    // 2. Create Movement Record
    const movement = await tx.stockMovement.create({
      data: {
        productId,
        type,
        quantity,
        unitCost: unitCost || null,
        platformId: platformId || null,
        note,
      },
    });

    // 3. Stock increment / decrement
    let currentStockUpdate = undefined;
    let defectiveStockUpdate = undefined;

    if (type === "IN" || type === "RETURN_RTO" || type === "RETURN_GOOD") {
      currentStockUpdate = { increment: quantity };
    } else if (type === "OUT") {
      currentStockUpdate = { decrement: quantity };
    } else if (type === "RETURN_DEFECTIVE") {
      defectiveStockUpdate = { increment: quantity };
    }

    // 4. Update Product in database
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: {
        ...(currentStockUpdate && { currentStock: currentStockUpdate }),
        ...(defectiveStockUpdate && { defectiveStock: defectiveStockUpdate }),
        ...(calculatedNewCostPrice !== undefined && { costPrice: calculatedNewCostPrice }),
      },
      include: {
        category: true,
      }
    });

    return { movement, updatedProduct };
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/movements");
  revalidatePath("/analytics");
  
  // Check for low stock alert if it was a stock OUT
  if (type === "OUT") {
    const { updatedProduct } = result;
    if (updatedProduct.currentStock <= updatedProduct.lowStockAlertAt) {
      // Send WhatsApp Notification in the background
      const message = `⚠️ *Low Stock Alert*\n\nProduct: ${updatedProduct.name}\nCategory: ${updatedProduct.category.name}\nSKU: ${updatedProduct.sku}\n\n*Current Stock: ${updatedProduct.currentStock}*\n(Alert Threshold: ${updatedProduct.lowStockAlertAt})\n\nPlease restock soon!`;
      sendWhatsAppAlert(message).catch(console.error);
    }
  }
  
  return result;
}

export async function processReturns(data: {
  productId: string;
  platformId: string;
  returns: {
    rtoGood: number;
    rtoDefective: number;
    customerGood: number;
    customerDefective: number;
  };
}) {
  const { productId, platformId, returns } = data;

  const result = await prisma.$transaction(async (tx) => {
    let totalGoodAdded = 0;
    let totalDefectiveAdded = 0;

    // 1. RTO Good
    if (returns.rtoGood > 0) {
      await tx.stockMovement.create({
        data: { productId, platformId, type: "RETURN_RTO", quantity: returns.rtoGood },
      });
      totalGoodAdded += returns.rtoGood;
    }

    // 2. RTO Defective
    if (returns.rtoDefective > 0) {
      await tx.stockMovement.create({
        data: { productId, platformId, type: "RETURN_RTO_DEFECTIVE", quantity: returns.rtoDefective },
      });
      totalDefectiveAdded += returns.rtoDefective;
    }

    // 3. Customer Good
    if (returns.customerGood > 0) {
      await tx.stockMovement.create({
        data: { productId, platformId, type: "RETURN_GOOD", quantity: returns.customerGood },
      });
      totalGoodAdded += returns.customerGood;
    }

    // 4. Customer Defective
    if (returns.customerDefective > 0) {
      await tx.stockMovement.create({
        data: { productId, platformId, type: "RETURN_DEFECTIVE", quantity: returns.customerDefective },
      });
      totalDefectiveAdded += returns.customerDefective;
    }

    // Update Product Stock
    if (totalGoodAdded > 0 || totalDefectiveAdded > 0) {
      return await tx.product.update({
        where: { id: productId },
        data: {
          ...(totalGoodAdded > 0 && { currentStock: { increment: totalGoodAdded } }),
          ...(totalDefectiveAdded > 0 && { defectiveStock: { increment: totalDefectiveAdded } }),
        },
      });
    }
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/movements");
  revalidatePath("/analytics");
  return result;
}

// --- ANALYTICS / INSIGHTS ---

export async function getProductInsights(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      movements: {
        orderBy: { date: "desc" },
        include: { platform: true },
      },
    },
  });

  if (!product) return null;

  const movements = product.movements;
  
  let totalSold = 0;
  let totalReturns = 0;
  let rtoReturns = 0;
  let customerReturns = 0;

  // Platform-wise tracking
  const platformStats: Record<string, { 
    platformName: string; 
    sold: number; 
    returns: number;
    rto: { total: number; good: number; defective: number };
    customer: { total: number; good: number; defective: number };
  }> = {};

  movements.forEach((movement) => {
    const isReturn = movement.type.startsWith("RETURN");
    const isOut = movement.type === "OUT";

    // Global Stats
    if (isOut) {
      totalSold += movement.quantity;
    } else if (isReturn) {
      totalReturns += movement.quantity;
      if (movement.type === "RETURN_RTO" || movement.type === "RETURN_RTO_DEFECTIVE") {
        rtoReturns += movement.quantity;
      } else {
        customerReturns += movement.quantity;
      }
    }

    // Platform Stats
    if (movement.platformId && movement.platform) {
      const pid = movement.platformId;
      if (!platformStats[pid]) {
        platformStats[pid] = { 
          platformName: movement.platform.name, 
          sold: 0, 
          returns: 0,
          rto: { total: 0, good: 0, defective: 0 },
          customer: { total: 0, good: 0, defective: 0 }
        };
      }
      
      if (isOut) {
        platformStats[pid].sold += movement.quantity;
      } else if (isReturn) {
        platformStats[pid].returns += movement.quantity;
        
        if (movement.type === "RETURN_RTO") {
          platformStats[pid].rto.total += movement.quantity;
          platformStats[pid].rto.good += movement.quantity;
        } else if (movement.type === "RETURN_RTO_DEFECTIVE") {
          platformStats[pid].rto.total += movement.quantity;
          platformStats[pid].rto.defective += movement.quantity;
        } else if (movement.type === "RETURN_GOOD") {
          platformStats[pid].customer.total += movement.quantity;
          platformStats[pid].customer.good += movement.quantity;
        } else if (movement.type === "RETURN_DEFECTIVE") {
          platformStats[pid].customer.total += movement.quantity;
          platformStats[pid].customer.defective += movement.quantity;
        }
      }
    }
  });

  const overallReturnRate = totalSold > 0 ? (totalReturns / totalSold) * 100 : 0;

  const platformPerformance = Object.values(platformStats).map((stat) => ({
    ...stat,
    returnRate: stat.sold > 0 ? (stat.returns / stat.sold) * 100 : 0,
  }));

  // Sort platforms by most sold
  platformPerformance.sort((a, b) => b.sold - a.sold);

  return {
    product,
    stats: {
      totalSold,
      totalReturns,
      rtoReturns,
      customerReturns,
      overallReturnRate,
    },
    platformPerformance,
    history: movements,
  };
}

// --- REVERT / DELETE STOCK MOVEMENT ---

export async function deleteStockMovement(movementId: string) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Find movement
    const movement = await tx.stockMovement.findUnique({
      where: { id: movementId },
    });

    if (!movement) {
      throw new Error("Movement entry not found");
    }

    const { productId, type, quantity } = movement;

    // 2. Determine reverse adjustments on product stock
    let currentStockAdjust = 0;
    let defectiveStockAdjust = 0;

    if (type === "IN" || type === "RETURN_RTO" || type === "RETURN_GOOD") {
      // It was added (+quantity), so reverse is -quantity
      currentStockAdjust = -quantity;
    } else if (type === "OUT") {
      // It was deducted (-quantity), so reverse is +quantity
      currentStockAdjust = quantity;
    } else if (type === "RETURN_DEFECTIVE" || type === "RETURN_RTO_DEFECTIVE") {
      // Defective stock was added, so reverse is -quantity
      defectiveStockAdjust = -quantity;
    }

    // Safety check: Ensure product exists and stock doesn't become negative
    const currentProd = await tx.product.findUnique({
      where: { id: productId },
    });

    if (!currentProd) {
      throw new Error("Product not found");
    }

    if (currentStockAdjust < 0 && currentProd.currentStock + currentStockAdjust < 0) {
      throw new Error(`Cannot revert entry: Current stock (${currentProd.currentStock}) is less than the quantity (${quantity}) being removed.`);
    }

    // 3. If it was a Stock IN, recalculate Weighted Average Cost from remaining IN movements
    let recalculatedCost: number | undefined = undefined;

    if (type === "IN") {
      const remainingInMovements = await tx.stockMovement.findMany({
        where: {
          productId,
          id: { not: movementId },
          type: "IN",
        },
        orderBy: { date: "asc" },
      });

      let totalVal = 0;
      let totalQty = 0;
      for (const m of remainingInMovements) {
        if (m.unitCost && m.unitCost > 0) {
          totalQty += m.quantity;
          totalVal += m.quantity * m.unitCost;
        }
      }

      if (totalQty > 0) {
        recalculatedCost = Number((totalVal / totalQty).toFixed(2));
      } else {
        recalculatedCost = 0;
      }
    }

    // 4. Delete the movement entry
    await tx.stockMovement.delete({
      where: { id: movementId },
    });

    // 5. Update the product
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: {
        ...(currentStockAdjust !== 0 && { currentStock: { increment: currentStockAdjust } }),
        ...(defectiveStockAdjust !== 0 && { defectiveStock: { increment: defectiveStockAdjust } }),
        ...(recalculatedCost !== undefined && { costPrice: recalculatedCost }),
      },
      include: {
        category: true,
      },
    });

    return { success: true, updatedProduct };
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/movements");
  revalidatePath("/analytics");
  return result;
}

// --- ALL STOCK MOVEMENTS (FOR DEDICATED MOVEMENTS PAGE) ---

export async function getAllStockMovements(limit = 250) {
  return prisma.stockMovement.findMany({
    take: limit,
    orderBy: { date: "desc" },
    include: {
      product: {
        include: {
          category: true,
        },
      },
      platform: true,
    },
  });
}

// --- GLOBAL BUSINESS ANALYTICS ---

export async function getGlobalAnalytics() {
  const [products, movements, platforms] = await Promise.all([
    prisma.product.findMany({
      include: {
        category: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      orderBy: { date: "desc" },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        platform: true,
      },
    }),
    prisma.platform.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    products,
    movements,
    platforms,
  };
}

