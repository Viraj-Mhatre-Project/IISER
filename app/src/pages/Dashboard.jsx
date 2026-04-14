import { Play, FileVideo, Car, AlertTriangle, Gauge, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';

function StatCard({ title, value, icon: Icon, unit = "", trend }) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{title}</h3>
        <Icon size={18} className="text-zinc-400" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-white">{value}</span>
        {unit && <span className="text-sm font-semibold text-zinc-500">{unit}</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-card border border-white/5 shadow-2xl p-10 h-[300px] flex flex-col justify-center">
        {/* Subtle background glow/gradient to simulate the image banner */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-black opacity-80 z-0"></div>
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent"></div>
        
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/20">
             <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
             <span className="text-[10px] font-bold text-success uppercase tracking-widest">System Online</span>
          </div>
          
          <h1 className="text-5xl font-extrabold text-white tracking-tight">
            Traffic Intelligence Platform
          </h1>
          
          <p className="text-lg text-zinc-400 font-medium leading-relaxed">
            Harness computer vision and kinetic modeling to extract hyper-accurate velocity metrics from raw video feeds in real-time.
          </p>

          <div className="flex gap-4 pt-4">
            <Link to="/upload" className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-blue-600 text-white font-semibold rounded-lg shadow-lg shadow-primary/25 transition">
               <Play size={18} fill="currentColor" /> Process New Video
            </Link>
            <button className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-lg transition">
               View Documentation
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard title="Total Videos Processed" value="0" icon={FileVideo} />
        <StatCard title="Total Vehicles Detected" value="0" icon={Car} />
        <StatCard title="Overspeed Violations" value="0" icon={AlertTriangle} />
        <StatCard title="Avg Speed Observed" value="--" unit="KM/H" icon={Gauge} />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent Runs */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center gap-2">
             <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center">
                <span className="text-xs">⏱</span>
             </div>
             <h2 className="text-lg font-bold text-white">Recent Processed Runs</h2>
          </div>
          
          <div className="glass-card rounded-2xl h-64 flex flex-col items-center justify-center text-center p-8">
             <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
               <Inbox size={32} className="text-zinc-600" />
             </div>
             <p className="text-zinc-400 font-medium">No runs yet. Upload a video to get started.</p>
          </div>
        </div>

        {/* Empty Placeholder right block */}
        <div className="glass-card rounded-2xl h-[calc(100%-40px)] mt-[40px]">
           {/* Completely empty grey box as per screenshot */}
        </div>
      </div>

    </div>
  );
}
