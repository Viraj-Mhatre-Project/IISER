import { useState, useRef, useCallback } from 'react';
import { Upload, Cloud, Zap, FileVideo, X, CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProcessing } from '../context/ProcessingContext';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n) { return (n ?? 0).toLocaleString(); }

function stageLabel(stage, pct) {
  const map = {
    idle: 'Waiting…',
    uploading: 'Uploading video…',
    downloading: 'Downloading from Drive…',
    initializing: 'Initializing AI models…',
    loading_video: 'Reading video metadata…',
    extracting: 'Extracting frames…',
    detecting: 'Running YOLOv8 detection…',
    finalizing: 'Generating CSV & graph…',
    done: 'Complete!',
    cancelled: 'Cancelled.',
    error: 'Error',
  };
  return map[stage] ?? `Processing… ${Math.round(pct)}%`;
}

const STEPS = ['Init', 'Extract', 'Detect', 'Finalize', 'Done'];
const STEP_THRESHOLDS = [8, 30, 85, 95, 100];

// ── component ─────────────────────────────────────────────────────────────────

export default function UploadProcess() {
  const navigate = useNavigate();
  const { loading, result, sseState, pct, isProcessing, isDone, startProcessing, cancelProcessing, resetProcessing } = useProcessing();

  const [driveLink, setDriveLink] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState('file');
  const fileInputRef = useRef(null);

  const isCancelled = sseState.stage === 'cancelled';
  const showBar = isProcessing || isDone || isCancelled;

  // Dual-segment bar values
  const totalF = sseState.total_frames || 1;
  const extractPct = Math.min(100, (sseState.extracted_frames / totalF) * 100);
  const detectPct = Math.min(100, (sseState.processed_frames / totalF) * 100);

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setMode('file');
    } else {
      alert('Please select a valid video file (MP4, AVI, MOV).');
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files[0]);
  }, []);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleProcess = async () => {
    if (mode === 'file' && !selectedFile) return alert('Please select a video file first.');
    if (mode === 'drive') {
      if (!driveLink.trim()) return alert('Please paste a valid Google Drive link.');
      if (!driveLink.includes('drive.google.com')) return alert('Invalid link. Paste a full Google Drive share link.');
    }

    try {
      await startProcessing({ file: selectedFile, driveLink, mode });
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleReset = () => {
    resetProcessing();
    setSelectedFile(null);
    setDriveLink('');
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <style>{`
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
      `}</style>

      <h1 className="text-3xl font-extrabold text-white tracking-tight">Initialize Processing</h1>

      <div className="space-y-4">

        {/* Mode Tabs */}
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl w-fit">
          {['file', 'drive'].map(m => (
            <button key={m} onClick={() => setMode(m)} disabled={loading}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 ${mode === m ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-zinc-400 hover:text-white'}`}>
              {m === 'file' ? 'File Upload' : 'Google Drive'}
            </button>
          ))}
        </div>

        {/* File Dropzone */}
        {mode === 'file' && (
          <div>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
              onChange={e => handleFileSelect(e.target.files[0])} />
            {selectedFile ? (
              <div className="glass-card rounded-2xl border border-success/30 bg-success/5 p-8 flex items-center gap-6">
                <div className="w-14 h-14 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                  <FileVideo size={28} className="text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate">{selectedFile.name}</p>
                  <p className="text-zinc-500 text-sm mt-1">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-success" />
                  <button onClick={() => setSelectedFile(null)} disabled={loading}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-30">
                    <X size={16} className="text-zinc-400" />
                  </button>
                </div>
              </div>
            ) : (
              <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                className={`glass-card rounded-2xl border-2 border-dashed transition-all p-12 flex flex-col items-center justify-center text-center h-64 ${isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-white/10'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 transition-colors ${isDragging ? 'bg-primary/20' : 'bg-white/5'}`}>
                  <Upload size={30} className={`transition-colors ${isDragging ? 'text-primary' : 'text-zinc-400'}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{isDragging ? 'Drop it!' : 'Drag & drop your surveillance video'}</h3>
                <p className="text-zinc-500 mb-6 text-sm font-medium">Supports MP4, AVI, MOV — max 2GB</p>
                <button type="button" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="bg-primary hover:bg-blue-600 text-white font-semibold py-2.5 px-7 rounded-lg shadow-lg shadow-primary/20 transition-all">
                  Browse Files
                </button>
              </div>
            )}
          </div>
        )}

        {/* Drive Input */}
        {mode === 'drive' && (
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Google Drive Link</h4>
            <div className="glass-card rounded-xl p-2 flex items-center bg-[#11131A] focus-within:ring-2 focus-within:ring-primary/50">
              <div className="pl-4 pr-2 text-zinc-500"><Cloud size={20} /></div>
              <input type="text" value={driveLink} onChange={e => setDriveLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="flex-1 bg-transparent border-none focus:outline-none text-white placeholder-zinc-600 py-3 text-sm" />
              {driveLink && (
                <button onClick={() => setDriveLink('')} disabled={loading} className="p-2 mr-1 text-zinc-500 hover:text-white disabled:opacity-30">
                  <X size={16} />
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-600 mt-2 font-medium">
              Make sure the file is set to <span className="text-zinc-400 font-bold">"Anyone with the link"</span> in Drive sharing settings.
            </p>
          </div>
        )}

        {/* ── Progress Panel ── */}
        {showBar && (
          <div className="glass-card rounded-xl p-5 border border-white/10 space-y-4">

            {/* Header row */}
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                {stageLabel(sseState.stage, pct)}
              </span>
              <span className="text-[11px] font-bold tabular-nums"
                style={{ color: isDone ? '#10b981' : isCancelled ? '#f59e0b' : sseState.stage === 'error' ? '#f43f5e' : '#3b82f6' }}>
                {isCancelled ? 'CANCELLED' : sseState.stage === 'error' ? 'FAILED' : `${Math.round(pct)}%`}
              </span>
            </div>

            {/* Dual-layer frame bars or fallback */}
            {sseState.total_frames > 0 ? (
              <div className="space-y-1.5">
                {/* Extraction bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 w-16 shrink-0">Extract</span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${extractPct}%`, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', boxShadow: '0 0 6px rgba(245,158,11,.5)' }} />
                  </div>
                  <span className="text-[9px] tabular-nums text-zinc-500 w-20 text-right shrink-0">
                    {fmt(sseState.extracted_frames)} / {fmt(sseState.total_frames)}
                  </span>
                </div>
                {/* Detection bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 w-16 shrink-0">Detect</span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden relative">
                    <div className="h-full rounded-full transition-all duration-300 relative overflow-hidden"
                      style={{ width: `${detectPct}%`, background: 'linear-gradient(90deg,#3b82f6,#6366f1)', boxShadow: '0 0 6px rgba(59,130,246,.5)' }}>
                      {isProcessing && (
                        <div className="absolute inset-0 opacity-40"
                          style={{ background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,.5) 50%,transparent 100%)', animation: 'shimmer 1.5s infinite' }} />
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] tabular-nums text-zinc-500 w-20 text-right shrink-0">
                    {fmt(sseState.processed_frames)} / {fmt(sseState.total_frames)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300 relative overflow-hidden"
                  style={{
                    width: `${pct}%`,
                    background: isDone ? 'linear-gradient(90deg,#10b981,#34d399)' : sseState.stage === 'error' ? '#f43f5e' : 'linear-gradient(90deg,#3b82f6,#6366f1)',
                    boxShadow: isDone ? '0 0 8px rgba(16,185,129,.5)' : '0 0 8px rgba(59,130,246,.5)',
                  }}>
                  {isProcessing && (
                    <div className="absolute inset-0 opacity-40"
                      style={{ background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,.5) 50%,transparent 100%)', animation: 'shimmer 1.5s infinite' }} />
                  )}
                </div>
              </div>
            )}

            {/* Step dots */}
            <div className="flex justify-between items-center pt-0.5">
              {STEPS.map((label, i) => {
                const active = pct >= STEP_THRESHOLDS[i];
                return (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                      style={{ background: active ? (isDone ? '#10b981' : '#3b82f6') : 'rgba(255,255,255,0.1)' }} />
                    <span className="text-[9px] font-bold uppercase tracking-wider transition-colors duration-300"
                      style={{ color: active ? (isDone ? '#10b981' : '#3b82f6') : '#52525b' }}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Error message */}
            {sseState.stage === 'error' && sseState.error && (
              <p className="text-xs text-danger font-medium pt-1 border-t border-white/5">{sseState.error}</p>
            )}
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex gap-3">
          <button onClick={handleProcess} disabled={loading}
            className="flex-1 py-4 rounded-xl bg-primary hover:bg-blue-600 focus:ring-4 focus:ring-primary/50 text-white font-bold text-lg tracking-wider flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all disabled:opacity-50">
            <Zap size={20} fill="currentColor" />
            {loading ? 'PROCESSING…' : 'START PROCESSING'}
          </button>

          {/* Cancel — shown while actively processing */}
          {isProcessing && (
            <button
              onClick={cancelProcessing}
              className="px-5 py-4 rounded-xl bg-danger/10 hover:bg-danger/20 border border-danger/30 text-danger font-bold text-sm tracking-wider transition-all flex items-center gap-2">
              <X size={16} /> Cancel
            </button>
          )}

          {/* Reset / clear — shown once done, cancelled, or errored */}
          {(isDone || isCancelled || sseState.stage === 'error') && (
            <button onClick={handleReset}
              className="px-4 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white font-bold text-sm transition-all">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Result Card */}
        {result && (
          <div className="glass-card rounded-xl p-5 border border-success/30 bg-success/5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={18} className="text-success" />
              <h4 className="text-sm font-bold text-white">Processing Complete</h4>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-2xl font-extrabold text-white">{result.total_vehicles}</p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Vehicles</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{result.avg_speed}</p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Avg km/h</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{result.max_speed}</p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Max km/h</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{fmt(result.total_frames)}</p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Frames</p>
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 font-medium">Run ID: {result.run_id}</p>
            <button onClick={() => navigate('/gallery')}
              className="w-full mt-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-zinc-300 flex items-center justify-center gap-2 transition-all">
              View in Output Gallery <ArrowRight size={15} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}