'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cn, formatRelativeTime } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AgentType = 'analytics' | 'order' | 'coach' | 'collection' | 'promo';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  agent?: AgentType;
  content: string;
  timestamp: Date;
  ragChunks?: RAGChunk[];
  meta?: { model: string; latencyMs: number; tokensUsed: number; confidence: number };
}

interface RAGChunk {
  source: string;
  relevance: number;
  snippet: string;
}

interface ChatSession {
  id: string;
  title: string;
  agent: AgentType;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
}

// ---------------------------------------------------------------------------
// Agent Configuration
// ---------------------------------------------------------------------------
const AGENTS: Record<AgentType, { label: string; color: string; bg: string; description: string }> = {
  analytics: { label: 'Analytics', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', description: 'Natural language queries on sales data — SQL generation & explanations (Sales Lens)' },
  order:     { label: 'Order',     color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', description: 'Parse text/voice/image orders into structured orders with catalog matching' },
  coach:     { label: 'Coach',     color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30', description: 'Sales coaching — simulate scenarios, evaluate responses, provide feedback' },
  collection:{ label: 'Collection',color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', description: 'Payment collection assistance — outstanding balances, follow-up scripts' },
  promo:     { label: 'Promo',     color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30', description: 'Promotion design — suggest offers, discount strategies, bundle recommendations' },
};

const SUGGESTED_PROMPTS: Record<AgentType, string[]> = {
  analytics: ['What were top 5 products this week?', 'Compare Mumbai vs Delhi revenue', 'Show stores with declining orders', 'Which reps exceeded targets?', 'Revenue trend last 30 days', 'Lowest coverage territories'],
  order: ['Parse: 2 cases Parle-G, 5 packets Maggi', 'Check inventory for SKU-001', 'Create order for Store Mumbai-GT-001', 'What\'s the perfect basket for Store-005?', 'Parse Hindi: do case Parle-G bhejo', 'Show recent WhatsApp orders'],
  coach: ['Simulate cold call scenario', 'How to handle price objection?', 'Practice upselling techniques', 'Best approach for new store onboarding', 'Role-play: retailer wants discount', 'Tips for increasing order frequency'],
  collection: ['Show overdue payments this week', 'Draft follow-up for Store-003', 'Which stores have credit tier D?', 'Payment reminder script in Hindi', 'Escalation plan for 30+ day overdue', 'Credit limit adjustment suggestion'],
  promo: ['Suggest promotion for slow-moving SKUs', 'Bundle deal for summer beverages', 'Volume discount for top 10 stores', 'Festival season offer ideas', 'Compete with rival brand pricing', 'Design loyalty reward scheme'],
};

const MOCK_RESPONSES: Record<AgentType, string[]> = {
  analytics: [
    '**Top 5 Products (This Week)**\n\n| # | Product | Revenue | Units |\n|---|---------|---------|-------|\n| 1 | Parle-G Gold | ₹1,24,500 | 830 |\n| 2 | Maggi 2-Min Noodles | ₹98,200 | 1,640 |\n| 3 | Tata Tea Premium | ₹87,300 | 582 |\n| 4 | Amul Butter 500g | ₹76,800 | 384 |\n| 5 | Surf Excel Easy Wash | ₹65,400 | 436 |\n\n*Revenue is up 12% compared to last week, driven primarily by Parle-G Gold promotional push in Mumbai territory.*',
    '**Mumbai vs Delhi Revenue Comparison**\n\nMumbai: ₹18,50,000 (↑8.3% MoM)\nDelhi: ₹14,20,000 (↑3.1% MoM)\n\nMumbai leads by ₹4,30,000. Key driver: higher store density in General Trade channel (52 vs 38 stores). Delhi shows stronger Modern Trade performance (₹3,20,000 vs ₹2,80,000).',
  ],
  order: [
    '**Order Parsed Successfully**\n\n| Item | Matched SKU | Qty | Confidence |\n|------|------------|-----|------------|\n| Parle-G | SKU-BIS-001 | 2 cases (24 units) | 98% |\n| Maggi Noodles | SKU-NST-003 | 5 packets | 95% |\n\n**Total: ₹1,840** (before tax)\nReady to submit to Store Mumbai-GT-001. Shall I confirm?',
    '**Inventory Check — SKU-001 (Parle-G Gold 200g)**\n\nCurrent Stock: 145 cases\nAvg Daily Consumption: 12 cases\nDays of Stock: ~12 days\nReorder Point: 50 cases\n\n✅ Stock is healthy. No immediate reorder needed.',
  ],
  coach: [
    '**Cold Call Simulation**\n\n*Scenario: You\'re visiting Sharma General Store for the first time. The owner is busy.*\n\n🎭 **Owner:** "I\'m busy, what do you want?"\n\nSuggested approach:\n1. Be brief and respectful of their time\n2. Lead with value: "I can help you increase your beverage sales by 20%"\n3. Ask for just 2 minutes\n4. Show your bestseller list for their area\n\nTry responding and I\'ll evaluate your approach!',
    '**Handling Price Objections**\n\nWhen a retailer says "Your prices are too high":\n\n1. **Acknowledge**: "I understand margins matter to you"\n2. **Reframe**: Focus on sell-through rate, not unit cost\n3. **Data**: "Stores stocking this product see 15% higher footfall"\n4. **Volume offer**: "At 5+ cases, I can offer 3% additional margin"\n5. **Trial close**: "Let\'s try 2 cases this week and track the results"',
  ],
  collection: [
    '**Overdue Payments Summary**\n\n| Store | Outstanding | Days Overdue | Credit Tier |\n|-------|------------|--------------|-------------|\n| Gupta Mart | ₹45,200 | 15 days | B |\n| Singh Stores | ₹32,800 | 22 days | C |\n| Patel & Sons | ₹28,500 | 8 days | A |\n\nTotal Outstanding: ₹1,06,500\nRecommended: Prioritize Singh Stores (approaching 30-day mark).',
  ],
  promo: [
    '**Slow-Moving SKU Promotion**\n\nIdentified 5 SKUs with >30 day stock:\n\n1. **Buy 2 Get 1 Free** — Vim Bar 200g (48 day stock)\n2. **15% Off MRP** — Closeup Toothpaste 150g (35 day stock)\n3. **Combo Deal** — Surf Excel + Vim bundle at ₹99 (saves ₹18)\n\nEstimated impact: Clear 60% of excess stock in 2 weeks.\nRecommended channels: WhatsApp blast to 200 retailers + display push through reps.',
  ],
};

const MOCK_RAG_CHUNKS: RAGChunk[][] = [
  [{ source: 'store_profiles/mumbai_gt.json', relevance: 0.94, snippet: 'Mumbai General Trade cluster — 52 active stores, avg order value ₹8,400, primary categories: Biscuits (28%), Noodles (18%), Tea (15%)...' }, { source: 'sales_playbooks/revenue_growth.md', relevance: 0.87, snippet: 'Revenue growth strategies for GT channel: focus on MSL compliance, increase visit frequency to 2x/week for top-tier stores...' }, { source: 'product_catalog/bestsellers_q1.json', relevance: 0.82, snippet: 'Q1 2026 bestsellers: Parle-G Gold leads biscuit category with 24% market share in covered stores...' }],
  [{ source: 'transaction_history/weekly_summary.json', relevance: 0.91, snippet: 'Weekly sales summary — Total revenue: ₹48,25,000. Top territory: Mumbai (₹18,50,000). Task completion rate: 72.5%...' }, { source: 'rep_performance/targets_vs_actual.json', relevance: 0.85, snippet: 'Rep target achievement: 7 of 10 reps exceeded weekly targets. Top performer: Rajesh Kumar (118% achievement)...' }],
];

// ---------------------------------------------------------------------------
// Initial mock chat history
// ---------------------------------------------------------------------------
const INITIAL_HISTORY: ChatSession[] = [
  { id: 's1', title: 'Revenue comparison Mumbai vs Delhi', agent: 'analytics', lastMessage: 'Compare Mumbai vs Delhi revenue', timestamp: new Date(Date.now() - 3600000), messageCount: 4 },
  { id: 's2', title: 'Parse WhatsApp order from Store-007', agent: 'order', lastMessage: 'Parse: 3 cases Amul butter, 10 Maggi', timestamp: new Date(Date.now() - 7200000), messageCount: 2 },
  { id: 's3', title: 'Cold call coaching session', agent: 'coach', lastMessage: 'Simulate cold call scenario', timestamp: new Date(Date.now() - 86400000), messageCount: 6 },
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const SparkleIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" /></svg>
);
const SendIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
);
const DocumentIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
);
const PlusIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
);

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function AIChatPage() {
  const [activeAgent, setActiveAgent] = useState<AgentType>('analytics');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory] = useState<ChatSession[]>(INITIAL_HISTORY);
  const [showHistory, setShowHistory] = useState(true);
  const [showRAG, setShowRAG] = useState(false);
  const [ragChunks, setRagChunks] = useState<RAGChunk[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const genId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: ChatMessage = { id: genId(), role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    const delay = 1000 + Math.random() * 1500;
    setTimeout(() => {
      const responses = MOCK_RESPONSES[activeAgent];
      const chunks = MOCK_RAG_CHUNKS[Math.floor(Math.random() * MOCK_RAG_CHUNKS.length)];
      const aiMsg: ChatMessage = {
        id: genId(), role: 'assistant', agent: activeAgent,
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(), ragChunks: chunks,
        meta: { model: 'llama3.1:70b', latencyMs: Math.round(delay + Math.random() * 500), tokensUsed: 200 + Math.round(Math.random() * 400), confidence: 0.75 + Math.random() * 0.2 },
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsLoading(false);
    }, delay);
  }, [isLoading, activeAgent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputValue); }
  };

  const isChatEmpty = messages.length === 0;

  // Rendered markdown-like content (simplified)
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{line.replace(/\*\*/g, '')}</p>;
      if (line.startsWith('|')) return <p key={i} className="font-mono text-xs">{line}</p>;
      if (line.startsWith('- ') || line.match(/^\d\./)) return <p key={i} className="ml-3 text-sm">{line}</p>;
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="text-sm leading-relaxed">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
    });
  };

  return (
    <div className="flex h-[calc(100vh-5.5rem)] max-w-full overflow-hidden -m-6">
      {/* Left: Chat History */}
      <div className={cn('flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 flex flex-col transition-all duration-200', showHistory ? 'w-72' : 'w-0 overflow-hidden')}>
        {showHistory && (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">History</h3>
              <button onClick={() => { setMessages([]); setShowRAG(false); setRagChunks([]); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors">
                <PlusIcon /> New
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
              {chatHistory.map((s) => (
                <button key={s.id} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider', AGENTS[s.agent].color)}>{AGENTS[s.agent].label}</span>
                    <span className="text-[10px] text-gray-400">{formatRelativeTime(s.timestamp)}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{s.title}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{s.messageCount} messages</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Center: Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900">
        {/* Agent tabs */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
              <button onClick={() => setShowHistory((v) => !v)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showHistory ? 'M11 19l-7-7 7-7' : 'M13 5l7 7-7 7'} /></svg>
              </button>
              {(Object.keys(AGENTS) as AgentType[]).map((key) => (
                <button key={key} onClick={() => setActiveAgent(key)} className={cn('flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap', activeAgent === key ? cn(AGENTS[key].bg, AGENTS[key].color, 'ring-1 ring-current/20') : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700')}>
                  {AGENTS[key].label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowRAG((v) => !v)} className={cn('flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', showRAG ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700')}>
              <DocumentIcon className="h-3.5 w-3.5" /> Sources
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 pl-9">{AGENTS[activeAgent].description}</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isChatEmpty ? (
            <div className="flex flex-col items-center justify-center h-full px-4 py-8">
              <div className={cn('h-16 w-16 rounded-2xl flex items-center justify-center mb-4', AGENTS[activeAgent].bg)}>
                <SparkleIcon className={cn('h-8 w-8', AGENTS[activeAgent].color)} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{AGENTS[activeAgent].label} Agent</h2>
              <p className="text-sm text-gray-500 mb-6 text-center max-w-md">{AGENTS[activeAgent].description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl w-full">
                {SUGGESTED_PROMPTS[activeAgent].map((prompt, idx) => (
                  <button key={idx} onClick={() => sendMessage(prompt)} className="text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all group">
                    <p className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-snug">{prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg) => msg.role === 'user' ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[70%] bg-primary-600 text-white rounded-2xl rounded-br-md px-4 py-3">
                    <p className="text-sm">{msg.content}</p>
                    <p className="text-[10px] text-primary-200 mt-1">{msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex gap-3">
                  <div className={cn('flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center', AGENTS[msg.agent || activeAgent].bg)}>
                    <SparkleIcon className={cn('h-4 w-4', AGENTS[msg.agent || activeAgent].color)} />
                  </div>
                  <div className="max-w-[80%]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-xs font-semibold', AGENTS[msg.agent || activeAgent].color)}>{AGENTS[msg.agent || activeAgent].label} Agent</span>
                      <span className="text-[10px] text-gray-400">{msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700/60 rounded-2xl rounded-tl-md px-4 py-3 text-gray-800 dark:text-gray-200">
                      {renderContent(msg.content)}
                    </div>
                    {msg.meta && (
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-gray-400 font-mono">{msg.meta.model}</span>
                        <span className="text-[10px] text-gray-400">{msg.meta.latencyMs}ms</span>
                        <span className="text-[10px] text-gray-400">{msg.meta.tokensUsed} tokens</span>
                        <span className={cn('text-[10px] font-semibold', msg.meta.confidence > 0.9 ? 'text-green-500' : msg.meta.confidence > 0.8 ? 'text-blue-500' : 'text-amber-500')}>{(msg.meta.confidence * 100).toFixed(0)}% conf</span>
                        {msg.ragChunks && (
                          <button onClick={() => { setRagChunks(msg.ragChunks!); setShowRAG(true); }} className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline">View sources ({msg.ragChunks.length})</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className={cn('flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center', AGENTS[activeAgent].bg)}>
                    <SparkleIcon className={cn('h-4 w-4 animate-pulse', AGENTS[activeAgent].color)} />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700/60 rounded-2xl rounded-tl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-end gap-3">
            <textarea ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder={`Ask the ${AGENTS[activeAgent].label} Agent...`} rows={1} className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 max-h-32 scrollbar-thin" onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 128) + 'px'; }} />
            <button onClick={() => sendMessage(inputValue)} disabled={!inputValue.trim() || isLoading} className={cn('flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-all', inputValue.trim() && !isLoading ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed')}>
              <SendIcon />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center">Enter to send, Shift+Enter for new line. Powered by Llama 3.1 70B via Ollama.</p>
        </div>
      </div>

      {/* Right: RAG Panel */}
      <div className={cn('flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 flex flex-col transition-all duration-200', showRAG ? 'w-80' : 'w-0 overflow-hidden')}>
        {showRAG && (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <DocumentIcon />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Retrieved Context</h3>
              </div>
              <button onClick={() => setShowRAG(false)} className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {ragChunks.length > 0 ? ragChunks.map((chunk, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50 dark:bg-gray-700/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <DocumentIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{chunk.source}</span>
                    </div>
                    <span className={cn('flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded', chunk.relevance >= 0.9 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : chunk.relevance >= 0.8 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-600/30 dark:text-gray-400')}>{(chunk.relevance * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-4">{chunk.snippet}</p>
                </div>
              )) : (
                <div className="text-center py-12">
                  <DocumentIcon className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 mb-1">No context loaded</p>
                  <p className="text-xs text-gray-400">Click &quot;sources&quot; on any AI response to view context.</p>
                </div>
              )}
            </div>
            {ragChunks.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2.5">
                <p className="text-[10px] text-gray-400 leading-relaxed">Context from Qdrant vector DB via RAG pipeline. Scores indicate cosine similarity.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
