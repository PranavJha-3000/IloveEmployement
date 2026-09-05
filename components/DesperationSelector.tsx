"use client";
import { DESPERATION_LEVELS } from "@/lib/prompts";
const EMOJIS = ["😌", "😐", "🙂", "😰", "😳", "😤"];
interface Props { value: number; onChange: (value: number) => void; }
export function DesperationSelector({ value, onChange }: Props) { const current = Math.min(5, Math.max(0, value)); return <div className="desperation-grid">{DESPERATION_LEVELS.map((level) => <button key={level.level} type="button" onClick={() => onChange(level.level)} aria-pressed={current === level.level} className={`desp-card ${current === level.level ? "selected" : ""}`}><span className="desp-emoji">{EMOJIS[level.level]}</span><span className="desp-num">{level.level}</span><span className="desp-label">{level.label}</span><span className="desp-note">{level.note}</span></button>)}</div>; }
