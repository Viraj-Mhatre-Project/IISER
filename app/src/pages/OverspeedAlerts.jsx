import { useState, useEffect, useCallback } from 'react';
import { Search, Bell, AlertTriangle, Gauge, CarFront, Clock, TrendingUp, X, Play, Settings2, Check, RefreshCw } from 'lucide-react';

const API = 'http://localhost:8000';

// ── helpers ──────────────────────────────────────────────────────────────────
function severityColor(excess) {
  if (excess >= 40) return { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', badge: 'bg-rose-500' };
  if (excess >= 20) return { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', badge: 'bg-orange-500' };
  return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', badge: 'bg-yellow-500' };
}

function severityLabel(excess) {
  if (excess >= 40) return 'CRITICAL';
  if (excess >= 20) return 'HIGH';
  return 'MODERATE';
}

function fmtTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Formats the vehicle identity label:
 *   - "car" / "motorcycle" / "bicycle" → generic  →  "VEHICLE ID: 42"
 *   - anything else (truck, bus, van…) → specific  →  "TRUCK · ID: 42"
 *
 * The class name from YOLO is lowercase (e.g. "truck", "bus", "car").
 */
const GENERIC_CLASSES = new Set(['car', 'motorcycle', 'bicycle', 'motorbike']);

function vehicleLabel(vehicleClass, vehicleId) {
  const cls = (vehicleClass ?? '').toLowerCase().trim();
  if (!cls || GENERIC_CLASSES.has(cls)) {
    return { prefix: 'VEHICLE', id: `ID: ${vehicleId}`, isGeneric: true };
  }
  return { prefix: cls.toUpperCase(), id: `ID: ${vehicleId}`, isGeneric: false };
}

// ── VideoModal ────────────────────────────────────────────────────────────────
function VideoModal({ url, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-4xl mx-4" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-10 right-0 flex items-center gap-1.5 text-sm font-bold text-zinc-400 hover:text-white transition-colors">
          <X size={16} /> Close
        </button>
        <video
          src={`${API}${url}`}
          controls autoPlay
          className="w-full rounded-2xl border border-white/10 bg-black shadow-2xl"
          style={{ maxHeight: '70vh' }}
        />
      </div>
    </div>
  );
}

// ── ViolationCard ─────────────────────────────────────────────────────────────
function ViolationCard({ v, onPlay }) {
  const col = severityColor(v.excess_kmh);
  const label = severityLabel(v.excess_kmh);
  const { prefix, id } = vehicleLabel(v.vehicle_class, v.vehicle_id);

  return (
    <div className={`glass-card rounded-xl p-4 border ${col.border} ${col.bg} flex items-start gap-4 transition-all hover:scale-[1.01]`}>
      {/* Severity stripe */}
      <div className={`shrink-0 mt-0.5 w-2 h-full min-h-[60px] rounded-full ${col.badge} opacity-80`} />

      <div className="flex-1 min-w-0 space-y-2">
        {/* Top row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity badge */}
          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${col.border} ${col.text}`}>
            {label}
          </span>

          {/* Vehicle identity — key change */}
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            {prefix}
            <span className="text-zinc-500 font-semibold"> · {id}</span>
          </span>

          <span className="ml-auto text-[10px] text-zinc-600 font-medium">{fmtTime(v.timestamp)}</span>
        </div>

        {/* Speed row */}
        <div className="flex items-end gap-3">
          <div>
            <p className={`text-3xl font-extrabold tabular-nums leading-none ${col.text}`}>
              {v.speed_kmh}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">km/h recorded</p>
          </div>
          <div className="text-zinc-600 text-lg font-bold pb-1">vs</div>
          <div>
            <p className="text-xl font-bold text-zinc-300 tabular-nums leading-none">{v.speed_limit}</p>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">km/h limit</p>
          </div>
          <div className={`ml-2 px-2 py-1 rounded-lg ${col.border} border text-[11px] font-black tabular-nums ${col.text}`}>
            +{v.excess_kmh} over
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500 font-medium pt-0.5">
          <span className="flex items-center gap-1"><Clock size={10} /> {v.duration_s}s transit</span>
          <span className="flex items-center gap-1"><CarFront size={10} /> Run: {v.run_id}</span>
        </div>
      </div>

      {/* Play button */}
      <button
        onClick={() => onPlay(v.video_url)}
        className="shrink-0 flex flex-col items-center gap-1 group"
        title="Play run video">
        <div className="w-10 h-10 rounded-full bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/40 flex items-center justify-center transition-all group-hover:scale-110">
          <Play size={16} className="text-zinc-400 group-hover:text-primary transition-colors" fill="currentColor" />
        </div>
        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">Video</span>
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OverspeedAlerts() {
  const [violations, setViolations] = useState([]);
  const [speedLimit, setSpeedLimit] = useState(60);
  const [inputLimit, setInputLimit] = useState(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('speed');
  const [videoUrl, setVideoUrl] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, lRes] = await Promise.all([
        fetch(`${API}/api/violations`),
        fetch(`${API}/api/speed-limit`),
      ]);
      const vData = await vRes.json();
      const lData = await lRes.json();
      setViolations(vData.violations ?? []);
      setSpeedLimit(lData.speed_limit ?? 60);
      setInputLimit(lData.speed_limit ?? 60);
    } catch (e) {
      console.error('Failed to load violations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveLimit = async () => {
    if (inputLimit < 10 || inputLimit > 300) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('limit', inputLimit);
      const res = await fetch(`${API}/api/speed-limit`, { method: 'POST', body: fd });
      const data = await res.json();
      setSpeedLimit(data.speed_limit);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await fetchData();
    } catch (e) {
      alert('Error saving speed limit: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = violations
    .filter(v =>
      v.run_id.toLowerCase().includes(search.toLowerCase()) ||
      v.vehicle_class.toLowerCase().includes(search.toLowerCase()) ||
      String(v.vehicle_id).includes(search)
    )
    .sort((a, b) => {
      if (sortBy === 'speed') return b.speed_kmh - a.speed_kmh;
      if (sortBy === 'excess') return b.excess_kmh - a.excess_kmh;
      return (b.timestamp ?? '').localeCompare(a.timestamp ?? '');
    });

  const critical = violations.filter(v => v.excess_kmh >= 40).length;
  const high = violations.filter(v => v.excess_kmh >= 20 && v.excess_kmh < 40).length;
  const avgExcess = violations.length
    ? (violations.reduce((a, v) => a + v.excess_kmh, 0) / violations.length).toFixed(1)
    : 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="relative w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search run, class, vehicle ID…"
            className="w-full bg-white/5 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={fetchData} title="Refresh"
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
            <RefreshCw size={16} />
          </button>
          <button className="text-zinc-500 hover:text-white transition-colors"><Bell size={18} /></button>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <span className="text-xs font-bold">VS</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Page title + speed limit control */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <AlertTriangle size={22} className="text-danger" /> Overspeed Alerts
            </h1>
            <p className="text-zinc-500 text-sm mt-1 font-medium">
              {violations.length} total violation{violations.length !== 1 ? 's' : ''} detected across all processed runs
            </p>
          </div>

          <div className="glass-card rounded-xl p-4 border border-white/10 flex items-center gap-4 min-w-[320px]">
            <div className="flex items-center gap-2">
              <Settings2 size={16} className="text-primary" />
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Speed Limit</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="number" min={10} max={300} value={inputLimit}
                onChange={e => setInputLimit(Number(e.target.value))}
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="text-xs text-zinc-500 font-bold">km/h</span>
              <button onClick={handleSaveLimit} disabled={saving || inputLimit === speedLimit}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-40 ${saved ? 'bg-success/20 text-success border border-success/30' : 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30'}`}>
                {saved ? <><Check size={12} /> Saved</> : saving ? 'Saving…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Violations', value: violations.length, color: 'text-danger', icon: <AlertTriangle size={18} className="text-danger" /> },
            { label: 'Critical (40+ over)', value: critical, color: 'text-rose-400', icon: <TrendingUp size={18} className="text-rose-400" /> },
            { label: 'High (20–39 over)', value: high, color: 'text-orange-400', icon: <Gauge size={18} className="text-orange-400" /> },
            { label: 'Avg Excess Speed', value: `+${avgExcess} km/h`, color: 'text-yellow-400', icon: <CarFront size={18} className="text-yellow-400" /> },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="glass-card rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
                {icon}
              </div>
              <p className={`text-3xl font-extrabold tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Violations list */}
        <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
            <p className="text-xs font-bold text-white">
              {filtered.length} violation{filtered.length !== 1 ? 's' : ''}
              {search && <span className="text-zinc-500"> matching "{search}"</span>}
            </p>
            <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-500">
              <span className="uppercase tracking-wider mr-1">Sort:</span>
              {['speed', 'excess', 'time'].map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-2 py-1 rounded-md uppercase tracking-wider transition-colors ${sortBy === s ? 'bg-primary/20 text-primary' : 'hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  <AlertTriangle size={28} className="text-zinc-600" />
                </div>
                <p className="text-white font-bold text-lg">
                  {violations.length === 0 ? 'No violations detected' : 'No results match your search'}
                </p>
                <p className="text-zinc-500 text-sm mt-1 max-w-xs font-medium">
                  {violations.length === 0
                    ? `No vehicles exceeded ${speedLimit} km/h across all processed runs.`
                    : 'Try adjusting your search filter.'}
                </p>
              </div>
            ) : (
              filtered.map((v, i) => (
                <ViolationCard key={`${v.run_id}-${v.vehicle_id}-${i}`} v={v} onPlay={setVideoUrl} />
              ))
            )}
          </div>
        </div>
      </div>

      {videoUrl && <VideoModal url={videoUrl} onClose={() => setVideoUrl(null)} />}
    </div>
  );
}
