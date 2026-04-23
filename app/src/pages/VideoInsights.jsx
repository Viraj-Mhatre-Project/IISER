import { useEffect, useState } from 'react';
import { Search, Bell, Activity, Play, FileText, BarChart2, ChevronDown, X, Car, Gauge, Clock, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const API = 'http://localhost:8000';

function StatCard({ icon: Icon, label, value, unit = '', color = 'blue' }) {
  const colors = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', icon: 'text-blue-400' },
    green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: 'text-emerald-400' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: 'text-amber-400' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', icon: 'text-red-400' },
  };
  const c = colors[color];
  return (
    <div className={`glass-card rounded-xl p-4 border ${c.border} ${c.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={c.icon} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
      <p className={`text-2xl font-extrabold tabular-nums ${c.text}`}>
        {value}<span className="text-sm font-bold text-zinc-500 ml-1">{unit}</span>
      </p>
    </div>
  );
}

function PreviewModal({ src, onClose }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-10 right-0 text-zinc-400 hover:text-white flex items-center gap-1 text-sm">
          <X size={16} /> Close
        </button>
        <video src={src} controls autoPlay className="w-full rounded-xl border border-white/10" />
      </div>
    </div>
  );
}

export default function VideoInsights() {
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runDetail, setRunDetail] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [videoModal, setVideoModal] = useState(false);
  const [search, setSearch] = useState('');

  // Load all runs for the selector
  useEffect(() => {
    fetch(`${API}/api/runs`)
      .then(r => r.json())
      .then(d => {
        const list = d.runs ?? [];
        setRuns(list);
        setLoadingRuns(false);
        // Auto-select the most recent run
        if (list.length > 0) setSelectedRun(list[0]);
      })
      .catch(() => setLoadingRuns(false));
  }, []);

  // Load detail + CSV when a run is selected
  useEffect(() => {
    if (!selectedRun) return;
    setLoadingDetail(true);
    setCsvData([]);

    // Fetch run detail
    fetch(`${API}/api/runs/${selectedRun.run_id}`)
      .then(r => r.json())
      .then(d => { setRunDetail(d); setLoadingDetail(false); })
      .catch(() => setLoadingDetail(false));

    // Fetch CSV if available
    if (selectedRun.csv_path) {
      fetch(`${API}/api/file/${selectedRun.run_id}/log.csv`)
        .then(r => r.text())
        .then(text => {
          const lines = text.trim().split('\n');
          if (lines.length < 2) return;
          const headers = lines[0].split(',');
          const rows = lines.slice(1).map(line => {
            const vals = line.split(',');
            return Object.fromEntries(headers.map((h, i) => [h.trim(), vals[i]?.trim() ?? '']));
          });
          setCsvData(rows);
        })
        .catch(() => { });
    }
  }, [selectedRun]);

  const videoUrl = selectedRun ? `${API}/api/file/${selectedRun.run_id}/output.mp4` : null;
  const graphUrl = selectedRun ? `${API}/api/file/${selectedRun.run_id}/speed_graph.png` : null;
  const csvUrl = selectedRun ? `${API}/api/file/${selectedRun.run_id}/log.csv` : null;

  const run = runDetail ?? selectedRun;

  const filteredCsv = csvData.filter(row =>
    Object.values(row).some(v => v.toLowerCase().includes(search.toLowerCase()))
  );

  const formatDate = (ts) => ts
    ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {videoModal && videoUrl && <PreviewModal src={videoUrl} onClose={() => setVideoModal(false)} />}

      {/* Header */}
      <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="relative w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter log table…"
            className="w-full bg-white/5 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex items-center gap-6">
          <div className="w-px h-4 bg-white/10" />
          <button className="text-zinc-500 hover:text-white"><Bell size={18} /></button>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <span className="text-xs text-white">V</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 animate-in fade-in duration-500">

        {/* Page title + Run selector */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Video Insights</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Detailed telemetry for a processed run</p>
          </div>

          {/* Run dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass-card border border-white/10 text-sm text-white font-bold hover:border-white/20 transition min-w-[220px] justify-between">
              <span className="truncate">{selectedRun ? selectedRun.run_id : 'Select a run…'}</span>
              <ChevronDown size={14} className={`text-zinc-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 glass-card border border-white/10 rounded-xl overflow-hidden z-20 shadow-2xl max-h-72 overflow-y-auto">
                {loadingRuns ? (
                  <p className="text-xs text-zinc-500 p-4">Loading runs…</p>
                ) : runs.length === 0 ? (
                  <p className="text-xs text-zinc-500 p-4">No runs found.</p>
                ) : runs.map(r => (
                  <button key={r.run_id}
                    onClick={() => { setSelectedRun(r); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-3 text-sm transition hover:bg-white/5 border-b border-white/5 last:border-0 ${selectedRun?.run_id === r.run_id ? 'text-primary bg-primary/5' : 'text-zinc-300'}`}>
                    <p className="font-bold">{r.run_id}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{formatDate(r.timestamp)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Empty state */}
        {!selectedRun && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-8 border border-white/5">
              <Activity size={36} className="text-zinc-500" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-4">No run selected</h2>
            <p className="text-zinc-500 max-w-md text-center text-sm mb-10 leading-relaxed">
              Select a run from the dropdown above, or browse the <span className="text-white font-bold">Output Gallery</span>.
            </p>
            <Link to="/gallery"
              className="bg-white/5 hover:bg-white/10 text-zinc-300 font-bold px-6 py-3 rounded-lg transition border border-white/10 text-xs tracking-widest uppercase flex items-center gap-2">
              <Activity size={16} /> Browse Gallery
            </Link>
          </div>
        )}

        {selectedRun && (
          <div className="space-y-6">

            {/* Stat cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard icon={Car} label="Total Vehicles" value={run?.total_vehicles ?? '—'} color="blue" />
              <StatCard icon={Gauge} label="Avg Speed" value={run?.avg_speed ?? '—'} unit="km/h" color="green" />
              <StatCard icon={TrendingUp} label="Max Speed" value={run?.max_speed ?? '—'} unit="km/h" color="amber" />
              <StatCard icon={Clock} label="Speed Limit" value={run?.speed_limit ?? 60} unit="km/h" color={run?.max_speed > (run?.speed_limit ?? 60) ? 'red' : 'blue'} />
            </div>

            {/* Video + Graph row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

              {/* Video panel */}
              <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <p className="text-xs font-bold text-white uppercase tracking-widest">Output Video</p>
                  <div className="flex gap-2">
                    {videoUrl && (
                      <button onClick={() => setVideoModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold border border-primary/20 transition">
                        <Play size={11} fill="currentColor" /> Fullscreen
                      </button>
                    )}
                    {videoUrl && (
                      <a href={videoUrl} download
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-[10px] font-bold border border-white/10 transition">
                        Download
                      </a>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  {videoUrl ? (
                    <video src={videoUrl} controls
                      className="w-full rounded-xl border border-white/5"
                      style={{ maxHeight: 280, background: '#000' }} />
                  ) : (
                    <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">No video available</div>
                  )}
                </div>
              </div>

              {/* Speed graph panel */}
              <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <p className="text-xs font-bold text-white uppercase tracking-widest">Speed Distribution</p>
                  {graphUrl && (
                    <a href={graphUrl} download
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-[10px] font-bold border border-white/10 transition">
                      <BarChart2 size={11} /> Download
                    </a>
                  )}
                </div>
                <div className="p-4">
                  {graphUrl ? (
                    <img src={graphUrl} alt="Speed distribution"
                      className="w-full rounded-xl border border-white/5"
                      style={{ maxHeight: 280, objectFit: 'contain' }} />
                  ) : (
                    <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">No graph available</div>
                  )}
                </div>
              </div>
            </div>

            {/* CSV Log table */}
            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-white uppercase tracking-widest">Vehicle Log</p>
                  <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-bold text-zinc-500 border border-white/5">
                    {filteredCsv.length} records
                  </span>
                </div>
                {csvUrl && (
                  <a href={csvUrl} download
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-[10px] font-bold border border-white/10 transition">
                    <FileText size={11} /> Export CSV
                  </a>
                )}
              </div>

              {loadingDetail ? (
                <div className="p-8 text-center text-zinc-500 text-sm">Loading…</div>
              ) : filteredCsv.length === 0 ? (
                <div className="p-8 text-center text-zinc-600 text-sm">
                  {csvData.length === 0 ? 'No vehicle log available for this run.' : 'No records match your filter.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        {Object.keys(filteredCsv[0]).map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCsv.map((row, i) => {
                        const speed = parseFloat(row['Speed_kmh'] ?? 0);
                        const limit = run?.speed_limit ?? 60;
                        const isOver = speed > limit;
                        return (
                          <tr key={i} className={`border-b border-white/5 last:border-0 transition-colors ${isOver ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/3'}`}>
                            {Object.entries(row).map(([k, v]) => (
                              <td key={k} className={`px-4 py-2.5 whitespace-nowrap tabular-nums ${k === 'Speed_kmh' && isOver ? 'text-red-400 font-bold' : 'text-zinc-300'}`}>
                                {v}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}