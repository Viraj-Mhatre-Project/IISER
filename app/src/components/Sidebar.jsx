import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UploadCloud, GalleryHorizontal, LineChart, AlertTriangle, LogOut, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../context/AuthContext';
import { useProcessing } from '../context/ProcessingContext';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Upload & Process', path: '/upload', icon: UploadCloud },
  { name: 'Output Gallery', path: '/gallery', icon: GalleryHorizontal },
  { name: 'Video Insights', path: '/insights', icon: LineChart },
  { name: 'Overspeed Alerts', path: '/alerts', icon: AlertTriangle },
];

const STAGE_LABEL = {
  uploading: 'Uploading…',
  downloading: 'Downloading…',
  initializing: 'Initializing…',
  loading_video: 'Loading video…',
  extracting: 'Extracting frames…',
  detecting: 'Detecting…',
  finalizing: 'Finalizing…',
  done: 'Complete!',
};

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isProcessing, isDone, pct, sseState, cancelProcessing } = useProcessing();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const showIndicator = isProcessing || isDone;

  return (
    <div className="w-64 h-screen fixed left-0 top-0 flex flex-col bg-card border-r border-white/5">
      {/* Brand Header */}
      <div className="p-6 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
            <div className="w-4 h-4 bg-primary rounded-sm shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            SpeedSense
          </h1>
        </div>
        <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-widest pl-11"></span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 mt-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
              )}
            >
              <Icon size={18} className={isActive ? "text-primary" : "text-zinc-500 group-hover:text-zinc-300"} />
              {item.name}
              {/* Spinner badge on the Upload nav item while processing */}
              {item.path === '/upload' && isProcessing && (
                <Loader2 size={13} className="ml-auto text-primary animate-spin" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Live Processing Indicator ── */}
      {showIndicator && (
        <div className="mx-4 mb-3 glass-card rounded-xl p-3 border border-primary/20 bg-primary/5">
          <Link to="/upload" className="block">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                {isProcessing && <Loader2 size={11} className="text-primary animate-spin" />}
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  {isDone ? 'Processing Done' : sseState.stage === 'cancelled' ? 'Cancelled' : 'Processing…'}
                </span>
              </div>
              <span className="text-[10px] font-bold tabular-nums"
                style={{ color: isDone ? '#10b981' : sseState.stage === 'cancelled' ? '#f59e0b' : sseState.stage === 'error' ? '#f43f5e' : '#3b82f6' }}>
                {sseState.stage === 'cancelled' ? '—' : `${Math.round(pct)}%`}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  background: isDone
                    ? 'linear-gradient(90deg,#10b981,#34d399)'
                    : sseState.stage === 'cancelled'
                      ? '#f59e0b'
                      : sseState.stage === 'error'
                        ? '#f43f5e'
                        : 'linear-gradient(90deg,#3b82f6,#6366f1)',
                }} />
            </div>
            <p className="text-[9px] text-zinc-500 mt-1.5 font-medium truncate">
              {STAGE_LABEL[sseState.stage] ?? sseState.stage}
              {sseState.total_frames > 0 && isProcessing
                ? ` — ${sseState.processed_frames.toLocaleString()} / ${sseState.total_frames.toLocaleString()} frames`
                : ''}
            </p>
          </Link>

          {/* Cancel button — only while actively processing */}
          {isProcessing && (
            <button
              onClick={cancelProcessing}
              className="mt-2 w-full py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-danger border border-danger/20 bg-danger/5 hover:bg-danger/15 transition-all">
              Stop Processing
            </button>
          )}
        </div>
      )}


      {/* Footer Status */}
      <div className="p-4 mt-auto mb-4 mx-4 glass-card rounded-xl">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
          <span className="text-xs font-bold text-success tracking-wide">SYSTEM ONLINE</span>
        </div>
        <p className="text-[10px] text-zinc-500">Node Cluster: v2.4.0-delta</p>
      </div>

      <div className="px-6 pb-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold uppercase text-xs">
            {user?.username?.[0] || 'U'}
          </div>
          <div>
            <p className="text-xs font-bold text-white capitalize">{user?.username}</p>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">{user?.role}</p>
          </div>
        </div>

        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-danger hover:text-rose-400 transition w-full">
          <LogOut size={16} /> Disconnect
        </button>
      </div>
    </div>
  );
}
