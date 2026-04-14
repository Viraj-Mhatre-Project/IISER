import { useState } from 'react';
import { Upload, Cloud, Zap, Info, Settings2, Car } from 'lucide-react';

export default function UploadProcess() {
  const [speedLimit, setSpeedLimit] = useState(60);
  const [confidence, setConfidence] = useState(75);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);
  const [driveLink, setDriveLink] = useState('');

  const handleProcess = async () => {
    setLoading(true);
    setStatus('Initializing AI Models...');

    try {
      const formData = new FormData();
      formData.append('speed_limit', speedLimit);
      formData.append('confidence', (confidence / 100).toFixed(2));
      formData.append('drive_link', driveLink || 'default_test_video');

      setStatus('Uploading & Processing...');
      const response = await fetch('http://localhost:8000/api/process', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);

      setResult(data.data);
      setStatus('');
      alert("Processing Complete! Check Output Gallery.");
    } catch (err) {
      setStatus('');
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Initialize Processing</h1>
        <p className="text-zinc-400 text-lg max-w-2xl">
          Deploy Kinetic AI vision models on raw surveillance feeds. Calibrate your thresholds for precise velocity detection.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Upload Zones */}
        <div className="col-span-2 space-y-4">

          {/* Main Dropzone */}
          <div className="glass-card rounded-2xl border-2 border-dashed border-white/10 hover:border-primary/50 transition-colors p-12 flex flex-col items-center justify-center text-center group cursor-pointer h-80">
            <div className="w-16 h-16 rounded-full bg-white/5 group-hover:bg-primary/10 flex items-center justify-center mb-6 transition-colors">
              <Upload size={32} className="text-zinc-400 group-hover:text-primary transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Drag & drop your surveillance video here</h3>
            <p className="text-zinc-500 mb-8 font-medium">Supports MP4, AVI, MOV — max 2GB</p>
            <button className="bg-primary hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg shadow-lg shadow-primary/20 transition-all">
              Browse Files
            </button>
          </div>

          {/* Remote Source */}
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Remote Source</h4>
            <div className="glass-card rounded-xl p-2 flex items-center bg-[#11131A] focus-within:ring-2 focus-within:ring-primary/50">
              <div className="pl-4 pr-2 text-zinc-500">
                <Cloud size={20} />
              </div>
              <input
                type="text"
                value={driveLink}
                onChange={e => setDriveLink(e.target.value)}
                placeholder="Paste Google Drive Link"
                className="flex-1 bg-transparent border-none focus:outline-none text-white placeholder-zinc-600 py-3"
              />
              <button
                onClick={() => {
                  if (!driveLink) return alert('Please paste a Google Drive link first.');
                  alert('Drive link connected! Now click Start Processing.');
                }}
                className="bg-white/5 hover:bg-white/10 text-white font-medium px-6 py-2 rounded-lg transition mr-1"
              >
                Connect
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Configuration */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-6">

            <div className="flex items-center gap-3 mb-8">
              <Settings2 className="text-primary" size={24} />
              <h3 className="text-xl font-bold text-white">Processing Configuration</h3>
            </div>

            {/* Speed Limit Slider */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-widest block mb-1">Speed Limit Threshold</label>
                  <span className="text-xs text-zinc-500 font-medium italic">Minimum speed to trigger detection</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white">{speedLimit}</span>
                  <span className="text-xs font-bold text-zinc-500">KM/H</span>
                </div>
              </div>
              <input type="range" min="20" max="200" value={speedLimit} onChange={e => setSpeedLimit(e.target.value)} className="w-full accent-primary h-1 rounded-full appearance-none bg-white/10" />
              <div className="flex justify-between text-[10px] font-bold text-zinc-600 mt-2 uppercase tracking-wider">
                <span>20 KM/H</span>
                <span>200 KM/H</span>
              </div>
            </div>

            {/* YOLO Confidence Slider */}
            <div className="mb-8 p-1">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-widest block mb-1">YOLOv8 Confidence</label>
                  <span className="text-xs text-zinc-500 font-medium italic">Detection sensitivity level</span>
                </div>
                <div className="text-2xl font-bold text-white">{(confidence / 100).toFixed(2)}</div>
              </div>
              <input type="range" min="10" max="99" value={confidence} onChange={e => setConfidence(e.target.value)} className="w-full accent-success h-1 rounded-full appearance-none bg-white/10" />
              <div className="flex justify-between text-[10px] font-bold text-zinc-600 mt-2 uppercase tracking-wider">
                <span>0.10</span>
                <span>0.99</span>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#1A2E27] flex items-center justify-center text-success">
                    #
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">ROI CALIBRATION</h4>
                    <p className="text-[10px] text-zinc-500 font-medium">Correction for camera angle</p>
                  </div>
                </div>
                <div className="w-10 h-5 rounded-full bg-success/20 relative cursor-pointer border border-success/30">
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-success shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-transparent border border-white/5 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-zinc-500">
                    <Car size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">HOMOGRAPHY CALIBRATION</h4>
                    <p className="text-[10px] text-zinc-500 font-medium">Extract license plates (Pro Only)</p>
                  </div>
                </div>
                <div className="w-10 h-5 rounded-full bg-black relative border border-white/10">
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-zinc-600"></div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleProcess}
              disabled={loading}
              className="w-full py-4 rounded-xl bg-primary hover:bg-blue-600 focus:ring-4 focus:ring-primary/50 text-white font-bold text-lg tracking-wider flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all disabled:opacity-50"
            >
              <Zap size={20} fill="currentColor" /> {loading ? 'PROCESSING...' : 'START PROCESSING'}
            </button>
            <p className="text-center text-[10px] text-zinc-500 mt-4 uppercase tracking-widest font-bold">
              {status || 'Estimated compute time: 4m 12s'}
            </p>
          </div>

          {/* AI Notice */}
          <div className="glass-card rounded-xl p-4 border-l-4 border-l-success flex gap-3">
            <Info className="text-success shrink-0" size={20} />
            <p className="text-xs text-zinc-400 font-medium leading-relaxed">
              <strong className="text-success mr-1">AI Notice:</strong>
              High YOLO confidence reduces false positives but may miss fast-moving objects in low light. For night surveillance, we recommend a 0.55 threshold.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}