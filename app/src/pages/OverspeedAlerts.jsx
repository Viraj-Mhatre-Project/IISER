import { Search, Bell, BarChart2, MapPin, Gauge, Download, RefreshCw, Zap } from 'lucide-react';

function AlertCard({ title, value, subtitle, icon: Icon, valueColor = "text-white" }) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-32">
      <div className="flex justify-between items-start">
        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{title}</h3>
        <Icon size={18} className="text-zinc-600" />
      </div>
      <div>
        <span className={valueColor + " text-3xl font-bold flex items-baseline gap-1"}>
          {value}
          {value === "0" && <span className="text-sm font-bold text-zinc-600">KM/H</span>}
        </span>
        <span className="text-xs font-semibold text-zinc-500 mt-1 block">{subtitle}</span>
      </div>
    </div>
  );
}

export default function OverspeedAlerts() {
  return (
    <div className="flex flex-col h-screen">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="relative w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search system nodes..." 
            className="w-full bg-white/5 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-center gap-6 text-sm font-bold text-zinc-400">
          <span className="hover:text-white cursor-pointer">Network</span>
          <span className="hover:text-white cursor-pointer">Nodes</span>
          <span className="hover:text-white cursor-pointer">API</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-500">
        
        {/* Header Block */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">Overspeed Alerts</h1>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
              <span className="text-[10px] font-bold text-success uppercase tracking-widest">LIVE TRAFFIC VIOLATION MONITORING</span>
            </div>
          </div>
          
          <div className="text-right">
             <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">CRITICAL INCIDENTS (24H)</span>
             <div className="flex justify-end gap-2 mt-2">
               <div className="w-16 h-10 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center font-bold text-zinc-400">0</div>
               <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400">⚠️</div>
             </div>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <AlertCard title="Total System Violations" value="0" subtitle="INIT_PENDING" icon={BarChart2} />
          <AlertCard title="Most Violated Location" value="None Identified" subtitle="Collecting data streams..." icon={MapPin} valueColor="text-zinc-300 text-xl" />
          <AlertCard title="Highest Recorded Speed" value="0" subtitle="" icon={Gauge} />
        </div>

        {/* Bottom Split Layout */}
        <div className="grid grid-cols-3 gap-6">
          
          {/* Main List */}
          <div className="col-span-2 glass-card rounded-2xl p-6 min-h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[11px] font-bold text-white uppercase tracking-widest">RECENT VIOLATION STREAM</h2>
              <div className="flex gap-2">
                <button className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 transition">
                   <Download size={14} />
                </button>
                <button className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 transition">
                   <RefreshCw size={14} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 border border-dashed border-white/10 rounded-xl bg-black/20 flex flex-col items-center justify-center text-center">
               <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 opacity-30">
                 <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>
               </div>
               <h3 className="text-white font-bold mb-1">No violations recorded.</h3>
               <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">AWAITING KINETIC EVENT DETECTION</p>
            </div>
          </div>

          {/* Right Sidebar map + Filter */}
          <div className="space-y-6">
            {/* Map Placeholder */}
            <div className="glass-card rounded-2xl p-6">
              <div className="h-24 bg-[url('https://maps.gstatic.com/tactile/basepage/pegman_sherlock.png')] bg-cover bg-center rounded-xl mb-4 opacity-5 bg-white/5 invert"></div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">GEOSPATIAL DISTRIBUTION</h3>
              <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">System-wide violations are currently <span className="text-white">Stable</span>. No hotspots detected in current installation.</p>
            </div>

            {/* Filter Form */}
            <div className="glass-card rounded-2xl p-6 border border-danger/20 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-danger/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
               
               <div className="flex items-center gap-2 mb-6 text-zinc-300">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest">INTELLIGENCE FILTER</h3>
               </div>

               <div className="space-y-6 relative z-10">
                 <div>
                   <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">TEMPORAL FOCUS</label>
                   <select className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-danger appearance-none">
                     <option>Last 24 Hours</option>
                     <option>Last 7 Days</option>
                     <option>All Time</option>
                   </select>
                 </div>

                 <div>
                   <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">KINETIC CLASS</label>
                   <div className="flex flex-wrap gap-2">
                     <span className="px-3 py-1.5 rounded bg-danger/20 text-danger border border-danger/30 text-[10px] font-bold tracking-wider">ALL UNITS</span>
                     <span className="px-3 py-1.5 rounded bg-white/5 text-zinc-400 border border-white/5 text-[10px] font-bold tracking-wider">PASSENGER</span>
                     <span className="px-3 py-1.5 rounded bg-white/5 text-zinc-400 border border-white/5 text-[10px] font-bold tracking-wider">HEAVY</span>
                     <span className="px-3 py-1.5 rounded bg-white/5 text-zinc-400 border border-white/5 text-[10px] font-bold tracking-wider">EMERGENCY</span>
                   </div>
                 </div>

                 <div>
                   <div className="flex justify-between items-center mb-2">
                     <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">SPEED FLOOR (KM/H)</label>
                     <span className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center transform rotate-12 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                       <Zap size={14} fill="currentColor"/>
                     </span>
                   </div>
                   <input type="range" className="w-full accent-danger h-1 rounded-full appearance-none bg-white/10 mb-2" />
                   <div className="flex justify-between text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
                     <span>40 KM/H</span>
                     <span>250 KM/H</span>
                   </div>
                 </div>

                 <button className="w-full py-4 rounded-xl bg-danger hover:bg-rose-600 text-white font-bold text-xs tracking-widest transition-colors mt-2 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                   EXECUTE FILTER
                 </button>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
