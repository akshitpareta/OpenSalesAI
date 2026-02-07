import { PrismaClient } from '@prisma/client';
import type { ParsedOrderItem } from '@opensalesai/shared';
import { MIN_ORDER_CONFIDENCE } from '@opensalesai/shared';

interface MatchResult {
  original_name: string;
  matched_product_id: string | null;
  matched_sku_code: string | null;
  matched_product_name: string | null;
  confidence: number;
  quantity: number;
  unit_price: number | null;
}

/**
 * Fuzzy match parsed order items against the product catalog.
 * Uses a combination of:
 *  1. Exact SKU code match
 *  2. Case-insensitive name containment
 *  3. Token-based similarity scoring
 */
export async function fuzzyMatchProducts(
  items: ParsedOrderItem[],
  companyId: string,
  prisma: PrismaClient,
): Promise<MatchResult[]> {
  // Fetch all active products for this company (soft-delete pattern: deletedAt is null)
  const products = await prisma.product.findMany({
    where: {
      companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      skuCode: true,
      name: true,
      category: true,
      subCategory: true,
      distributorPrice: true,
    },
  });

  const results: MatchResult[] = [];

  for (const item of items) {
    const match = findBestMatch(item.product_name, products);

    results.push({
      original_name: item.product_name,
      matched_product_id: match.product?.id || null,
      matched_sku_code: match.product?.skuCode || null,
      matched_product_name: match.product?.name || null,
      confidence: match.confidence,
      quantity: item.quantity,
      unit_price: match.product ? Number(match.product.distributorPrice) : null,
    });
  }

  return results;
}

interface ProductCandidate {
  id: string;
  skuCode: string;
  name: string;
  category: string;
  subCategory: string | null;
  distributorPrice: unknown; // Prisma Decimal type
}

interface MatchScore {
  product: ProductCandidate | null;
  confidence: number;
}

/**
 * Find the best matching product for a given search term.
 */
function findBestMatch(
  searchTerm: string,
  products: ProductCandidate[],
): MatchScore {
  if (!searchTerm || products.length === 0) {
    return { product: null, confidence: 0 };
  }

  const normalizedSearch = normalizeName(searchTerm);
  const searchTokens = tokenize(normalizedSearch);

  let bestMatch: ProductCandidate | null = null;
  let bestScore = 0;

  for (const product of products) {
    let score = 0;

    // 1. Exact SKU match (highest confidence)
    if (product.skuCode.toLowerCase() === normalizedSearch) {
      return { product, confidence: 1.0 };
    }

    // 2. Exact name match
    const normalizedProductName = normalizeName(product.name);
    if (normalizedProductName === normalizedSearch) {
      return { product, confidence: 0.98 };
    }

    // 3. Name contains search term or vice versa
    if (normalizedProductName.includes(normalizedSearch)) {
      score = Math.max(score, 0.85);
    }
    if (normalizedSearch.includes(normalizedProductName)) {
      score = Math.max(score, 0.80);
    }

    // 4. Token-based similarity (use name + category + subCategory for richer matching)
    const productTokens = tokenize(normalizedProductName);
    const categoryTokens = tokenize(normalizeName(product.category));
    const subCategoryTokens = product.subCategory
      ? tokenize(normalizeName(product.subCategory))
      : [];
    const allProductTokens = [...productTokens, ...categoryTokens, ...subCategoryTokens];

    const tokenScore = calculateTokenSimilarity(searchTokens, allProductTokens);
    score = Math.max(score, tokenScore);

    // 5. Substring match on category + name combined
    const fullProductString = `${product.category} ${product.name}`.toLowerCase();
    if (fullProductString.includes(normalizedSearch)) {
      score = Math.max(score, 0.82);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = product;
    }
  }

  return {
    product: bestScore >= 0.3 ? bestMatch : null,
    confidence: Math.round(bestScore * 100) / 100,
  };
}

/**
 * Normalize a product name for matching.
 * Removes special characters, extra spaces, and common filler words.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(the|a|an|of|for|with|in|at)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize a normalized name into words.
 */
function tokenize(name: string): string[] {
  return name
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

/**
 * Calculate similarity between two sets of tokens.
 * Uses Jaccard-like coefficient with partial matching bonus.
 */
function calculateTokenSimilarity(
  searchTokens: string[],
  productTokens: string[],
): number {
  if (searchTokens.length === 0 || productTokens.length === 0) {
    return 0;
  }

  let matchCount = 0;
  let partialMatchCount = 0;

  for (const searchToken of searchTokens) {
    // Exact token match
    if (productTokens.includes(searchToken)) {
      matchCount++;
      continue;
    }

    // Partial match (starts with or contained within)
    const partialMatch = productTokens.some(
      (pt) =>
        pt.startsWith(searchToken) ||
        searchToken.startsWith(pt) ||
        pt.includes(searchToken) ||
        searchToken.includes(pt),
    );

    if (partialMatch) {
      partialMatchCount++;
    }
  }

  const totalSearchTokens = searchTokens.length;
  const exactRatio = matchCount / totalSearchTokens;
  const partialRatio = partialMatchCount / totalSearchTokens;

  // Weighted score: exact matches worth more
  return exactRatio * 0.7 + partialRatio * 0.3;
}

/**
 * Check if all matched items meet the minimum confidence threshold.
 */
export function allItemsConfident(
  matches: MatchResult[],
  threshold: number = MIN_ORDER_CONFIDENCE,
): boolean {
  return matches.every((m) => m.confidence >= threshold);
}

/**
 * Get low-confidence items that need clarification.
 */
export function getLowConfidenceItems(
  matches: MatchResult[],
  threshold: number = MIN_ORDER_CONFIDENCE,
): MatchResult[] {
  return matches.filter((m) => m.confidence < threshold);
}
