import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { MicRecorder } from '@/components/MicRecorder';
import type { PracticeResult, TutorialLesson } from '@/api/types';

export function Tutorial() {
  const [lessons, setLessons] = useState<TutorialLesson[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [sttProvider, setSttProvider] = useState('http-inbox');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [lessonRes, stt] = await Promise.all([
      api.getTutorialLessons(),
      api.getSttProviders(),
    ]);
    setLessons(lessonRes.lessons);
    setCompletedIds(lessonRes.completedIds);
    setSttProvider(stt.activeId);
    if (!activeId && lessonRes.lessons[0]) setActiveId(lessonRes.lessons[0].id);
    setLoading(false);
  }, [activeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = lessons.find((l) => l.id === activeId);

  async function checkAnswer(execute = false) {
    if (!active) return;
    const res = await api.runTutorialPractice(active.id, text || active.sampleUtterance, !execute);
    setResult(res);
    setCompletedIds(res.completedIds);
  }

  if (loading) return <div className="card empty-state">Loading tutorial…</div>;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Voice Command Tutorial</h1>
        <p className="page-subtitle">
          Practice deterministic commands — {completedIds.length}/{lessons.length} completed
        </p>
      </header>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Lessons</h2>
          </div>
          <ul className="lesson-list">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <button
                  type="button"
                  className={`lesson-item${activeId === lesson.id ? ' active' : ''}${completedIds.includes(lesson.id) ? ' done' : ''}`}
                  onClick={() => {
                    setActiveId(lesson.id);
                    setText('');
                    setResult(null);
                  }}
                >
                  <span className="lesson-check">{completedIds.includes(lesson.id) ? '✓' : '○'}</span>
                  <span>
                    <strong>{lesson.title}</strong>
                    <span className="lesson-cat">{lesson.category}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {active && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">{active.title}</h2>
            </div>
            <p>{active.description}</p>
            {active.setupHint && <p className="wizard-hint">{active.setupHint}</p>}
            <div className="field">
              <label>Your utterance</label>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={active.sampleUtterance}
              />
            </div>
            <div className="tutorial-actions">
              <button type="button" className="btn btn-primary" onClick={() => void checkAnswer(false)}>
                Check (dry run)
              </button>
              <button type="button" className="btn" onClick={() => void checkAnswer(true)}>
                Execute command
              </button>
              <button type="button" className="btn" onClick={() => setText(active.sampleUtterance)}>
                Fill example
              </button>
            </div>
            {sttProvider === 'openai-whisper' && (
              <MicRecorder
                label="Hold to speak"
                onRecording={async (b64, mime) => {
                  const res = await api.transcribe(b64, mime, false);
                  setText(res.transcript);
                }}
              />
            )}
            {result && (
              <div className={`practice-result${result.passed ? ' ok' : ' fail'}`}>
                <div>{result.feedback}</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8 }}>
                  Parsed: {result.actualIntentType} — {result.actualSummary}
                  {' '}({Math.round(result.confidence * 100)}%)
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
