'use client';

import React, { useState, useMemo } from 'react';
import { cn, formatINR, formatDate } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types & Mock Data
// ---------------------------------------------------------------------------
interface ParsedItem { product_name: string; spoken_text: string; matched_sku: string; quantity: number; confidence: number }
interface VoiceOrder {
  id: string; order_id: string; store_name: string; phone_masked: string;
  timestamp: string; duration_seconds: number; language: string; confidence: number;
  status: 'PARSED' | 'PROCESSING' | 'FAILED' | 'REVIEW_NEEDED';
  transcription: string; parsed_items: ParsedItem[];
  processing_time_ms: number; ai_reasoning: string;
  waveform: number[];
}

const mockVoiceOrders: VoiceOrder[] = [
  { id: 'v1', order_id: 'VO-2026-001', store_name: 'Sharma General Store', phone_masked: '+91 XXXXX-X4523', timestamp: '2026-02-07T09:15:00', duration_seconds: 34, language: 'Hindi', confidence: 0.94, status: 'PARSED', transcription: 'Bhai do case Parle-G bhejo aur teen packet Maggi, aur ek Surf Excel bada wala', parsed_items: [{ product_name: 'Parle-G Gold 200g', spoken_text: 'do case Parle-G', matched_sku: 'SKU-BIS-001', quantity: 2, confidence: 0.96 }, { product_name: 'Maggi 2-Min Noodles 70g', spoken_text: 'teen packet Maggi', matched_sku: 'SKU-NST-003', quantity: 3, confidence: 0.94 }, { product_name: 'Surf Excel Easy Wash 1kg', spoken_text: 'ek Surf Excel bada wala', matched_sku: 'SKU-DET-007', quantity: 1, confidence: 0.91 }], processing_time_ms: 2800, ai_reasoning: 'Hindi voice order processed via Whisper Large-v3. "case" interpreted as wholesale unit (12 packs). "bada wala" mapped to 1kg variant based on store purchase history.', waveform: [30, 55, 70, 85, 60, 45, 80, 65, 40, 75, 90, 50, 35, 70, 55, 40, 85, 60, 45, 70] },
  { id: 'v2', order_id: 'VO-2026-002', store_name: 'Patel & Sons Mart', phone_masked: '+91 XXXXX-X7891', timestamp: '2026-02-07T09:42:00', duration_seconds: 22, language: 'English', confidence: 0.97, status: 'PARSED', transcription: 'I need 5 packets of Tata Tea Premium and 2 boxes of Amul Butter please', parsed_items: [{ product_name: 'Tata Tea Premium 500g', spoken_text: '5 packets Tata Tea Premium', matched_sku: 'SKU-TEA-002', quantity: 5, confidence: 0.98 }, { product_name: 'Amul Butter 500g', spoken_text: '2 boxes Amul Butter', matched_sku: 'SKU-DAI-004', quantity: 2, confidence: 0.96 }], processing_time_ms: 2100, ai_reasoning: 'Clear English audio with high confidence. Direct product name matches. "boxes" mapped to standard retail unit.', waveform: [25, 40, 65, 80, 55, 70, 45, 85, 60, 35, 75, 50, 70, 45, 60, 80, 55, 40, 65, 50] },
  { id: 'v3', order_id: 'VO-2026-003', store_name: 'Gupta Kirana Store', phone_masked: '+91 XXXXX-X3456', timestamp: '2026-02-07T10:05:00', duration_seconds: 45, language: 'Hindi', confidence: 0.72, status: 'REVIEW_NEEDED', transcription: 'Suniye... ek minute... haan toh Colgate de do... aur wo jo naya wala aaya hai... Closeup ka... do teen packet de do', parsed_items: [{ product_name: 'Colgate Strong Teeth 200g', spoken_text: 'Colgate de do', matched_sku: 'SKU-ORL-001', quantity: 1, confidence: 0.85 }, { product_name: 'Closeup Ever Fresh 150g', spoken_text: 'Closeup ka do teen packet', matched_sku: 'SKU-ORL-003', quantity: 3, confidence: 0.65 }], processing_time_ms: 3800, ai_reasoning: 'Noisy background with pauses. "do teen" is ambiguous (2 or 3) — defaulted to 3 based on store ordering patterns. "naya wala" mapped to most recently launched Closeup variant. Low confidence on quantity — manual review recommended.', waveform: [15, 30, 10, 45, 60, 25, 70, 35, 55, 20, 80, 40, 15, 65, 50, 30, 75, 45, 20, 60] },
  { id: 'v4', order_id: 'VO-2026-004', store_name: 'Singh Trading Co', phone_masked: '+91 XXXXX-X8234', timestamp: '2026-02-07T10:30:00', duration_seconds: 18, language: 'English', confidence: 0.98, status: 'PARSED', transcription: 'Please send 10 cases of Bisleri 1 liter', parsed_items: [{ product_name: 'Bisleri Water 1L (Pack of 12)', spoken_text: '10 cases Bisleri 1 liter', matched_sku: 'SKU-BEV-010', quantity: 10, confidence: 0.99 }], processing_time_ms: 1500, ai_reasoning: 'Simple single-item order. High confidence match. "cases" correctly mapped to wholesale unit (12 bottles each).', waveform: [35, 55, 75, 60, 80, 45, 65, 85, 50, 70, 40, 60, 75, 55, 45, 80, 65, 50, 70, 55] },
  { id: 'v5', order_id: 'VO-2026-005', store_name: 'Reddy Supermarket', phone_masked: '+91 XXXXX-X5678', timestamp: '2026-02-07T11:00:00', duration_seconds: 52, language: 'Tamil', confidence: 0.68, status: 'FAILED', transcription: '[Transcription failed — audio quality too low. Background noise detected: traffic, music. Duration exceeds normal but speech content is minimal.]', parsed_items: [], processing_time_ms: 4200, ai_reasoning: 'Audio quality below threshold (SNR < 10dB). Heavy traffic noise and music detected. Whisper confidence score: 0.32. Recommended: Request re-recording via WhatsApp with noise reduction tips.', waveform: [10, 15, 8, 20, 12, 25, 10, 18, 8, 22, 15, 10, 20, 12, 8, 25, 15, 10, 18, 12] },
  { id: 'v6', order_id: 'VO-2026-006', store_name: 'Krishna Groceries', phone_masked: '+91 XXXXX-X9012', timestamp: '2026-02-07T11:25:00', duration_seconds: 28, language: 'Hindi', confidence: 0.91, status: 'PARSED', transcription: 'Panch packet Britannia Good Day aur das Dairy Milk chota wala', parsed_items: [{ product_name: 'Britannia Good Day 200g', spoken_text: 'panch packet Britannia Good Day', matched_sku: 'SKU-BIS-005', quantity: 5, confidence: 0.95 }, { product_name: 'Cadbury Dairy Milk 12g', spoken_text: 'das Dairy Milk chota wala', matched_sku: 'SKU-CHO-002', quantity: 10, confidence: 0.88 }], processing_time_ms: 2600, ai_reasoning: '"Panch" = 5 in Hindi. "chota wala" (small one) mapped to 12g variant. "das" = 10. Good audio quality with clear Hindi numerals.', waveform: [40, 60, 75, 55, 85, 45, 70, 80, 50, 65, 40, 75, 60, 45, 80, 55, 70, 50, 65, 45] },
  { id: 'v7', order_id: 'VO-2026-007', store_name: 'Mehta Corner Shop', phone_masked: '+91 XXXXX-X2345', timestamp: '2026-02-07T11:50:00', duration_seconds: 40, language: 'Hindi', confidence: 0.83, status: 'PARSED', transcription: 'Arre sunte ho, Tide ka bada packet chahiye, ek darjan, aur Vim bar bhi bhej do, chhe piece', parsed_items: [{ product_name: 'Tide Plus Extra Power 1kg', spoken_text: 'Tide ka bada packet ek darjan', matched_sku: 'SKU-DET-003', quantity: 12, confidence: 0.87 }, { product_name: 'Vim Dishwash Bar 200g', spoken_text: 'Vim bar chhe piece', matched_sku: 'SKU-CLN-001', quantity: 6, confidence: 0.90 }], processing_time_ms: 3100, ai_reasoning: '"ek darjan" = one dozen (12). "bada packet" = large variant (1kg). "chhe" = 6 in Hindi. Informal greeting "Arre sunte ho" correctly ignored.', waveform: [20, 45, 65, 55, 80, 40, 70, 60, 35, 75, 50, 65, 80, 45, 55, 70, 40, 60, 50, 75] },
  { id: 'v8', order_id: 'VO-2026-008', store_name: 'Jain Provision Store', phone_masked: '+91 XXXXX-X6789', timestamp: '2026-02-07T12:15:00', duration_seconds: 15, language: 'English', confidence: 0.96, status: 'PARSED', transcription: 'Three cases Pepsi 2 liter and one case Lays Classic', parsed_items: [{ product_name: 'Pepsi 2L (Pack of 6)', spoken_text: '3 cases Pepsi 2 liter', matched_sku: 'SKU-BEV-015', quantity: 3, confidence: 0.97 }, { product_name: 'Lays Classic Salted 52g (Box of 48)', spoken_text: 'one case Lays Classic', matched_sku: 'SKU-SNK-001', quantity: 1, confidence: 0.95 }], processing_time_ms: 1800, ai_reasoning: 'Clear English, direct brand match. "case" mapped to standard wholesale packaging units for each respective SKU.', waveform: [45, 65, 80, 70, 55, 85, 60, 75, 50, 80, 65, 45, 70, 55, 80, 60, 75, 50, 65, 55] },
  { id: 'v9', order_id: 'VO-2026-009', store_name: 'Bansal General Store', phone_masked: '+91 XXXXX-X1234', timestamp: '2026-02-07T12:40:00', duration_seconds: 38, language: 'Hindi', confidence: 0.76, status: 'REVIEW_NEEDED', transcription: 'Haan bhai... wo jo pichli baar manga tha wahi bhej do... same order... aur upar se ek case Frooti bhi add kar do', parsed_items: [{ product_name: 'Frooti Mango 200ml (Case of 32)', spoken_text: 'ek case Frooti', matched_sku: 'SKU-BEV-020', quantity: 1, confidence: 0.92 }], processing_time_ms: 3400, ai_reasoning: '"pichli baar manga tha wahi" = "send the same as last time". Referenced previous order #ORD-2026-01247 but requires confirmation. Only Frooti addition could be parsed with confidence. Previous order had: 5x Parle-G, 3x Maggi, 2x Tata Tea.', waveform: [25, 40, 55, 35, 70, 45, 60, 30, 75, 50, 40, 65, 55, 35, 70, 45, 60, 50, 40, 55] },
  { id: 'v10', order_id: 'VO-2026-010', store_name: 'Agarwal Traders', phone_masked: '+91 XXXXX-X5432', timestamp: '2026-02-07T13:05:00', duration_seconds: 20, language: 'English', confidence: 0.93, status: 'PARSED', transcription: 'Need Dettol soap regular size, twenty pieces, and 10 bottles of Dettol hand wash', parsed_items: [{ product_name: 'Dettol Original Soap 125g', spoken_text: '20 pieces Dettol soap regular', matched_sku: 'SKU-PER-001', quantity: 20, confidence: 0.95 }, { product_name: 'Dettol Hand Wash 200ml', spoken_text: '10 bottles Dettol hand wash', matched_sku: 'SKU-PER-005', quantity: 10, confidence: 0.92 }], processing_time_ms: 2000, ai_reasoning: 'Brand disambiguation: "Dettol soap" vs "Dettol hand wash" correctly separated. "regular size" mapped to 125g standard variant.', waveform: [50, 70, 85, 60, 75, 55, 80, 65, 45, 70, 80, 55, 65, 75, 50, 85, 60, 70, 55, 65] },
  { id: 'v11', order_id: 'VO-2026-011', store_name: 'Chopra Superstore', phone_masked: '+91 XXXXX-X8765', timestamp: '2026-02-07T13:30:00', duration_seconds: 30, language: 'Hindi', confidence: 0.89, status: 'PARSED', transcription: 'Char packet Nescafe Classic aur do packet Bournvita, family size wala, aur haan ek jar Kissan Jam', parsed_items: [{ product_name: 'Nescafe Classic 50g', spoken_text: 'char packet Nescafe Classic', matched_sku: 'SKU-BEV-025', quantity: 4, confidence: 0.93 }, { product_name: 'Cadbury Bournvita 750g', spoken_text: 'do packet Bournvita family size', matched_sku: 'SKU-BEV-030', quantity: 2, confidence: 0.88 }, { product_name: 'Kissan Mixed Fruit Jam 500g', spoken_text: 'ek jar Kissan Jam', matched_sku: 'SKU-SPR-001', quantity: 1, confidence: 0.90 }], processing_time_ms: 2900, ai_reasoning: '"char" = 4, "do" = 2. "family size wala" mapped to 750g variant. Kissan Jam defaulted to Mixed Fruit (most popular variant at this store).', waveform: [35, 55, 70, 80, 50, 65, 75, 45, 85, 60, 40, 70, 55, 80, 45, 65, 75, 50, 60, 70] },
  { id: 'v12', order_id: 'VO-2026-012', store_name: 'Iyer Provisions', phone_masked: '+91 XXXXX-X3210', timestamp: '2026-02-07T14:00:00', duration_seconds: 25, language: 'English', confidence: 0.95, status: 'PROCESSING', transcription: 'Can you send me 8 packets of MTR Sambar Powder and 5 packets of MTR Rasam Powder, the 100 gram ones', parsed_items: [{ product_name: 'MTR Sambar Powder 100g', spoken_text: '8 packets MTR Sambar Powder', matched_sku: 'SKU-SPI-010', quantity: 8, confidence: 0.96 }, { product_name: 'MTR Rasam Powder 100g', spoken_text: '5 packets MTR Rasam Powder 100g', matched_sku: 'SKU-SPI-012', quantity: 5, confidence: 0.97 }], processing_time_ms: 1900, ai_reasoning: 'Clear English with specific quantity and size specifications. "100 gram ones" correctly applies to both items. Currently awaiting inventory confirmation.', waveform: [40, 60, 80, 65, 50, 75, 85, 55, 70, 45, 80, 60, 50, 75, 65, 45, 80, 55, 70, 60] },
];

const statusConfig: Record<VoiceOrder['status'], { label: string; bg: string; text: string; dot: string }> = {
  PARSED: { label: 'Parsed', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
  PROCESSING: { label: 'Processing', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500 animate-pulse' },
  FAILED: { label: 'Failed', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  REVIEW_NEEDED: { label: 'Review Needed', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
};

const pipelineSteps = [
  { label: 'Audio Received', sub: 'WhatsApp', latency: '0.1s' },
  { label: 'Whisper STT', sub: 'Large-v3 GPU', latency: '0.8s' },
  { label: 'Text Normalize', sub: 'Language detect', latency: '0.1s' },
  { label: 'Order Parser', sub: 'LLM (70B)', latency: '1.2s' },
  { label: 'Catalog Match', sub: 'Fuzzy + Vector', latency: '0.3s' },
  { label: 'Order Created', sub: 'Confirmed', latency: '0.3s' },
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const MicIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" /></svg>
);
const PlayIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
);
const ChevronDown = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
);
const WarningIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
);
const ArrowRight = () => (
  <svg className="h-5 w-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
);

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const formatTime = (ts: string) => new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// ---------------------------------------------------------------------------
// Voice Order Detail (expanded)
// ---------------------------------------------------------------------------
const VoiceOrderDetail: React.FC<{ order: VoiceOrder }> = ({ order }) => {
  const hasLow = order.parsed_items.some((i) => i.confidence < 0.8);
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2 space-y-5 animate-fade-in">
      {/* Waveform */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Audio Waveform</h4>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex items-end gap-[3px] h-20">
          <button className="mr-3 h-8 w-8 rounded-full bg-primary-600 text-white flex items-center justify-center flex-shrink-0 hover:bg-primary-700 transition-colors">
            <PlayIcon className="h-4 w-4 ml-0.5" />
          </button>
          {order.waveform.map((h, i) => (
            <div key={i} className="flex-1 bg-primary-400 dark:bg-primary-500 rounded-t-sm opacity-80 transition-all" style={{ height: `${h}%` }} />
          ))}
          <span className="ml-3 text-xs text-gray-500 flex-shrink-0">{formatDuration(order.duration_seconds)}</span>
        </div>
      </div>

      {/* Transcription */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Raw Transcription</h4>
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">&ldquo;{order.transcription}&rdquo;</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>Language: <strong>{order.language}</strong></span>
            <span>Processing: <strong>{(order.processing_time_ms / 1000).toFixed(1)}s</strong></span>
          </div>
        </div>
      </div>

      {/* Parsed Items */}
      {order.parsed_items.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Parsed Items</h4>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Conf.</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {order.parsed_items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2.5 px-3"><p className="font-medium text-gray-900 dark:text-gray-100">{item.product_name}</p><p className="text-xs text-gray-400 mt-0.5">Spoken: &ldquo;{item.spoken_text}&rdquo;</p></td>
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-500">{item.matched_sku}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-gray-700 dark:text-gray-300">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right"><span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', item.confidence >= 0.9 ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : item.confidence >= 0.8 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300')}>{(item.confidence * 100).toFixed(0)}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasLow && (
              <div className="border-t border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 px-3 py-2.5 flex items-start gap-2">
                <WarningIcon className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">Low confidence (&lt;80%) detected — manual review recommended</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Reasoning */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">AI Reasoning</h4>
        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/30 rounded-lg p-4">
          <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">{order.ai_reasoning}</p>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function VoiceOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPipeline, setShowPipeline] = useState(false);

  const stats = useMemo(() => {
    const total = mockVoiceOrders.length;
    const parsed = mockVoiceOrders.filter((o) => o.status === 'PARSED').length;
    const avgMs = mockVoiceOrders.reduce((s, o) => s + o.processing_time_ms, 0) / total;
    const langs = [...new Set(mockVoiceOrders.map((o) => o.language))];
    return { total, parsed, rate: ((parsed / total) * 100).toFixed(1), avgTime: (avgMs / 1000).toFixed(1), langs };
  }, []);

  const filtered = useMemo(() => mockVoiceOrders.filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (langFilter && o.language !== langFilter) return false;
    return true;
  }), [statusFilter, langFilter]);

  const langOptions = [...new Set(mockVoiceOrders.map((o) => o.language))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Voice / Audio Orders</h1>
        <p className="page-subtitle">Voice orders via WhatsApp — STT transcriptions and AI-parsed results</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card card-padding text-center">
          <div className="flex items-center justify-center gap-2 mb-1"><MicIcon className="h-4 w-4 text-primary-500" /><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Voice Orders (Today)</p></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
        </div>
        <div className="card card-padding text-center">
          <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Successfully Parsed</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.parsed} <span className="text-sm font-medium text-green-500">({stats.rate}%)</span></p>
        </div>
        <div className="card card-padding text-center">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Avg Processing Time</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.avgTime}s</p>
        </div>
        <div className="card card-padding text-center">
          <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">Languages</p>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.langs.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">{stats.langs.join(', ')}</p>
        </div>
      </div>

      {/* Pipeline */}
      <div className="card overflow-hidden">
        <button onClick={() => setShowPipeline(!showPipeline)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center"><MicIcon className="h-4 w-4 text-white" /></div>
            <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Audio Processing Pipeline</p><p className="text-xs text-gray-500">End-to-end flow from audio to order creation</p></div>
          </div>
          <ChevronDown className={cn('h-5 w-5 text-gray-400 transition-transform', showPipeline && 'rotate-180')} />
        </button>
        {showPipeline && (
          <div className="px-6 pb-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                {pipelineSteps.map((step, idx) => (
                  <React.Fragment key={step.label}>
                    <div className="flex flex-col items-center text-center flex-1 min-w-[80px]">
                      <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center mb-2', idx === pipelineSteps.length - 1 ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600')}>
                        <MicIcon className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{step.label}</p>
                      <p className="text-[10px] text-gray-500">{step.sub}</p>
                      <span className="mt-1 text-[10px] font-mono font-semibold text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded-full">~{step.latency}</span>
                    </div>
                    {idx < pipelineSteps.length - 1 && <div className="flex items-center pt-5 flex-shrink-0"><ArrowRight /></div>}
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
                <p className="text-xs text-gray-500">Total end-to-end: <span className="font-semibold text-gray-900 dark:text-gray-100">~2.8s avg</span> | P95: <span className="font-semibold text-gray-900 dark:text-gray-100">~4.5s</span></p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-44">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Statuses</option>
            <option value="PARSED">Parsed</option><option value="PROCESSING">Processing</option><option value="FAILED">Failed</option><option value="REVIEW_NEEDED">Review Needed</option>
          </select>
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Language</label>
          <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Languages</option>
            {langOptions.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        {(statusFilter || langFilter) && <button onClick={() => { setStatusFilter(''); setLangFilter(''); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline pb-2">Clear</button>}
      </div>

      <p className="text-sm text-gray-500">Showing {filtered.length} of {mockVoiceOrders.length} voice orders</p>

      {/* Orders List */}
      <div className="space-y-3">
        {filtered.map((order) => {
          const cfg = statusConfig[order.status];
          const isExp = expandedId === order.id;
          return (
            <div key={order.id} className="card overflow-hidden">
              <button onClick={() => setExpandedId(isExp ? null : order.id)} className="w-full text-left px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0', cfg.bg, cfg.text)}><MicIcon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">{order.order_id}</span>
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />{cfg.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5 truncate">{order.store_name}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-6 text-xs text-gray-500 flex-shrink-0">
                    <div className="text-center w-24"><p className="text-[10px] uppercase text-gray-400">Phone</p><p className="font-mono mt-0.5">{order.phone_masked}</p></div>
                    <div className="text-center w-14"><p className="text-[10px] uppercase text-gray-400">Duration</p><p className="font-mono mt-0.5">{formatDuration(order.duration_seconds)}</p></div>
                    <div className="text-center w-14"><p className="text-[10px] uppercase text-gray-400">Language</p><p className="mt-0.5">{order.language}</p></div>
                    <div className="text-center w-16"><p className="text-[10px] uppercase text-gray-400">Confidence</p><p className={cn('font-semibold mt-0.5', order.confidence >= 0.9 ? 'text-green-600' : order.confidence >= 0.8 ? 'text-blue-600' : 'text-amber-600')}>{(order.confidence * 100).toFixed(0)}%</p></div>
                    <div className="text-center w-16"><p className="text-[10px] uppercase text-gray-400">Time</p><p className="mt-0.5">{formatTime(order.timestamp)}</p></div>
                  </div>
                  <ChevronDown className={cn('h-5 w-5 text-gray-400 transition-transform flex-shrink-0', isExp && 'rotate-180')} />
                </div>
              </button>
              {isExp && <div className="px-5 pb-5"><VoiceOrderDetail order={order} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
