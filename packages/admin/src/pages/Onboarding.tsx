import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { MicRecorder } from '@/components/MicRecorder';
import type { OnboardingProgress, OnboardingStepId, SttProviderInfo, TutorialLesson } from '@/api/types';

const STEPS: { id: OnboardingStepId; title: string; subtitle: string }[] = [
  { id: 'welcome', title: 'Welcome', subtitle: 'Voice-first coding for sim drifting' },
  { id: 'prerequisites', title: 'Prerequisites', subtitle: 'Verify your environment' },
  { id: 'stt-config', title: 'Speech Input', subtitle: 'Configure STT provider' },
  { id: 'vscode-extension', title: 'VS Code', subtitle: 'Connect the editor adapter' },
  { id: 'mic-test', title: 'Mic Test', subtitle: 'Verify Whisper transcription' },
  { id: 'tutorial', title: 'Tutorial', subtitle: 'Practice core voice commands' },
  { id: 'complete', title: 'Ready', subtitle: 'Start hands-free coding' },
];

export function Onboarding() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [prerequisites, setPrerequisites] = useState<Record<string, boolean>>({});
  const [providers, setProviders] = useState<SttProviderInfo[]>([]);
  const [sttProviderId, setSttProviderId] = useState('http-inbox');
  const [apiKey, setApiKey] = useState('');
  const [lessons, setLessons] = useState<TutorialLesson[]>([]);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [practiceText, setPracticeText] = useState('');
  const [practiceResult, setPracticeResult] = useState<string | null>(null);
  const [micTranscript, setMicTranscript] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const currentStep = progress?.currentStep ?? 'welcome';
  const stepIdx = STEPS.findIndex((s) => s.id === currentStep);

  const load = useCallback(async () => {
    try {
      const data = await api.getOnboarding();
      setProgress(data.progress);
      setPrerequisites(data.prerequisites);
      setLessons(data.tutorialLessons);
      const prov = await api.getSttProviders();
      setProviders(prov.providers);
      setSttProviderId(prov.activeId);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function completeStep(stepId: OnboardingStepId) {
    const res = await api.completeOnboardingStep(stepId);
    setProgress(res.progress);
  }

  async function goNext() {
    await completeStep(currentStep);
    const res = await api.advanceOnboarding();
    setProgress(res.progress);
  }

  async function saveSttConfig() {
    setMessage(null);
    const partial: Record<string, string> = { sttProviderId };
    if (apiKey) partial.openAiApiKey = apiKey;
    await api.updateConfig(partial);
    setApiKey('');
    setMessage('STT settings saved');
    await load();
  }

  async function runMicTest(audioBase64: string, mimeType: string) {
    setMicTranscript(null);
    const res = await api.runMicTest(audioBase64, mimeType);
    setMicTranscript(res.transcript || '(empty — try speaking louder)');
    setProgress(res.progress);
    await load();
  }

  async function runPractice(dryRun = true) {
    const lesson = lessons[lessonIndex];
    if (!lesson) return;
    const text = practiceText || lesson.sampleUtterance;
    const res = await api.runTutorialPractice(lesson.id, text, dryRun);
    setPracticeResult(res.feedback);
    if (res.passed) {
      await load();
      if (lessonIndex < lessons.length - 1) {
        setLessonIndex((i) => i + 1);
        setPracticeText('');
      }
    }
  }

  if (loading) {
    return <div className="card empty-state">Loading onboarding…</div>;
  }

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Getting Started</h1>
        <p className="page-subtitle">Set up DriftCode Harness for hands-free voice coding</p>
      </header>

      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`wizard-step${i === stepIdx ? ' active' : ''}${progress?.steps[s.id]?.completed ? ' done' : ''}`}
          >
            <span className="wizard-step-num">{i + 1}</span>
            <span className="wizard-step-label">{s.title}</span>
          </div>
        ))}
      </div>

      <div className="card wizard-panel">
        {currentStep === 'welcome' && (
          <>
            <h2 className="card-title">Welcome to DriftCode Harness</h2>
            <p>
              This wizard walks you through speech input, the VS Code extension, and a hands-on
              tutorial — so you can code by voice while your hands are on the wheel.
            </p>
            <ul className="wizard-list">
              <li>Deterministic voice commands (no AI cost) for editing and navigation</li>
              <li>OpenAI Whisper for microphone transcription</li>
              <li>Emergency stop always available</li>
              <li>Practice mode — no wheel required</li>
            </ul>
            <button type="button" className="btn btn-primary" onClick={() => void goNext()}>
              Begin setup
            </button>
          </>
        )}

        {currentStep === 'prerequisites' && (
          <>
            <h2 className="card-title">Prerequisites</h2>
            <ul className="checklist">
              <li className={prerequisites.orchestrator ? 'ok' : 'pending'}>
                Orchestrator running on port 17345
              </li>
              <li className={prerequisites.openai ? 'ok' : 'pending'}>
                OpenAI API key (Whisper + AI assist)
              </li>
              <li className={prerequisites.stt ? 'ok' : 'pending'}>
                STT provider selected
              </li>
              <li className={prerequisites.vscode ? 'ok' : 'pending'}>
                VS Code extension connected
              </li>
            </ul>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Run <code>npm run setup</code> and <code>npm start</code> if the orchestrator check fails.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => void goNext()}>
              Continue
            </button>
          </>
        )}

        {currentStep === 'stt-config' && (
          <>
            <h2 className="card-title">Speech-to-Text Provider</h2>
            <div className="field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="stt-provider">Provider</label>
              <select
                id="stt-provider"
                value={sttProviderId}
                onChange={(e) => setSttProviderId(e.target.value)}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
            </div>
            {providers.find((p) => p.id === sttProviderId)?.description && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                {providers.find((p) => p.id === sttProviderId)?.description}
              </p>
            )}
            {(sttProviderId === 'openai-whisper') && (
              <div className="field" style={{ marginBottom: '1rem' }}>
                <label htmlFor="onboard-api-key">OpenAI API Key</label>
                <input
                  id="onboard-api-key"
                  type="password"
                  placeholder="sk-…"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            )}
            {message && <p style={{ color: 'var(--status-ok)' }}>{message}</p>}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-primary" onClick={() => void saveSttConfig().then(() => goNext())}>
                Save & continue
              </button>
            </div>
          </>
        )}

        {currentStep === 'vscode-extension' && (
          <>
            <h2 className="card-title">VS Code Extension</h2>
            <p>Install and connect the DriftCode adapter so voice commands reach your editor.</p>
            <pre className="wizard-code">{`npm run build:extension
ln -sf "$(pwd)/packages/vscode-extension" ~/.vscode/extensions/driftcode-vscode-dev`}</pre>
            <p>
              Status:{' '}
              <span style={{ color: prerequisites.vscode ? 'var(--status-ok)' : 'var(--status-warn)' }}>
                {prerequisites.vscode ? 'Connected' : 'Not connected — reload VS Code after install'}
              </span>
            </p>
            <button type="button" className="btn" onClick={() => void load()}>Refresh status</button>
            <button type="button" className="btn btn-primary" style={{ marginLeft: '0.5rem' }} onClick={() => void goNext()}>
              {prerequisites.vscode ? 'Continue' : 'Skip for now'}
            </button>
          </>
        )}

        {currentStep === 'mic-test' && (
          <>
            <h2 className="card-title">Microphone Test</h2>
            <p>
              {sttProviderId === 'openai-whisper'
                ? 'Hold the button and say: "switch command mode". Whisper will transcribe your speech.'
                : 'Select OpenAI Whisper in the previous step to test your microphone. You can skip this with HTTP utterances.'}
            </p>
            {sttProviderId === 'openai-whisper' && (
              <MicRecorder
                label="Hold to record test phrase"
                onRecording={runMicTest}
                disabled={!prerequisites.openai}
              />
            )}
            {micTranscript && (
              <div className="practice-result">
                <strong>Transcript:</strong> {micTranscript}
              </div>
            )}
            {progress?.micTestPassed && (
              <p style={{ color: 'var(--status-ok)' }}>Mic test passed</p>
            )}
            <button type="button" className="btn btn-primary" onClick={() => void goNext()}>
              Continue to tutorial
            </button>
          </>
        )}

        {currentStep === 'tutorial' && lessons[lessonIndex] && (
          <>
            <h2 className="card-title">Tutorial — {lessons[lessonIndex].title}</h2>
            <p>{lessons[lessonIndex].description}</p>
            {lessons[lessonIndex].setupHint && (
              <p className="wizard-hint">Tip: {lessons[lessonIndex].setupHint}</p>
            )}
            <p>
              Lesson {lessonIndex + 1} of {lessons.length} ·{' '}
              {progress?.tutorialCompletedIds.length ?? 0} completed
            </p>
            <div className="field">
              <label>Type or speak the command</label>
              <input
                value={practiceText}
                onChange={(e) => setPracticeText(e.target.value)}
                placeholder={lessons[lessonIndex].sampleUtterance}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="btn btn-primary" onClick={() => void runPractice(true)}>
                Check answer
              </button>
              <button type="button" className="btn" onClick={() => {
                setPracticeText(lessons[lessonIndex].sampleUtterance);
              }}>
                Show example
              </button>
              {sttProviderId === 'openai-whisper' && (
                <MicRecorder
                  label="Hold to speak"
                  onRecording={async (b64, mime) => {
                    const res = await api.transcribe(b64, mime, false);
                    setPracticeText(res.transcript);
                  }}
                />
              )}
            </div>
            {practiceResult && (
              <div className={`practice-result${practiceResult.startsWith('Correct') ? ' ok' : ' fail'}`}>
                {practiceResult}
              </div>
            )}
            {(progress?.tutorialCompletedIds.length ?? 0) >= 3 && (
              <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => void goNext()}>
                Finish tutorial
              </button>
            )}
          </>
        )}

        {currentStep === 'complete' && (
          <>
            <h2 className="card-title">You&apos;re ready</h2>
            <p>
              Completed {progress?.tutorialCompletedIds.length ?? 0} tutorial lessons.
              Open the dashboard to monitor live state, or jump straight into voice commands.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <Link to="/" className="btn btn-primary">Open Dashboard</Link>
              <Link to="/tutorial" className="btn">More practice</Link>
            </div>
            <button
              type="button"
              className="btn"
              style={{ marginTop: '1rem' }}
              onClick={() => void api.completeOnboardingStep('complete').then(() => navigate('/'))}
            >
              Mark onboarding complete
            </button>
          </>
        )}
      </div>

      <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <button type="button" className="btn-link" onClick={() => void api.dismissOnboarding().then(() => navigate('/'))}>
          Dismiss wizard
        </button>
        {' · '}
        <button type="button" className="btn-link" onClick={() => void api.resetOnboarding().then(() => load())}>
          Reset progress
        </button>
      </p>
    </>
  );
}
