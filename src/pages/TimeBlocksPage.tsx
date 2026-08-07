import { useEffect, useState } from "react";
import { Clock, Pause, Play, RotateCcw } from "lucide-react";

type TimeBlockMode = "focus" | "break";

const defaultFocusMinutes = 40;
const defaultBreakMinutes = 10;

export function TimeBlocksPage() {
  const [focusMinutes, setFocusMinutes] = useState(defaultFocusMinutes);
  const [breakMinutes, setBreakMinutes] = useState(defaultBreakMinutes);
  const [timeBlockMode, setTimeBlockMode] = useState<TimeBlockMode>("focus");
  const [timeBlockRunning, setTimeBlockRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(defaultFocusMinutes * 60);
  const [completedFocusBlocks, setCompletedFocusBlocks] = useState(0);

  useEffect(() => {
    if (!timeBlockRunning) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current > 1) return current - 1;
        if (timeBlockMode === "focus") {
          setTimeBlockMode("break");
          setCompletedFocusBlocks((count) => count + 1);
          return breakMinutes * 60;
        }
        setTimeBlockMode("focus");
        return focusMinutes * 60;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [breakMinutes, focusMinutes, timeBlockMode, timeBlockRunning]);

  function updateFocusMinutes(value: number) {
    const minutes = clampTimerMinutes(value, defaultFocusMinutes);
    setFocusMinutes(minutes);
    if (!timeBlockRunning && timeBlockMode === "focus") setRemainingSeconds(minutes * 60);
  }

  function updateBreakMinutes(value: number) {
    const minutes = clampTimerMinutes(value, defaultBreakMinutes);
    setBreakMinutes(minutes);
    if (!timeBlockRunning && timeBlockMode === "break") setRemainingSeconds(minutes * 60);
  }

  function resetTimeBlock(mode: TimeBlockMode = timeBlockMode) {
    setTimeBlockRunning(false);
    setTimeBlockMode(mode);
    setRemainingSeconds((mode === "focus" ? focusMinutes : breakMinutes) * 60);
  }

  return (
    <div className="page time-blocks-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Dobrostan</span>
          <h1>Bloki czasu</h1>
          <p className="page-subtitle">Prosty rytm pracy i przerw, np. 40 minut skupienia i 10 minut regeneracji.</p>
        </div>
        <div className="header-summary">{completedFocusBlocks} bloków fokus</div>
      </header>

      <section className="panel wellbeing-form wellbeing-timeblock-panel">
        <div className="panel-header">
          <h2><Clock size={18} />Bloki czasu</h2>
          <span>{completedFocusBlocks} bloków fokus</span>
        </div>
        <div className={`wellbeing-timeblock-display ${timeBlockMode}`}>
          <span className="eyebrow">{timeBlockMode === "focus" ? "Fokus" : "Przerwa"}</span>
          <strong>{formatTimer(remainingSeconds)}</strong>
          <p>{timeBlockMode === "focus" ? `Pracuj przez ${focusMinutes} min, potem ${breakMinutes} min przerwy.` : `Odpocznij ${breakMinutes} min, potem wróć do ${focusMinutes} min pracy.`}</p>
        </div>
        <div className="wellbeing-timeblock-controls">
          <label>
            <span>Praca</span>
            <input type="number" min="5" max="180" value={focusMinutes} onChange={(event) => updateFocusMinutes(Number(event.target.value))} />
          </label>
          <label>
            <span>Przerwa</span>
            <input type="number" min="1" max="60" value={breakMinutes} onChange={(event) => updateBreakMinutes(Number(event.target.value))} />
          </label>
          <button className="primary-button" type="button" onClick={() => setTimeBlockRunning((running) => !running)}>
            {timeBlockRunning ? <Pause size={16} /> : <Play size={16} />}
            {timeBlockRunning ? "Pauza" : "Start"}
          </button>
          <button className="secondary-button" type="button" onClick={() => resetTimeBlock()}>
            <RotateCcw size={16} />Reset
          </button>
        </div>
        <div className="wellbeing-actions">
          <button className="secondary-button" type="button" onClick={() => resetTimeBlock("focus")}>Fokus</button>
          <button className="secondary-button" type="button" onClick={() => resetTimeBlock("break")}>Przerwa</button>
        </div>
      </section>
    </div>
  );
}

function clampTimerMinutes(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(180, Math.round(value)));
}

function formatTimer(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
