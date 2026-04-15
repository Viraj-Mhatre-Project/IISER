import { Search, Bell, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VideoInsights() {
  return (
    <div className="flex flex-col h-screen">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="relative w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search insights..."
            className="w-full bg-white/5 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="flex items-center gap-6 text-sm font-bold text-zinc-400">
          <div className="w-px h-4 bg-white/10 ml-2"></div>
          <button className="text-zinc-500 hover:text-white"><Bell size={18} /></button>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <span className="text-xs text-white">V</span>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-8 border border-white/5">
          <Activity size={36} className="text-zinc-500" />
        </div>
        <h2 className="text-2xl font-extrabold text-white mb-4">No active run selected</h2>
        <p className="text-zinc-500 max-w-md text-center text-sm font-medium mb-10 leading-relaxed">
          Select a processed run from the <span className="text-white font-bold">Output Gallery</span> to view detailed kinetic intelligence, classification metrics, and telemetry logs.
        </p>
        <Link to="/gallery" className="bg-white/5 hover:bg-white/10 text-zinc-300 font-bold px-6 py-3 rounded-lg transition-colors border border-white/10 text-xs tracking-widest uppercase flex items-center gap-2">
          <Activity size={16} /> BROWSE OUTPUT GALLERY
        </Link>
      </div>
    </div>
  );
}
