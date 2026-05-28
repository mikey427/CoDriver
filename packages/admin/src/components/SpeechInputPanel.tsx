import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import type { UtteranceResponse } from '@/api/types';
import { UtteranceSource } from '@driftcode/shared';

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string; confidence?: number } } };
  resultIndex: number;
}

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function SpeechInputPanel() {
  const [manualText, setManualText] = useState('');
  const [interim, setInterim] = useState('');
  const [finalPreview, setFinalPreview] = useState('');
  const [confidence, setConfidence] = useState<number | undefined>();
  const [listening, setListening] = useState(false);
  const [pttActive, setPttActive] = useState(false);
  const [lastResult, setLastResult] = useState<UtteranceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const cancelledRef = useRef(false);
  const pendingFinalRef = useRef<{ text: string; confidence?: number } | null>(null);

  const speechSupported = typeof window !== 'undefined' && Boolean(getSpeechRecognition());

  const submitUtterance = useCallback(async (text: string, source: UtteranceSource, conf?: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.submitUtterance(text, { source, confidence: conf, isFinal: true });
      setLastResult(res);
      if (source === UtteranceSource.AdminManual) setManualText('');
      setInterim('');
      setFinalPreview('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const stopRecognition = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const startPtt = useCallback(async () => {
    if (pttActive || busy) return;
    setError(null);
    cancelledRef.current = false;
    pendingFinalRef.current = null;
    setInterim('');
    setFinalPreview('');
    setConfidence(undefined);

    try {
      const state = await api.pttStart('admin');
      setPttActive(state.ptt.active);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PTT start failed');
      return;
    }

    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError('Browser speech recognition not supported — use manual input or HTTP test utterances.');
      return;
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event) => {
      let interimText = '';
      let finalText = '';
      let finalConf: number | undefined;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result?.[0];
        if (!alt) continue;
        if (result.isFinal) {
          finalText += alt.transcript;
          finalConf = alt.confidence;
        } else {
          interimText += alt.transcript;
        }
      }

      if (interimText) setInterim(interimText.trim());
      if (finalText) {
        const trimmed = finalText.trim();
        setFinalPreview(trimmed);
        setConfidence(finalConf);
        pendingFinalRef.current = { text: trimmed, confidence: finalConf };
      }
    };

    rec.onerror = (ev) => {
      if (ev.error !== 'aborted') {
        setError(`Speech error: ${ev.error}`);
      }
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      if (cancelledRef.current) {
        pendingFinalRef.current = null;
        return;
      }
      const pending = pendingFinalRef.current;
      if (pending?.text) {
        void submitUtterance(pending.text, UtteranceSource.AdminMic, pending.confidence);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start speech recognition');
    }
  }, [pttActive, busy, submitUtterance]);

  const releasePtt = useCallback(async () => {
    if (!pttActive) return;
    stopRecognition();
    try {
      await api.pttStop();
      setPttActive(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PTT stop failed');
    }
  }, [pttActive, stopRecognition]);

  const cancelPtt = useCallback(async () => {
    cancelledRef.current = true;
    pendingFinalRef.current = null;
    recognitionRef.current?.abort();
    setListening(false);
    setInterim('');
    setFinalPreview('');
    setConfidence(undefined);
    try {
      await api.pttCancel();
      setPttActive(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PTT cancel failed');
    }
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return (
    <div className="card speech-input-panel">
      <div className="card-header">
        <h2 className="card-title">Speech Input</h2>
        <span className="badge experimental">Experimental</span>
      </div>

      <p className="speech-hint">
        Real speech is optional. HTTP test utterances and manual input below use the same pipeline as always.
      </p>

      <section className="speech-section">
        <h3 className="speech-section-title">Manual test input</h3>
        <p className="speech-meta">Source: <code>admin-manual</code></p>
        <div className="speech-manual-row">
          <input
            type="text"
            className="speech-text-input"
            placeholder='e.g. switch manual dictation mode'
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && manualText.trim()) {
                void submitUtterance(manualText.trim(), UtteranceSource.AdminManual);
              }
            }}
            disabled={busy}
          />
          <button
            type="button"
            className="btn primary"
            disabled={busy || !manualText.trim()}
            onClick={() => void submitUtterance(manualText.trim(), UtteranceSource.AdminManual)}
          >
            Send
          </button>
        </div>
      </section>

      <section className="speech-section">
        <h3 className="speech-section-title">Mic push-to-talk</h3>
        <p className="speech-meta">
          Source: <code>admin-mic</code>
          {' · '}
          {speechSupported ? 'Browser speech API available' : 'Speech API not supported in this browser'}
        </p>

        <div className="speech-ptt-row">
          <button
            type="button"
            className={`btn ptt-btn${pttActive ? ' active' : ''}`}
            disabled={busy || !speechSupported}
            onMouseDown={() => void startPtt()}
            onMouseUp={() => void releasePtt()}
            onMouseLeave={() => pttActive && void releasePtt()}
            onTouchStart={(e) => {
              e.preventDefault();
              void startPtt();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              void releasePtt();
            }}
          >
            {pttActive ? '● Listening…' : 'Hold to talk'}
          </button>
          <button type="button" className="btn" disabled={!pttActive && !listening} onClick={() => void cancelPtt()}>
            Cancel
          </button>
        </div>

        {(pttActive || listening) && (
          <div className="listening-indicator" role="status">
            LISTENING {listening ? '(mic)' : '(PTT active)'}
          </div>
        )}

        {(interim || finalPreview) && (
          <div className="transcript-preview">
            <div className="label">Transcript preview</div>
            {interim && <div className="interim">{interim}</div>}
            {finalPreview && (
              <div className="final">
                {finalPreview}
                {confidence != null && <span className="conf"> · {Math.round(confidence * 100)}%</span>}
              </div>
            )}
            <p className="speech-meta">Interim text is preview only — only final transcripts are sent.</p>
          </div>
        )}
      </section>

      {error && <p className="speech-error">{error}</p>}

      {lastResult && (
        <div className="speech-result">
          <div className="label">Last result</div>
          <div>
            {lastResult.blocked ? 'Blocked' : 'Processed'} · {lastResult.intent?.summary ?? '—'}
            {lastResult.source && ` · ${lastResult.source}`}
          </div>
          {lastResult.toolResults?.[0]?.errorCode && (
            <div className="speech-meta">{lastResult.toolResults[0].errorCode}: {lastResult.toolResults[0].message}</div>
          )}
        </div>
      )}
    </div>
  );
}
