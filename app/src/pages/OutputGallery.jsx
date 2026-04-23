import { useEffect, useState } from 'react';
import { Search, Filter, Bell, UploadCloud, Play, FileText, BarChart2, Download, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const API = 'http://localhost:8000';

function Badge({ children, color = 'zinc' }) {
  const colors = {
    zinc: 'bg-white/5 text-zinc-400 border-white/10',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${colors[color]}`}>
      {children}
    </span>
  );
}

function StatPill({ label, value, unit = '' }) {
  return (
    <div className="text-center">
      <p className="text-lg font-extrabold text-white tabular-nums">
        {value}<span className="text-xs text-zinc-500 ml-0.5">{unit}</span>
      </p>
      <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-wider">{label}</p>
    </div>
  );
}

function PreviewModal({ src, type, onClose }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-10 right-0 text-zinc-400 hover:text-white flex items-center gap-1 text-sm">
          <X size={16} /> Close
        </button>
        {type === 'video' ? (
          <video src={src} controls autoPlay className="w-full rounded-xl border border-white/10" />
        ) : (
          <img src={src} alt="Speed graph" className="w-full rounded-xl border border-white/10" />
        )}
      </div>
    </div>
  );
}

function DeleteConfirmModal({ runId, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="glass-card rounded-2xl border border-white/10 p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Delete Run</p>
            <p className="text-[10px] text-zinc-500">{runId}</p>
          </div>
        </div>
        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          This will permanently delete all output files for this run including the video, CSV log, and speed graph. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold border border-white/10 transition-all">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function RunCard({ run, onDeleted }) {
  const [preview, setPreview] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const videoUrl = run.video_path ? `${API}/api/file/${run.run_id}/output.mp4` : null;
  const csvUrl = run.csv_path ? `${API}/api/file/${run.run_id}/log.csv` : null;
  const graphUrl = run.graph_path ? `${API}/api/file/${run.run_id}/speed_graph.png` : null;

  const date = run.timestamp
    ? new Date(run.timestamp).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    : '—';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`${API}/api/runs/${run.run_id}`, { method: 'DELETE' });
      onDeleted(run.run_id);
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      {preview && <PreviewModal {...preview} onClose={() => setPreview(null)} />}
      {confirmDelete && (
        <DeleteConfirmModal
          runId={run.run_id}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-all">
        {/* Top bar */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">{run.run_id}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{date}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge color="green">Complete</Badge>
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="w-7 h-7 rounded-lg bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 hover:border-red-500/30 flex items-center justify-center transition-all group"
              title="Delete run">
              <Trash2 size={13} className="text-red-500/40 group-hover:text-red-400 transition-colors" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="px-5 py-4 grid grid-cols-4 gap-4 border-b border-white/5">
          <StatPill label="Vehicles" value={run.total_vehicles} />
          <StatPill label="Avg speed" value={run.avg_speed} unit="km/h" />
          <StatPill label="Max speed" value={run.max_speed} unit="km/h" />
          <StatPill label="Limit" value={run.speed_limit ?? 60} unit="km/h" />
        </div>

        {/* Graph thumbnail */}
        {graphUrl && (
          <div className="px-5 py-3 border-b border-white/5 cursor-pointer"
            onClick={() => setPreview({ src: graphUrl, type: 'image' })}>
            <img src={graphUrl} alt="Speed distribution"
              className="w-full rounded-lg opacity-80 hover:opacity-100 transition-opacity"
              style={{ maxHeight: 120, objectFit: 'cover' }} />
          </div>
        )}

        {/* Actions */}
        <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
          {videoUrl && (
            <button onClick={() => setPreview({ src: videoUrl, type: 'video' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold border border-primary/20 transition-all">
              <Play size={13} fill="currentColor" /> Play Video
            </button>
          )}
          {csvUrl && (
            <a href={csvUrl} download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold border border-white/10 transition-all">
              <FileText size={13} /> CSV Log
            </a>
          )}
          {graphUrl && (
            <a href={graphUrl} download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold border border-white/10 transition-all">
              <BarChart2 size={13} /> Graph
            </a>
          )}
          {videoUrl && (
            <a href={videoUrl} download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold border border-white/10 transition-all">
              <Download size={13} /> Download
            </a>
          )}
        </div>
      </div>
    </>
  );
}

const PAGE_SIZE = 6;

export default function OutputGallery() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('latest');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(`${API}/api/runs`)
      .then(r => r.json())
      .then(d => { setRuns(d.runs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDeleted = (run_id) => {
    setRuns(prev => prev.filter(r => r.run_id !== run_id));
  };

  const filtered = runs
    .filter(r => r.run_id?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ta = new Date(a.timestamp ?? 0).getTime();
      const tb = new Date(b.timestamp ?? 0).getTime();
      return sortOrder === 'latest' ? tb - ta : ta - tb;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="relative w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search runs…"
            className="w-full bg-white/5 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex items-center gap-6 text-sm font-bold text-zinc-400">
          <div className="w-px h-4 bg-white/10 ml-2" />
          <button className="text-zinc-500 hover:text-white"><Bell size={18} /></button>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <span className="text-xs text-white">V</span>
          </div>
        </div>
      </header>

      <div className="flex-1 p-8 max-w-7xl mx-auto w-full flex flex-col animate-in fade-in duration-500">
        {/* Page header */}
        <div className="flex justify-between items-end mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Output Gallery</h1>
            <span className="px-2 py-1 rounded-md bg-white/10 text-[10px] font-bold tracking-widest text-zinc-400 uppercase border border-white/5">
              {filtered.length} Run{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={() => { setSortOrder(s => s === 'latest' ? 'oldest' : 'latest'); setPage(1); }}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/5 flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition">
            <Filter size={14} /> {sortOrder === 'latest' ? 'LATEST FIRST' : 'OLDEST FIRST'}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">Loading runs…</div>
        ) : paginated.length === 0 ? (
          <div className="flex-1 glass-card rounded-2xl flex flex-col items-center justify-center border-dashed border-2 border-white/5">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
              <UploadCloud size={28} className="text-zinc-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {search ? 'No runs match your search.' : 'No processed videos yet.'}
            </h3>
            <p className="text-zinc-500 max-w-sm text-center text-sm font-medium mb-8">
              {search ? 'Try a different search term.' : 'Upload a data sequence to begin kinetic analysis.'}
            </p>
            {!search && (
              <Link to="/upload"
                className="bg-primary/20 hover:bg-primary/30 text-primary font-bold px-6 py-3 rounded-lg transition-colors border border-primary/20 text-sm tracking-wider uppercase">
                Begin Upload
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {paginated.map(run => <RunCard key={run.run_id} run={run} onDeleted={handleDeleted} />)}
          </div>
        )}

        {/* Pagination */}
        {!loading && paginated.length > 0 && (
          <div className="mt-6 flex justify-between items-center text-xs font-bold text-zinc-600">
            <span>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} results
            </span>
            <div className="flex gap-2 items-center">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="w-8 h-8 rounded bg-white/5 flex items-center justify-center disabled:opacity-30 hover:bg-white/10 transition">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  className={`w-8 h-8 rounded text-xs font-bold transition ${page === i + 1 ? 'bg-primary text-white' : 'bg-white/5 hover:bg-white/10 text-zinc-400'}`}>
                  {i + 1}
                </button>
              ))}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="w-8 h-8 rounded bg-white/5 flex items-center justify-center disabled:opacity-30 hover:bg-white/10 transition">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}