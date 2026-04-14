export default function Settings() {
  return (
    <div className="p-8 max-w-4xl animate-in fade-in duration-500">
      <h1 className="text-3xl font-extrabold text-white tracking-tight mb-8">Settings</h1>
      
      <div className="glass-card rounded-2xl p-8 mb-6">
        <h3 className="text-xl font-bold text-white mb-4">System Preferences</h3>
        <p className="text-zinc-500 mb-6">Global configurations for the AI processing node.</p>
        
        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Default Theme</label>
            <div className="flex px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white w-full max-w-xs justify-between">
              <span>Dark (Kinetic)</span>
              <span className="w-4 h-4 rounded-full border-4 border-primary"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
