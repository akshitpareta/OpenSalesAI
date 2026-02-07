'use client';

import React, { useState, useMemo } from 'react';
import { cn, formatRelativeTime } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type WfStatus = 'active' | 'paused' | 'error';
type RunStatus = 'success' | 'failed' | 'running';
interface FlowNode { label: string; status: 'completed' | 'pending' }
interface Workflow {
  id: string; name: string; description: string; status: WfStatus;
  trigger_type: 'cron' | 'webhook' | 'triggered';
  schedule: string; last_run: Date; last_run_duration_ms: number;
  success_24h: number; failure_24h: number; recent_runs: number[];
  nodes: FlowNode[];
}
interface RunEntry {
  run_id: string; workflow_id: string; workflow_name: string;
  started_at: string; duration_ms: number; status: RunStatus;
  items_processed: number; error?: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------
const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);

const mockWorkflows: Workflow[] = [
  { id: 'WF-001', name: 'Nightly Data Pipeline', description: 'Pulls transaction data and triggers AI task generation at 2AM IST daily.', status: 'active', trigger_type: 'cron', schedule: '0 2 * * *', last_run: ago(3600000 * 5), last_run_duration_ms: 12400, success_24h: 1, failure_24h: 0, recent_runs: [11200, 12400, 10800, 13100, 11700, 12000, 11500, 12800], nodes: [{ label: 'Cron Trigger', status: 'completed' }, { label: 'Fetch Transactions', status: 'completed' }, { label: 'Generate Tasks', status: 'completed' }, { label: 'Distribute Tasks', status: 'completed' }, { label: 'Log Completion', status: 'completed' }] },
  { id: 'WF-002', name: 'Task Generation', description: 'AI generates personalized tasks for each rep based on store history.', status: 'active', trigger_type: 'triggered', schedule: 'Triggered by WF-001', last_run: ago(3600000 * 5), last_run_duration_ms: 45200, success_24h: 1, failure_24h: 0, recent_runs: [42000, 45200, 43100, 46800, 44300, 45000, 43500, 46200], nodes: [{ label: 'Receive Trigger', status: 'completed' }, { label: 'Load Store Data', status: 'completed' }, { label: 'RAG Retrieval', status: 'completed' }, { label: 'LLM Generate', status: 'completed' }, { label: 'Validate Tasks', status: 'completed' }, { label: 'Write to DB', status: 'completed' }] },
  { id: 'WF-003', name: 'Task Distribution', description: 'Sends task summaries to reps via WhatsApp at 7AM IST.', status: 'active', trigger_type: 'cron', schedule: '0 7 * * *', last_run: ago(3600000 * 2), last_run_duration_ms: 8300, success_24h: 1, failure_24h: 0, recent_runs: [7800, 8300, 8100, 7500, 8600, 7900, 8200, 8400], nodes: [{ label: 'Cron Trigger', status: 'completed' }, { label: 'Get Active Reps', status: 'completed' }, { label: 'Fetch Tasks', status: 'completed' }, { label: 'Format Messages', status: 'completed' }, { label: 'Send WhatsApp', status: 'completed' }] },
  { id: 'WF-004', name: 'WhatsApp Order Processing', description: 'Parses text/voice/image orders from WhatsApp messages in real-time.', status: 'active', trigger_type: 'webhook', schedule: 'Real-time webhook', last_run: ago(180000), last_run_duration_ms: 3200, success_24h: 87, failure_24h: 3, recent_runs: [2800, 3200, 2500, 4100, 3800, 2900, 3500, 3100], nodes: [{ label: 'Webhook', status: 'completed' }, { label: 'Switch Type', status: 'completed' }, { label: 'Parse Order', status: 'completed' }, { label: 'Catalog Match', status: 'completed' }, { label: 'Inventory Check', status: 'completed' }, { label: 'Create Order', status: 'completed' }, { label: 'Send Confirm', status: 'completed' }] },
  { id: 'WF-005', name: 'Voice Order Pipeline', description: 'Audio → Whisper STT → Order parsing for voice-based WhatsApp orders.', status: 'active', trigger_type: 'triggered', schedule: 'Triggered by WF-004', last_run: ago(600000), last_run_duration_ms: 4800, success_24h: 24, failure_24h: 1, recent_runs: [4200, 4800, 3900, 5100, 4500, 4000, 5200, 4600], nodes: [{ label: 'Receive Audio', status: 'completed' }, { label: 'Whisper STT', status: 'completed' }, { label: 'Normalize Text', status: 'completed' }, { label: 'Parse Order', status: 'completed' }, { label: 'Match & Create', status: 'completed' }] },
  { id: 'WF-007', name: 'Task Completion Handler', description: 'Updates task status, calculates incentive points, sends congrats push.', status: 'active', trigger_type: 'webhook', schedule: 'Real-time webhook', last_run: ago(300000), last_run_duration_ms: 1200, success_24h: 18, failure_24h: 0, recent_runs: [1100, 1200, 1000, 1300, 1150, 1050, 1250, 1100], nodes: [{ label: 'Webhook', status: 'completed' }, { label: 'Update Task', status: 'completed' }, { label: 'Calc Points', status: 'completed' }, { label: 'Send Push', status: 'completed' }, { label: 'Update Board', status: 'completed' }] },
  { id: 'WF-009', name: 'Stock-out Alert', description: 'Predicts stock-outs every 4 hours, sends alerts to distributors.', status: 'active', trigger_type: 'cron', schedule: '0 */4 * * *', last_run: ago(7200000), last_run_duration_ms: 6700, success_24h: 6, failure_24h: 0, recent_runs: [6200, 6700, 6400, 7100, 6500, 6800, 6300, 6900], nodes: [{ label: 'Cron Trigger', status: 'completed' }, { label: 'Predict Stockouts', status: 'completed' }, { label: 'Filter >70%', status: 'completed' }, { label: 'Alert Distributors', status: 'completed' }] },
  { id: 'WF-014', name: 'Distributor Sync', description: 'Syncs inventory and pricing data from distributors at 6AM daily.', status: 'paused', trigger_type: 'cron', schedule: '0 6 * * *', last_run: ago(86400000), last_run_duration_ms: 15800, success_24h: 0, failure_24h: 0, recent_runs: [14200, 15800, 14500, 16200, 15100, 14800, 15500, 16000], nodes: [{ label: 'Cron Trigger', status: 'completed' }, { label: 'Fetch Inventory', status: 'completed' }, { label: 'Update Catalog', status: 'completed' }, { label: 'Sync Pricing', status: 'pending' }, { label: 'Log Results', status: 'pending' }] },
  { id: 'WF-015', name: 'Manager Daily Digest', description: 'Sends daily summary email/WhatsApp to managers at 8PM IST.', status: 'active', trigger_type: 'cron', schedule: '0 20 * * *', last_run: ago(3600000 * 12), last_run_duration_ms: 5400, success_24h: 1, failure_24h: 0, recent_runs: [5000, 5400, 5200, 4800, 5600, 5100, 5300, 5500], nodes: [{ label: 'Cron Trigger', status: 'completed' }, { label: 'Fetch Summary', status: 'completed' }, { label: 'Build Template', status: 'completed' }, { label: 'Send Email', status: 'completed' }, { label: 'Send WhatsApp', status: 'completed' }] },
];

const mockRunHistory: RunEntry[] = Array.from({ length: 20 }, (_, i) => {
  const wf = mockWorkflows[i % mockWorkflows.length];
  const isFailed = i === 5 || i === 13;
  const isRunning = i === 0;
  return {
    run_id: `run-${String(1000 + i).padStart(4, '0')}`,
    workflow_id: wf.id,
    workflow_name: wf.name,
    started_at: ago(i * 900000 + Math.random() * 300000).toISOString(),
    duration_ms: isRunning ? 0 : 800 + Math.round(Math.random() * 10000),
    status: isRunning ? 'running' : isFailed ? 'failed' : 'success',
    items_processed: isRunning ? 0 : 1 + Math.round(Math.random() * 50),
    error: isFailed ? (i === 5 ? 'ECONNREFUSED: AI service unreachable at localhost:8000 — task generation failed after 3 retries' : 'Timeout: WhatsApp API response exceeded 30s threshold for batch message delivery') : undefined,
  };
});

const scheduleTimeline = [
  { workflow_id: 'WF-001', name: 'Nightly Pipeline', hours: [2], color: 'bg-blue-500' },
  { workflow_id: 'WF-003', name: 'Task Distribution', hours: [7], color: 'bg-green-500' },
  { workflow_id: 'WF-014', name: 'Distributor Sync', hours: [6], color: 'bg-gray-400' },
  { workflow_id: 'WF-009', name: 'Stock-out Alert', hours: [0, 4, 8, 12, 16, 20], color: 'bg-amber-500' },
  { workflow_id: 'WF-015', name: 'Manager Digest', hours: [20], color: 'bg-purple-500' },
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const PlayIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (<svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>);
const CheckIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const XIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const RefreshIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>);
const ChevronDown = ({ className = 'h-4 w-4' }: { className?: string }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);

const formatDuration = (ms: number) => ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}m`;
const formatTimeIST = (ts: string) => new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' });

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const Sparkline: React.FC<{ runs: number[] }> = ({ runs }) => {
  const max = Math.max(...runs);
  return (
    <div className="flex items-end gap-[2px] h-6">
      {runs.map((v, i) => (<div key={i} className="w-1.5 rounded-t-sm bg-primary-400 dark:bg-primary-500 opacity-70" style={{ height: `${(v / max) * 100}%` }} />))}
    </div>
  );
};

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: () => void }> = ({ enabled, onChange }) => (
  <button onClick={(e) => { e.stopPropagation(); onChange(); }} className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', enabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600')}>
    <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform', enabled ? 'translate-x-4.5 ml-[18px]' : 'translate-x-0.5 ml-[2px]')} />
  </button>
);

const FlowVisualization: React.FC<{ nodes: FlowNode[] }> = ({ nodes }) => (
  <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin py-4">
    {nodes.map((node, idx) => (
      <React.Fragment key={idx}>
        <div className={cn('flex-shrink-0 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors', node.status === 'completed' ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400')}>
          <div className="flex items-center gap-2">
            {node.status === 'completed' ? <CheckIcon className="h-3.5 w-3.5 text-green-500" /> : <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 dark:border-gray-500" />}
            {node.label}
          </div>
        </div>
        {idx < nodes.length - 1 && (
          <svg className="h-4 w-6 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 16"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 8h16m0 0l-4-4m4 4l-4 4" /></svg>
        )}
      </React.Fragment>
    ))}
  </div>
);

const RunStatusBadge: React.FC<{ status: RunStatus }> = ({ status }) => {
  const cfg = { success: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' }, failed: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' }, running: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500 animate-pulse' } }[status];
  return <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}><span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function WorkflowsPage() {
  const [selectedWf, setSelectedWf] = useState<string | null>(null);
  const [toggleState, setToggleState] = useState<Record<string, boolean>>(() => Object.fromEntries(mockWorkflows.map((w) => [w.id, w.status !== 'paused'])));
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | RunStatus>('all');

  const stats = useMemo(() => {
    const active = mockWorkflows.filter((w) => w.status === 'active').length;
    const total = mockRunHistory.length;
    const ok = mockRunHistory.filter((r) => r.status === 'success').length;
    const fail = mockRunHistory.filter((r) => r.status === 'failed').length;
    const rate = total > 0 ? ((ok / (ok + fail)) * 100).toFixed(1) : '100.0';
    const done = mockRunHistory.filter((r) => r.duration_ms > 0);
    const avg = done.length > 0 ? (done.reduce((s, r) => s + r.duration_ms, 0) / done.length / 1000).toFixed(1) : '0.0';
    return { active, total, rate, avg };
  }, []);

  const selected = useMemo(() => mockWorkflows.find((w) => w.id === selectedWf) ?? null, [selectedWf]);
  const filteredRuns = useMemo(() => filterStatus === 'all' ? mockRunHistory : mockRunHistory.filter((r) => r.status === filterStatus), [filterStatus]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="page-title">Workflow Monitoring</h1><p className="page-subtitle">n8n automation workflows, schedules, and execution history</p></div>
        <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"><RefreshIcon />Refresh Status</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card card-padding text-center"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Workflows</p><p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.active}</p></div>
        <div className="card card-padding text-center"><p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Runs Today</p><p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{stats.total}</p></div>
        <div className="card card-padding text-center"><p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Success Rate</p><p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{stats.rate}%</p></div>
        <div className="card card-padding text-center"><p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Avg Execution</p><p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{stats.avg}s</p></div>
      </div>

      {/* Workflow cards */}
      <div><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Workflows</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mockWorkflows.map((wf) => (
            <div key={wf.id} className={cn('card card-padding cursor-pointer transition-all hover:shadow-md', selectedWf === wf.id && 'ring-2 ring-primary-500')} onClick={() => setSelectedWf(selectedWf === wf.id ? null : wf.id)}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-400">{wf.id}</span>
                    <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full', wf.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : wf.status === 'paused' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')}>{wf.status}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{wf.name}</h3>
                </div>
                <ToggleSwitch enabled={toggleState[wf.id] ?? true} onChange={() => setToggleState((p) => ({ ...p, [wf.id]: !p[wf.id] }))} />
              </div>
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{wf.description}</p>
              <div className="mb-3"><span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg', wf.trigger_type === 'cron' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : wf.trigger_type === 'webhook' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300' : 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400')}>{wf.trigger_type === 'cron' ? `Cron: ${wf.schedule}` : wf.schedule}</span></div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3"><span>Last: {formatRelativeTime(wf.last_run)}</span><span>{formatDuration(wf.last_run_duration_ms)}</span></div>
              <div className="flex items-end justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-xs"><CheckIcon className="h-3.5 w-3.5 text-green-500" /><span className="font-medium text-gray-700 dark:text-gray-300">{wf.success_24h}</span></span>
                  {wf.failure_24h > 0 && <span className="inline-flex items-center gap-1 text-xs"><XIcon className="h-3.5 w-3.5 text-red-500" /><span className="font-medium text-red-600">{wf.failure_24h}</span></span>}
                  <span className="text-[10px] text-gray-400">(24h)</span>
                </div>
                <Sparkline runs={wf.recent_runs} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Flow viz */}
      {selected && (
        <div className="card card-padding animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selected.id}: {selected.name} — Flow</h2><p className="text-xs text-gray-500 mt-0.5">Node execution from last run. Green = completed, gray = pending.</p></div>
            <button onClick={() => setSelectedWf(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XIcon className="h-5 w-5" /></button>
          </div>
          <FlowVisualization nodes={selected.nodes} />
        </div>
      )}

      {/* Schedule timeline */}
      <div className="card card-padding">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Daily Schedule Timeline</h2>
        <p className="text-xs text-gray-500 mb-4">Cron-triggered workflows across 24h IST.</p>
        <div className="overflow-x-auto scrollbar-thin"><div className="min-w-[640px]">
          <div className="flex mb-1">{Array.from({ length: 24 }, (_, i) => (<div key={i} className="flex-1 text-center text-[10px] text-gray-400 font-mono">{String(i).padStart(2, '0')}</div>))}</div>
          <div className="space-y-1.5">
            {scheduleTimeline.map((slot) => (
              <div key={slot.workflow_id} className="flex items-center gap-3">
                <span className="text-[11px] text-gray-600 dark:text-gray-400 w-32 truncate flex-shrink-0 text-right">{slot.name}</span>
                <div className="flex flex-1 h-5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden relative">
                  {slot.hours.map((h) => (<div key={h} className={cn('absolute top-0 h-full rounded-full opacity-80', slot.color)} style={{ left: `${(h / 24) * 100}%`, width: `${Math.max(100 / 24, 2)}%` }} title={`${slot.name} at ${String(h).padStart(2, '0')}:00 IST`} />))}
                </div>
              </div>
            ))}
          </div>
        </div></div>
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          {scheduleTimeline.map((s) => (<div key={s.workflow_id} className="flex items-center gap-1.5"><div className={cn('h-2.5 w-2.5 rounded-full', s.color)} /><span className="text-[11px] text-gray-500">{s.name}</span></div>))}
        </div>
      </div>

      {/* Run history */}
      <div className="card">
        <div className="card-padding border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Run History</h2><p className="text-xs text-gray-500 mt-0.5">{filteredRuns.length} runs</p></div>
            <div className="flex items-center gap-2">
              {(['all', 'success', 'failed', 'running'] as const).map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)} className={cn('px-2.5 py-1 text-xs font-medium rounded-md transition-colors', filterStatus === s ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700')}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Run ID</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Workflow</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Started</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Details</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filteredRuns.map((run) => (
                <React.Fragment key={run.run_id}>
                  <tr className={cn('hover:bg-gray-50 dark:hover:bg-gray-800/50', run.status === 'failed' && 'bg-red-50/50 dark:bg-red-900/10')}>
                    <td className="py-3 px-4 font-mono text-xs text-gray-600 dark:text-gray-400">{run.run_id}</td>
                    <td className="py-3 px-4"><span className="text-[10px] font-mono text-gray-400 mr-2">{run.workflow_id}</span><span className="font-medium text-gray-900 dark:text-gray-100">{run.workflow_name}</span></td>
                    <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">{formatTimeIST(run.started_at)}</td>
                    <td className="py-3 px-4 text-xs font-medium whitespace-nowrap">{run.status === 'running' ? <span className="text-blue-600">In progress...</span> : formatDuration(run.duration_ms)}</td>
                    <td className="py-3 px-4"><RunStatusBadge status={run.status} /></td>
                    <td className="py-3 px-4 text-right text-xs font-medium">{run.items_processed > 0 ? run.items_processed : '--'}</td>
                    <td className="py-3 px-4 text-center">{run.error ? <button onClick={(e) => { e.stopPropagation(); setExpandedRun(expandedRun === run.run_id ? null : run.run_id); }} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">Error <ChevronDown className={cn('h-3 w-3 transition-transform', expandedRun === run.run_id && 'rotate-180')} /></button> : run.status === 'running' ? <span className="text-xs text-gray-400">--</span> : <CheckIcon className="h-4 w-4 text-green-500 mx-auto" />}</td>
                  </tr>
                  {run.error && expandedRun === run.run_id && (
                    <tr className="bg-red-50/70 dark:bg-red-900/15"><td colSpan={7} className="px-4 py-3"><div className="flex items-start gap-2"><XIcon className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" /><p className="text-xs text-red-700 dark:text-red-300">{run.error}</p></div></td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
