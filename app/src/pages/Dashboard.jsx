import { useEffect, useState } from 'react';
import { Play, FileVideo, Car, AlertTriangle, Gauge, Inbox, ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const API = 'http://localhost:8000';

function StatCard({ title, value, icon: Icon, unit = '', loading }) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{title}</h3>
        <Icon size={18} className="text-zinc-400" />
      </div>
      <div className="flex items-baseline gap-2">
        {loading ? (
          <div className="h-9 w-16 rounded-md bg-white/5 animate-pulse" />
        ) : (
          <>
            <span className="text-4xl font-bold text-white">{value ?? '—'}</span>
            {unit && <span className="text-sm font-semibold text-zinc-500">{unit}</span>}
          </>
        )}
      </div>
    </div>
  );
}

function RecentRunRow({ run }) {
  const date = run.timestamp
    ? new Date(run.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';
  const overspeed = run.max_speed > (run.speed_limit ?? 60);

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <FileVideo size={15} className="text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{run.run_id}</p>
          <p className="text-[10px] text-zinc-500">{date}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 ml-4">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-white">{run.total_vehicles}</p>
          <p className="text-[9px] text-zinc-500 uppercase">Vehicles</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-white">{run.avg_speed} <span className="text-xs text-zinc-500">km/h</span></p>
          <p className="text-[9px] text-zinc-500 uppercase">Avg</p>
        </div>
        {overspeed ? (
          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
            Overspeed
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            OK
          </span>
        )}
        <Link to="/gallery" className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight size={15} className="text-zinc-400" />
        </Link>
      </div>
    </div>
  );
}

function SpeedSummaryCard({ runs }) {
  if (!runs.length) return (
    <div className="glass-card rounded-2xl h-full flex flex-col items-center justify-center p-8 text-center gap-3">
      <TrendingUp size={28} className="text-zinc-600" />
      <p className="text-xs text-zinc-500 font-medium">Speed analytics will appear after your first run.</p>
    </div>
  );

  const maxSpeeds = runs.map(r => r.max_speed).filter(Boolean);
  const overCount = runs.filter(r => r.max_speed > (r.speed_limit ?? 60)).length;
  const globalMax = maxSpeeds.length ? Math.max(...maxSpeeds) : 0;
  const globalAvg = runs.reduce((a, r) => a + (r.avg_speed ?? 0), 0) / runs.length;

  return (
    <div className="glass-card rounded-2xl p-5 h-full flex flex-col gap-4">
      <h2 className="text-sm font-bold text-white">Speed Summary</h2>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Global Max', value: `${globalMax} km/h`, color: 'text-red-400' },
          { label: 'Fleet Avg', value: `${globalAvg.toFixed(1)} km/h`, color: 'text-blue-400' },
          { label: 'Overspeed Runs', value: overCount, color: 'text-amber-400' },
          { label: 'Total Runs', value: runs.length, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl bg-white/5 p-3 border border-white/5">
            <p className={`text-xl font-extrabold ${color}`}>{value}</p>
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Mini speed bar chart (last 5 runs) */}
      <div className="mt-auto">
        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-2">Max speed — last 5 runs</p>
        <div className="flex items-end gap-1.5 h-14">
          {runs.slice(0, 5).reverse().map((r, i) => {
            const pct = globalMax > 0 ? (r.max_speed / globalMax) * 100 : 0;
            const over = r.max_speed > (r.speed_limit ?? 60);
            return (
              <div key={r.run_id} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-sm transition-all duration-500"
                  style={{ height: `${Math.max(4, pct * 0.52)}px`, background: over ? '#f87171' : '#3b82f6', opacity: 0.85 }} />
                <span className="text-[8px] text-zinc-600 tabular-nums">{r.max_speed}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/stats`)
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const recentRuns = stats?.recent_runs ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-card border border-white/5 shadow-2xl p-10 h-[300px] flex flex-col justify-center">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-black opacity-80 z-0" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/20">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-bold text-success uppercase tracking-widest">System Online</span>
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tight">
            Camera Based Vehicle Speed Detection
          </h1>
          <div className="flex gap-4 pt-4">
            <Link to="/upload"
              className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-blue-600 text-white font-semibold rounded-lg shadow-lg shadow-primary/25 transition">
              <Play size={18} fill="currentColor" /> Process New Video
            </Link>
            <Link to="/gallery"
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-lg border border-white/10 transition">
              View Gallery
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard title="Total Videos Processed" value={stats?.total_videos} icon={FileVideo} loading={loading} />
        <StatCard title="Total Vehicles Detected" value={stats?.total_vehicles} icon={Car} loading={loading} />
        <StatCard title="Overspeed Violations" value={stats?.overspeed_violations} icon={AlertTriangle} loading={loading} />
        <StatCard title="Avg Speed Observed" value={stats?.avg_speed || '—'} unit={stats?.avg_speed ? 'KM/H' : ''} icon={Gauge} loading={loading} />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-3 gap-6">

        {/* Recent Runs (2 cols) */}
        <div className="col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">⏱</span>
              <h2 className="text-lg font-bold text-white">Recent Processed Runs</h2>
            </div>
            {recentRuns.length > 0 && (
              <Link to="/gallery" className="text-xs font-bold text-zinc-500 hover:text-primary flex items-center gap-1 transition-colors">
                View all <ArrowRight size={13} />
              </Link>
            )}
          </div>

          <div className="glass-card rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-8 flex flex-col gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : recentRuns.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                  <Inbox size={32} className="text-zinc-600" />
                </div>
                <p className="text-zinc-400 font-medium">No runs yet. Upload a video to get started.</p>
                <Link to="/upload" className="mt-4 text-xs font-bold text-primary hover:underline">Upload now →</Link>
              </div>
            ) : (
              <div className="py-2">
                {recentRuns.map(run => <RecentRunRow key={run.run_id} run={run} />)}
              </div>
            )}
          </div>
        </div>

        {/* Speed Summary (1 col) */}
        <div className="flex flex-col" style={{ minHeight: 300 }}>
          <SpeedSummaryCard runs={recentRuns} />
        </div>

      </div>
    </div>
  );
}