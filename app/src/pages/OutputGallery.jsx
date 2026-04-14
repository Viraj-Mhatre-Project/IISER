import { Search, Filter, Bell, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function OutputGallery() {
  return (
    <div className="flex flex-col h-screen">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="relative w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search sequences..."
            className="w-full bg-white/5 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="flex items-center gap-6 text-sm font-bold text-zinc-400">
          <span className="hover:text-white cursor-pointer">Network</span>
          <span className="hover:text-white cursor-pointer">Nodes</span>
          <span className="hover:text-white cursor-pointer">API</span>
          <div className="w-px h-4 bg-white/10 ml-2"></div>
          <button className="text-zinc-500 hover:text-white"><Bell size={18} /></button>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <span className="text-xs text-white">V</span>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <div className="flex-1 p-8 max-w-7xl mx-auto w-full flex flex-col animate-in fade-in duration-500">

        {/* Gallery Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Output Gallery</h1>
              <span className="px-2 py-1 rounded-md bg-white/10 text-[10px] font-bold tracking-widest text-zinc-400 uppercase border border-white/5">0 Runs</span>
            </div>
            <p className="text-zinc-500 text-sm max-w-md font-medium leading-relaxed">
              Review kinetic telemetry and visual data extraction from active processing nodes.
            </p>
          </div>

          <div className="flex gap-3 text-xs font-bold text-zinc-400">
            <button className="px-4 py-2 rounded-lg bg-white/5 border border-white/5 flex items-center gap-2 hover:text-white transition">
              <Filter size={14} /> ALL SOURCES
            </button>
            <button className="px-4 py-2 rounded-lg bg-white/5 border border-white/5 flex items-center gap-2 hover:text-white transition">
              <Filter size={14} /> LATEST FIRST
            </button>
          </div>
        </div>

        {/* Empty State Box */}
        <div className="flex-1 glass-card rounded-2xl flex flex-col items-center justify-center border-dashed border-2 border-white/5">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
            <CloudUpload size={28} className="text-zinc-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No processed videos yet.</h3>
          <p className="text-zinc-500 max-w-sm text-center text-sm font-medium mb-8">
            Upload a data sequence to begin kinetic analysis.
          </p>
          <Link to="/upload" className="bg-primary/20 hover:bg-primary/30 text-primary font-bold px-6 py-3 rounded-lg transition-colors border border-primary/20 text-sm tracking-wider uppercase">
            Begin Upload
          </Link>
        </div>

        <div className="mt-4 flex justify-between items-center text-xs font-bold text-zinc-600">
          <span>Showing 0 of 0 results</span>
          <div className="flex gap-2">
            <button disabled className="w-8 h-8 rounded bg-white/5 flex items-center justify-center opacity-50">&lt;</button>
            <button disabled className="w-8 h-8 rounded bg-white/5 flex items-center justify-center opacity-50">&gt;</button>
          </div>
        </div>

      </div>
    </div>
  );
}
