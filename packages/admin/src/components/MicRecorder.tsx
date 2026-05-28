import { useCallback, useRef, useState } from 'react';

export interface MicRecorderProps {
  onRecording: (audioBase64: string, mimeType: string) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  maxSeconds?: number;
}

export function MicRecorder({ onRecording, disabled, label = 'Hold to record', maxSeconds = 15 }: MicRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const animRef = useRef<number | null>(null);

  const stopTracks = useCallback((recorder: MediaRecorder | null) => {
    recorder?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const start = useCallback(async () => {
    if (disabled || recording) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        void (async () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const buffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
          const audioBase64 = btoa(binary);
          await onRecording(audioBase64, mimeType.split(';')[0] ?? 'audio/webm');
        })();
        stopTracks(recorder);
      };
      mediaRef.current = recorder;
      recorder.start(200);
      setRecording(true);

      timerRef.current = window.setTimeout(() => {
        if (mediaRef.current?.state === 'recording') {
          mediaRef.current.stop();
          setRecording(false);
        }
      }, maxSeconds * 1000);

      const tick = () => {
        setLevel(Math.random() * 0.6 + 0.4);
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [disabled, recording, maxSeconds, onRecording, stopTracks]);

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setLevel(0);
    if (mediaRef.current?.state === 'recording') {
      mediaRef.current.stop();
    }
    setRecording(false);
  }, []);

  return (
    <div className="mic-recorder">
      <button
        type="button"
        className={`mic-btn${recording ? ' recording' : ''}`}
        disabled={disabled}
        onMouseDown={() => void start()}
        onMouseUp={stop}
        onMouseLeave={() => recording && stop()}
        onTouchStart={(e) => {
          e.preventDefault();
          void start();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          stop();
        }}
      >
        <span className="mic-icon">{recording ? '●' : '🎤'}</span>
        <span>{recording ? 'Release to send' : label}</span>
      </button>
      {recording && (
        <div className="mic-level" style={{ transform: `scaleX(${level})` }} />
      )}
      {error && <p className="mic-error">{error}</p>}
      {!navigator.mediaDevices && (
        <p className="mic-error">Microphone not available in this browser context.</p>
      )}
    </div>
  );
}
