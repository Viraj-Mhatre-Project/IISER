import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';

// ── helpers (same as UploadProcess) ──────────────────────────────────────────
function stagePct(state) {
  const { stage, total_frames, processed_frames } = state;
  const stageBase = {
    idle: 0, uploading: 2, downloading: 2, initializing: 5,
    loading_video: 8, extracting: 10, detecting: 10, finalizing: 95, done: 100, error: 0,
  };
  const base = stageBase[stage] ?? 0;
  if ((stage === 'extracting' || stage === 'detecting') && total_frames > 0) {
    return 10 + ((processed_frames / total_frames) * 85);
  }
  return base;
}

const ProcessingContext = createContext(null);

export function ProcessingProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [sseState, setSseState] = useState({
    stage: 'idle', total_frames: 0, extracted_frames: 0, processed_frames: 0, error: null,
  });
  const esRef = useRef(null);

  const pct = stagePct(sseState);
  const isProcessing = loading || (
    sseState.stage !== 'idle' &&
    sseState.stage !== 'done' &&
    sseState.stage !== 'error'
  );
  const isDone = sseState.stage === 'done' || pct >= 100;

  // Clean up SSE when app unmounts
  useEffect(() => () => esRef.current?.close(), []);

  const connectSSE = useCallback(() => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource('http://localhost:8000/api/progress');
    esRef.current = es;
    es.onmessage = (e) => {
      try { setSseState(JSON.parse(e.data)); } catch { }
    };
    es.onerror = () => es.close();
  }, []);

  const startProcessing = useCallback(async ({ file, driveLink, mode }) => {
    setLoading(true);
    setResult(null);
    setSseState({ stage: 'uploading', total_frames: 0, extracted_frames: 0, processed_frames: 0, error: null });
    connectSSE();

    try {
      const formData = new FormData();
      if (mode === 'file') formData.append('file', file);
      else formData.append('drive_link', driveLink.trim());

      const response = await fetch('http://localhost:8000/api/process', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Processing failed');
      setResult(data.data);
    } catch (err) {
      setSseState(s => ({ ...s, stage: 'error', error: err.message }));
      throw err; // re-throw so page can show alert
    } finally {
      setLoading(false);
      esRef.current?.close();
    }
  }, [connectSSE]);

  const cancelProcessing = useCallback(async () => {
    try {
      await fetch('http://localhost:8000/api/cancel', { method: 'POST' });
    } catch { /* best effort */ }
    esRef.current?.close();
    setLoading(false);
    setSseState({ stage: 'cancelled', total_frames: 0, extracted_frames: 0, processed_frames: 0, error: null });
  }, []);

  const resetProcessing = useCallback(() => {
    esRef.current?.close();
    setLoading(false);
    setResult(null);
    setSseState({ stage: 'idle', total_frames: 0, extracted_frames: 0, processed_frames: 0, error: null });
  }, []);

  return (
    <ProcessingContext.Provider value={{
      loading, result, sseState, pct, isProcessing, isDone,
      startProcessing, cancelProcessing, resetProcessing,
    }}>
      {children}
    </ProcessingContext.Provider>
  );
}

export function useProcessing() {
  const ctx = useContext(ProcessingContext);
  if (!ctx) throw new Error('useProcessing must be used inside ProcessingProvider');
  return ctx;
}
