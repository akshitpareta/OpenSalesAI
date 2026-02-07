import { AI_SERVICE_URL, AI_ENDPOINTS } from '@opensalesai/shared';
import type { OrderParseResult } from '@opensalesai/shared';

const AI_BASE = process.env['AI_SERVICE_URL'] || AI_SERVICE_URL;

interface ParseOrderOptions {
  text: string;
  company_id: string;
  store_id?: string;
  language_hint?: string;
}

/**
 * Parse natural language order text using the AI service.
 * Supports English, Hindi, Hinglish, and other Indian languages.
 *
 * Example inputs:
 * - "2 cases coke, 5 packs lays classic, 1 dozen dairy milk"
 * - "do case coke aur paanch packet lays bhejo"
 * - "Send me usual order plus 3 extra thums up"
 */
export async function parseOrderFromText(options: ParseOrderOptions): Promise<OrderParseResult> {
  const url = `${AI_BASE}${AI_ENDPOINTS.ORDER_PARSE}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Company-Id': options.company_id,
      },
      body: JSON.stringify({
        text: options.text,
        store_id: options.store_id,
        language_hint: options.language_hint,
      }),
      signal: AbortSignal.timeout(30_000), // 30 second timeout
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`AI service returned ${response.status}: ${errorBody}`);
    }

    const result = (await response.json()) as OrderParseResult;
    return result;
  } catch (error) {
    // Fallback: simple regex-based parsing for basic order patterns
    if (error instanceof Error && error.message.includes('fetch')) {
      return fallbackOrderParse(options.text);
    }
    throw error;
  }
}

/**
 * Fallback order parser using regex patterns.
 * Used when the AI service is unavailable.
 *
 * Handles patterns like:
 * - "2 cases of coke"
 * - "5 packs lays"
 * - "1 dozen dairy milk"
 */
function fallbackOrderParse(text: string): OrderParseResult {
  const items: OrderParseResult['items'] = [];

  // Pattern: quantity unit product_name
  const patterns = [
    /(\d+)\s*(cases?|packs?|packets?|dozens?|boxes?|bottles?|pieces?|pcs?|kg|liters?|ltrs?)\s+(?:of\s+)?(.+?)(?:,|and|aur|\.|$)/gi,
    /(\d+)\s+(.+?)(?:,|and|aur|\.|$)/gi, // simpler: just number + product
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const quantity = parseInt(match[1], 10);
      const productName = (match[3] || match[2]).trim().replace(/\s+/g, ' ');

      if (quantity > 0 && productName.length > 0) {
        // Avoid duplicates
        const exists = items.some(
          (item) => item.product_name.toLowerCase() === productName.toLowerCase(),
        );
        if (!exists) {
          items.push({
            product_name: productName,
            quantity,
            unit: match[3] ? match[2].replace(/s$/, '').toUpperCase() : null,
            confidence: 0.5, // Low confidence for fallback parsing
            matched_product_id: null,
            matched_sku_code: null,
          });
        }
      }
    }

    if (items.length > 0) break; // Stop at first pattern that matches
  }

  return {
    items,
    raw_text: text,
    language_detected: 'en',
    parse_confidence: items.length > 0 ? 0.5 : 0,
  };
}

/**
 * Parse an order from a transcribed audio message.
 * First transcribes the audio, then parses the text.
 */
export async function parseOrderFromAudio(
  audioUrl: string,
  companyId: string,
  storeId?: string,
): Promise<OrderParseResult> {
  const sttUrl = `${AI_BASE}${AI_ENDPOINTS.STT_TRANSCRIBE}`;

  // Step 1: Transcribe audio
  const sttResponse = await fetch(sttUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: audioUrl }),
    signal: AbortSignal.timeout(60_000), // 60 second timeout for STT
  });

  if (!sttResponse.ok) {
    throw new Error(`STT service returned ${sttResponse.status}`);
  }

  const sttResult = (await sttResponse.json()) as { text: string; language: string };

  // Step 2: Parse the transcribed text
  return parseOrderFromText({
    text: sttResult.text,
    company_id: companyId,
    store_id: storeId,
    language_hint: sttResult.language,
  });
}

/**
 * Parse an order from an image (e.g., a photo of a handwritten order list).
 */
export async function parseOrderFromImage(
  imageUrl: string,
  companyId: string,
  storeId?: string,
): Promise<OrderParseResult> {
  const visionUrl = `${AI_BASE}${AI_ENDPOINTS.VISION_PARSE}`;

  const visionResponse = await fetch(visionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      task: 'order_extraction',
      company_id: companyId,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!visionResponse.ok) {
    throw new Error(`Vision service returned ${visionResponse.status}`);
  }

  const visionResult = (await visionResponse.json()) as { text: string };

  return parseOrderFromText({
    text: visionResult.text,
    company_id: companyId,
    store_id: storeId,
  });
}
