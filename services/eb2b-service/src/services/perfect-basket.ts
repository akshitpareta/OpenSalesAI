import { PrismaClient } from '@prisma/client';
import { AI_SERVICE_URL } from '@opensalesai/shared';

const AI_BASE = process.env['AI_SERVICE_URL'] || AI_SERVICE_URL;

interface PerfectBasketItem {
  productId: string;
  productName: string;
  skuCode: string;
  suggestedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  reason: string;
  confidence: number;
  category: string;
}

interface PerfectBasketResult {
  storeId: string;
  storeName: string;
  items: PerfectBasketItem[];
  subtotal: number;
  itemCount: number;
  recommendationSource: 'ai' | 'rules';
  generatedAt: string;
}

/**
 * Generate a "Perfect Basket" recommendation for a store.
 * Uses AI to analyze the store's purchase history and suggest optimal reorder quantities.
 * Falls back to rule-based suggestions when the AI service is unavailable.
 */
export async function generatePerfectBasket(
  storeId: string,
  companyId: string,
  prisma: PrismaClient,
): Promise<PerfectBasketResult> {
  const store = await prisma.store.findFirst({
    where: { id: storeId, companyId, deletedAt: null },
    select: { id: true, name: true, channelType: true, mslTier: true },
  });

  if (!store) {
    throw new Error(`Store ${storeId} not found`);
  }

  // Try AI-based recommendation first
  try {
    const aiResult = await getAIPerfectBasket(storeId, companyId);
    return {
      storeId: store.id,
      storeName: store.name,
      items: aiResult.items,
      subtotal: aiResult.items.reduce((sum, item) => sum + item.totalPrice, 0),
      itemCount: aiResult.items.length,
      recommendationSource: 'ai',
      generatedAt: new Date().toISOString(),
    };
  } catch {
    // Fall back to rule-based recommendation
    const ruleBasedItems = await getRuleBasedBasket(storeId, companyId, prisma);
    return {
      storeId: store.id,
      storeName: store.name,
      items: ruleBasedItems,
      subtotal: ruleBasedItems.reduce((sum, item) => sum + item.totalPrice, 0),
      itemCount: ruleBasedItems.length,
      recommendationSource: 'rules',
      generatedAt: new Date().toISOString(),
    };
  }
}

async function getAIPerfectBasket(
  storeId: string,
  companyId: string,
): Promise<{ items: PerfectBasketItem[] }> {
  const response = await fetch(`${AI_BASE}/predictions/perfect-basket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Company-Id': companyId,
    },
    body: JSON.stringify({ store_id: storeId }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`AI service returned ${response.status}`);
  }

  return (await response.json()) as { items: PerfectBasketItem[] };
}

/**
 * Rule-based basket generation using historical transaction data.
 * Analyzes the store's transaction items from the last 90 days.
 */
async function getRuleBasedBasket(
  storeId: string,
  companyId: string,
  prisma: PrismaClient,
): Promise<PerfectBasketItem[]> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get transaction items for this store in the last 90 days
  const recentItems = await prisma.transactionItem.findMany({
    where: {
      transaction: {
        storeId,
        companyId,
        transactionDate: { gte: ninetyDaysAgo },
        deletedAt: null,
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          skuCode: true,
          distributorPrice: true,
          category: true,
          deletedAt: true,
        },
      },
    },
  });

  // Aggregate by product
  const productAgg = new Map<string, {
    product: (typeof recentItems)[0]['product'];
    totalQty: number;
    orderCount: number;
  }>();

  for (const item of recentItems) {
    if (item.product.deletedAt) continue;

    const existing = productAgg.get(item.productId);
    if (existing) {
      existing.totalQty += item.quantity;
      existing.orderCount += 1;
    } else {
      productAgg.set(item.productId, {
        product: item.product,
        totalQty: item.quantity,
        orderCount: 1,
      });
    }
  }

  const basketItems: PerfectBasketItem[] = [];

  for (const [, agg] of productAgg) {
    const avgQty = Math.ceil(agg.totalQty / agg.orderCount);
    const suggestedQty = Math.max(1, avgQty);
    const unitPrice = Number(agg.product.distributorPrice);

    basketItems.push({
      productId: agg.product.id,
      productName: agg.product.name,
      skuCode: agg.product.skuCode,
      suggestedQuantity: suggestedQty,
      unitPrice,
      totalPrice: Math.round(unitPrice * suggestedQty * 100) / 100,
      reason: `Ordered ${agg.orderCount} times in last 90 days (avg qty: ${avgQty})`,
      confidence: Math.min(0.9, 0.5 + agg.orderCount * 0.05),
      category: agg.product.category,
    });
  }

  // Add focus products not ordered recently
  const orderedIds = new Set(productAgg.keys());
  const focusProducts = await prisma.product.findMany({
    where: {
      companyId,
      isFocus: true,
      deletedAt: null,
      id: { notIn: [...orderedIds] },
    },
    select: {
      id: true,
      name: true,
      skuCode: true,
      distributorPrice: true,
      category: true,
    },
    take: 10,
  });

  for (const product of focusProducts) {
    basketItems.push({
      productId: product.id,
      productName: product.name,
      skuCode: product.skuCode,
      suggestedQuantity: 1,
      unitPrice: Number(product.distributorPrice),
      totalPrice: Number(product.distributorPrice),
      reason: 'Focus product not ordered in 90 days',
      confidence: 0.6,
      category: product.category,
    });
  }

  basketItems.sort((a, b) => b.confidence - a.confidence || b.totalPrice - a.totalPrice);

  return basketItems.slice(0, 30);
}
