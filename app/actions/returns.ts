"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface SearchOrderResult {
  success: boolean;
  message?: string;
  order?: any;
  daysSinceDispatch?: number;
  smartRecommendation?: {
    type: "RTO" | "CUSTOMER";
    title: string;
    description: string;
  };
}

export async function lookupReturnOrder(rawQuery: string): Promise<SearchOrderResult> {
  const query = (rawQuery || "").trim();
  if (!query) {
    return { success: false, message: "Please enter an Order ID or AWB tracking number." };
  }

  // Derive base query without sub-order suffixes (e.g., "341588384850470016_1" -> "341588384850470016")
  const baseQuery = query.replace(/[_\-\.][0-9a-zA-Z]+$/, "").trim();

  try {
    // 1. Exact match first (by clean query or base query)
    const exactConditions: any[] = [
      { orderId: { equals: query, mode: "insensitive" } },
      { awb: { equals: query, mode: "insensitive" } },
    ];
    if (baseQuery && baseQuery !== query) {
      exactConditions.push({ orderId: { equals: baseQuery, mode: "insensitive" } });
    }

    let order = await prisma.dispatchedOrder.findFirst({
      where: {
        OR: exactConditions,
      },
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
      orderBy: { createdAt: "desc" },
    });

    // 2. Prefix match (e.g. searching "341588384850470016" matches "341588384850470016_1")
    if (!order) {
      const prefixConditions: any[] = [
        { orderId: { startsWith: query, mode: "insensitive" } },
        { awb: { startsWith: query, mode: "insensitive" } },
      ];
      if (baseQuery && baseQuery !== query) {
        prefixConditions.push({ orderId: { startsWith: baseQuery, mode: "insensitive" } });
      }

      order = await prisma.dispatchedOrder.findFirst({
        where: {
          OR: prefixConditions,
        },
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
        orderBy: { createdAt: "desc" },
      });
    }

    // 3. Fallback to contains match if exact and prefix not found
    if (!order) {
      const containsConditions: any[] = [
        { orderId: { contains: query, mode: "insensitive" } },
        { awb: { contains: query, mode: "insensitive" } },
      ];
      if (baseQuery && baseQuery !== query) {
        containsConditions.push({ orderId: { contains: baseQuery, mode: "insensitive" } });
      }

      order = await prisma.dispatchedOrder.findFirst({
        where: {
          OR: containsConditions,
        },
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
        orderBy: { createdAt: "desc" },
      });
    }

    if (!order) {
      return {
        success: false,
        message: `Order or AWB "${query}" database mein nahi mila. Please verify ki yeh order ScoviX ke dispatch system se confirm hua tha.`,
      };
    }

    // Calculate elapsed days
    const dispatchTime = new Date(order.dispatchedAt || order.createdAt).getTime();
    const nowTime = Date.now();
    const diffDays = Math.max(0, Math.floor((nowTime - dispatchTime) / (1000 * 60 * 60 * 24)));

    // Smart suggestion based on real e-commerce timelines
    const smartRecommendation =
      diffDays <= 7
        ? {
            type: "RTO" as const,
            title: "Likely RTO (Courier Return)",
            description: `Dispatch hue sirf ${diffDays === 0 ? "aaj" : `${diffDays} din`} hue hain. Courier se undelivered wapas aaya packet sealed aur fresh rehta hai.`,
          }
        : {
            type: "CUSTOMER" as const,
            title: "Likely Customer Return",
            description: `Dispatch hue ${diffDays} din ho chuke hain. Customer ne packet khola hoga — physical quality aur tag zaroor check karein.`,
          };

    // Gather channel SKUs to query SkuMapping table
    const channelSkus = order.items
      .map((it: any) => it.channelSku?.trim())
      .filter(Boolean) as string[];

    const mappingOrConditions = channelSkus.flatMap((c: string) => [
      { channelSku: { equals: c, mode: "insensitive" as const } },
      { channelSku: { equals: c.replace(/[^a-zA-Z0-9]/g, ""), mode: "insensitive" as const } },
    ]);

    const relevantMappings = mappingOrConditions.length > 0
      ? await prisma.skuMapping.findMany({
          where: { OR: mappingOrConditions },
        })
      : [];

    // Check if any item was truly substituted / upgraded during dispatch (distinguish normal channel mapping vs manual swap)
    const enrichedItems = order.items.map((it: any) => {
      const cleanChannel = (it.channelSku || "").toLowerCase().trim();
      const normChannel = cleanChannel.replace(/[^a-z0-9]/g, "");
      const cleanProduct = (it.product?.sku || "").toLowerCase().trim();
      const normProduct = cleanProduct.replace(/[^a-z0-9]/g, "");

      let isSubstituted = false;

      if (cleanChannel && cleanProduct) {
        if (cleanChannel === cleanProduct || normChannel === normProduct) {
          // Exact SKU match: clearly not substituted
          isSubstituted = false;
        } else {
          // Check if channelSku is mapped to this dispatched product
          const isMappedToThisProduct =
            (it.product?.mappings &&
              it.product.mappings.some((m: any) => {
                const mChan = (m.channelSku || "").toLowerCase().trim();
                const mNorm = mChan.replace(/[^a-z0-9]/g, "");
                return mChan === cleanChannel || mNorm === normChannel;
              })) ||
            relevantMappings.some((m: any) => {
              const mChan = (m.channelSku || "").toLowerCase().trim();
              const mNorm = mChan.replace(/[^a-z0-9]/g, "");
              const matchesChannel = mChan === cleanChannel || mNorm === normChannel;
              return matchesChannel && m.productId === it.productId;
            });

          if (isMappedToThisProduct) {
            // Normal channel SKU mapping: NOT substituted!
            isSubstituted = false;
          } else {
            // Channel SKU differs and does not map to this product: real substitution!
            isSubstituted = true;
          }
        }
      }

      return {
        ...it,
        isSubstituted,
        orderedSku: it.channelSku,
        dispatchedSku: it.product?.sku,
        dispatchedProductName: it.product?.name,
      };
    });

    const hasSubstitutedItems = enrichedItems.some((it: any) => it.isSubstituted);

    const enrichedOrder = {
      ...order,
      items: enrichedItems,
      hasSubstitutedItems,
    };

    return {
      success: true,
      order: enrichedOrder,
      daysSinceDispatch: diffDays,
      smartRecommendation,
    };
  } catch (error: any) {
    console.error("Error looking up return order:", error);
    return {
      success: false,
      message: error.message || "Failed to search order in database.",
    };
  }
}

export async function processOrderReturn(data: {
  dispatchedOrderId: string;
  returnType: "RETURN_RTO" | "RETURN_CUSTOMER";
  condition: "GOOD" | "DEFECTIVE";
  note?: string;
}) {
  const { dispatchedOrderId, returnType, condition, note } = data;

  if (!dispatchedOrderId) {
    throw new Error("Order ID is required.");
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Fetch order with items
    const order = await tx.dispatchedOrder.findUnique({
      where: { id: dispatchedOrderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                mappings: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error("Dispatched order not found.");
    }

    // Prevent duplicate return inward
    if (order.status !== "DISPATCHED") {
      const returnDateStr = order.returnedAt
        ? new Date(order.returnedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "earlier";
      throw new Error(
        `Yeh order pehle hi ${returnDateStr} ko return inward ho chuka hai (${order.status} - ${order.condition || "PROCESSED"}). Duplicate entry blocked.`
      );
    }

    // 2. Find or create Platform
    let platform = await tx.platform.findFirst({
      where: {
        name: {
          contains: order.channel,
          mode: "insensitive",
        },
      },
    });

    if (!platform) {
      platform = await tx.platform.create({
        data: { name: order.channel },
      });
    }

    // 3. Update DispatchedOrder status & audit fields
    const updatedOrder = await tx.dispatchedOrder.update({
      where: { id: order.id },
      data: {
        status: returnType,
        condition,
        returnNote: note?.trim() || null,
        returnedAt: new Date(),
      },
    });

    // 4. Update Product Stock and create Movement records for each item
    for (const item of order.items) {
      const qty = item.quantity || 1;

      // Update product stock (Good -> currentStock, Defective -> defectiveStock)
      if (condition === "GOOD") {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              increment: qty,
            },
          },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            defectiveStock: {
              increment: qty,
            },
          },
        });
      }

      // Determine movement type for analytics and movements ledger
      const movementType =
        returnType === "RETURN_RTO"
          ? condition === "GOOD"
            ? "RETURN_RTO"
            : "RETURN_RTO_DEFECTIVE"
          : condition === "GOOD"
          ? "RETURN_GOOD"
          : "RETURN_DEFECTIVE";

      const cleanChannel = (item.channelSku || "").toLowerCase().trim();
      const normChannel = cleanChannel.replace(/[^a-z0-9]/g, "");
      const cleanProduct = (item.product?.sku || "").toLowerCase().trim();
      const normProduct = cleanProduct.replace(/[^a-z0-9]/g, "");

      let isSubstituted = false;
      if (cleanChannel && cleanProduct) {
        if (cleanChannel === cleanProduct || normChannel === normProduct) {
          isSubstituted = false;
        } else {
          const isMapped = item.product?.mappings?.some((m: any) => {
            const mChan = (m.channelSku || "").toLowerCase().trim();
            const mNorm = mChan.replace(/[^a-z0-9]/g, "");
            return mChan === cleanChannel || mNorm === normChannel;
          });
          isSubstituted = !isMapped;
        }
      }

      const subTag = isSubstituted
        ? `[SUBSTITUTED INWARD: Restocked ${item.product.sku} (+${qty}) for Label ${item.channelSku}]`
        : "";

      // Descriptive ledger note with Order ID, AWB, Buyer, Condition, Note
      const noteDetails = [
        `Return Inward: ${returnType === "RETURN_RTO" ? "RTO (Courier Return)" : "Customer Return"}`,
        `Condition: ${condition === "GOOD" ? "Good (Sellable Stock)" : "Defective / Damaged Stock"}`,
        subTag,
        `Order: ${order.orderId}`,
        order.awb ? `AWB: ${order.awb}` : "",
        order.customerName ? `Buyer: ${order.customerName}` : "",
        note?.trim() ? `Note: ${note.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: movementType,
          quantity: qty,
          unitCost: item.product.costPrice || null,
          platformId: platform.id,
          note: noteDetails,
          date: new Date(),
        },
      });
    }

    return updatedOrder;
  });

  // Revalidate routes
  revalidatePath("/returns");
  revalidatePath("/inventory");
  revalidatePath("/movements");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");

  return { success: true, order: result };
}

export async function revertOrderReturn(dispatchedOrderId: string) {
  if (!dispatchedOrderId) {
    throw new Error("Dispatched Order ID is required.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.dispatchedOrder.findUnique({
      where: { id: dispatchedOrderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error("Order record nahi mila.");
    }

    if (order.status !== "RETURN_RTO" && order.status !== "RETURN_CUSTOMER") {
      throw new Error("Yeh order return processed status mein nahi hai.");
    }

    const prevCondition = order.condition;

    // 1. Revert Product Stock for each item
    for (const item of order.items) {
      const qty = item.quantity || 1;

      if (prevCondition === "GOOD") {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              decrement: qty,
            },
          },
        });
      } else if (prevCondition === "DEFECTIVE") {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            defectiveStock: {
              decrement: qty,
            },
          },
        });
      }

      // Delete associated StockMovement records created for this return
      await tx.stockMovement.deleteMany({
        where: {
          productId: item.productId,
          note: {
            contains: `Order: ${order.orderId}`,
          },
        },
      });
    }

    // 2. Revert DispatchedOrder status back to DISPATCHED
    const updatedOrder = await tx.dispatchedOrder.update({
      where: { id: order.id },
      data: {
        status: "DISPATCHED",
        condition: null,
        returnNote: null,
        returnedAt: null,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return updatedOrder;
  });

  // Revalidate routes
  revalidatePath("/returns");
  revalidatePath("/inventory");
  revalidatePath("/movements");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");

  return { success: true, order: result };
}

export async function getReturnsSummary() {
  try {
    const [
      totalDispatched,
      returnedOrders,
      recentReturns,
      recentDispatches,
    ] = await Promise.all([
      prisma.dispatchedOrder.count(),
      prisma.dispatchedOrder.findMany({
        where: {
          status: {
            in: ["RETURN_RTO", "RETURN_CUSTOMER"],
          },
        },
        select: {
          status: true,
          condition: true,
          returnedAt: true,
        },
      }),
      prisma.dispatchedOrder.findMany({
        where: {
          status: {
            in: ["RETURN_RTO", "RETURN_CUSTOMER"],
          },
        },
        orderBy: { returnedAt: "desc" },
        take: 100,
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      }),
      prisma.dispatchedOrder.findMany({
        orderBy: { dispatchedAt: "desc" },
        take: 10,
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      }),
    ]);

    const totalReturns = returnedOrders.length;
    const rtoCount = returnedOrders.filter((o) => o.status === "RETURN_RTO").length;
    const customerCount = returnedOrders.filter((o) => o.status === "RETURN_CUSTOMER").length;
    const goodConditionCount = returnedOrders.filter((o) => o.condition === "GOOD").length;
    const defectiveConditionCount = returnedOrders.filter((o) => o.condition === "DEFECTIVE").length;

    // Today's returns
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayReturnsCount = returnedOrders.filter(
      (o) => o.returnedAt && new Date(o.returnedAt) >= todayStart
    ).length;

    return {
      totalDispatched,
      totalReturns,
      todayReturnsCount,
      rtoCount,
      customerCount,
      goodConditionCount,
      defectiveConditionCount,
      recentReturns,
      recentDispatches,
    };
  } catch (error) {
    console.error("Error fetching returns summary:", error);
    return {
      totalDispatched: 0,
      totalReturns: 0,
      todayReturnsCount: 0,
      rtoCount: 0,
      customerCount: 0,
      goodConditionCount: 0,
      defectiveConditionCount: 0,
      recentReturns: [],
      recentDispatches: [],
    };
  }
}
