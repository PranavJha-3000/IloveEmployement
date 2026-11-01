"use client";

import { useEffect, useId, useRef, useState } from "react";
import { canonicalizeSkill, normalizeSkills, suggestSkills, type NormalizedSkill } from "@/lib/skills/normalize";
import { fieldDomId } from "./ReviewField";

const UNKNOWN_HELP = "We don't recognize this skill, so it's kept as you wrote it. Tools match skills by exact name for now.";

/** Collapses entries that resolve to the same skill, keeping the first position and every spelling. */
export function mergeSkills(list: NormalizedSkill[]): NormalizedSkill[] {
  const out: NormalizedSkill[] = [];
  const byKey = new Map<string, NormalizedSkill>();
  for (const s of list) {
    const key = s.canonicalId ? `id:${s.canonicalId}` : `raw:${s.name.trim().toLowerCase()}`;
    const have = byKey.get(key);
    if (have) {
      for (const m of s.matchedFrom) if (!have.matchedFrom.includes(m)) have.matchedFrom.push(m);
    } else {
      const copy = { ...s, matchedFrom: [...s.matchedFrom] };
      byKey.set(key, copy);
      out.push(copy);
    }
  }
  return out;
}

const aliasesOf = (s: NormalizedSkill) => s.matchedFrom.filter((m) => m.trim().toLowerCase() !== s.name.trim().toLowerCase());

function aliasNote(s: NormalizedSkill): string {
  const aliases = aliasesOf(s);
  if (!aliases.length) return "";
  const shown = aliases.slice(0, 2).join(", ");
  return aliases.length > 2 ? `from ${shown} +${aliases.length - 2}` : `from ${shown}`;
}

interface Props {
  skills: NormalizedSkill[];
  onChange: (skills: NormalizedSkill[]) => void;
  /** Called for "Keep as written" so the parent can mark the skill confirmed. */
  onKeep?: (index: number) => void;
  /** Which skills the user has already confirmed (custom skills kept as written lose the warning look). */
  confirmed?: boolean[];
}

export function SkillEditor({ skills, onChange, onKeep, confirmed = [] }: Props) {
  const uid = useId();
  const [open, setOpen] = useState<number | null>(null);
  const [rename, setRename] = useState("");
  const [undo, setUndo] = useState<{ skill: NormalizedSkill; index: number } | null>(null);
  const [text, setText] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [message, setMessage] = useState("");
  const addRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);

  const suggestions = listOpen && text.trim() ? suggestSkills(text, 6) : [];
  const unknownCount = skills.filter((s) => s.canonicalId === null).length;

  useEffect(() => {
    if (open !== null && open >= skills.length) setOpen(null);
  }, [skills.length, open]);

  function commit(next: NormalizedSkill[]) {
    setUndo(null);
    setMessage("");
    onChange(mergeSkills(next));
  }

  function addRaw(raw: string) {
    const clean = raw.trim();
    if (!clean) return;
    commit([...skills, ...normalizeSkills([clean])]);
    setText("");
    setListOpen(false);
    setActive(-1);
    addRef.current?.focus();
  }

  function remove(index: number) {
    const skill = skills[index];
    onChange(skills.filter((_, i) => i !== index));
    setUndo({ skill, index });
    setMessage(`Removed ${skill.name}.`);
    setOpen(null);
    // Keep focus inside the editor while the chip disappears.
    requestAnimationFrame(() => (undoRef.current ?? addRef.current)?.focus());
  }

  function doUndo() {
    if (!undo) return;
    const next = [...skills];
    next.splice(Math.min(undo.index, next.length), 0, undo.skill);
    setUndo(null);
    setMessage("");
    onChange(mergeSkills(next));
  }

  function applyRename(index: number) {
    const raw = rename.trim();
    if (!raw) return;
    const replaced = normalizeSkills([raw])[0];
    const next = skills.map((s, i) => (i === index ? replaced : s));
    commit(next);
    setOpen(null);
    requestAnimationFrame(() => document.getElementById(fieldDomId(`skills.${Math.min(index, next.length - 1)}`))?.focus());
  }

  function onAddKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      if (listOpen) {
        e.preventDefault();
        setListOpen(false);
        setActive(-1);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && suggestions[active]) addRaw(suggestions[active].matched);
      else addRaw(text);
    }
  }

  const listId = `${uid}-list`;

  return (
    <div className="skill-editor">
      <ul className="skill-list" aria-label="Skills">
        {skills.map((s, i) => {
          const unknown = s.canonicalId === null;
          const kept = unknown && confirmed[i] === true;
          const note = aliasNote(s);
          const panelId = `${uid}-panel-${i}`;
          const isOpen = open === i;
          const spoken = unknown ? `${s.name}, not in taxonomy, kept as written` : note ? `${s.name}, normalized ${note}` : s.name;
          return (
            <li key={`${s.canonicalId ?? s.name}-${i}`} className="skill-item">
              <button
                type="button"
                id={fieldDomId(`skills.${i}`)}
                data-path={`skills.${i}`}
                className="skill-chip"
                data-unknown={unknown && !kept ? "true" : undefined}
                aria-expanded={isOpen}
                aria-controls={panelId}
                aria-label={spoken}
                onClick={() => {
                  setOpen(isOpen ? null : i);
                  setRename(s.name);
                }}
              >
                <span className="skill-chip-name">{s.name}</span>
                {note && <span className="skill-chip-note">{note}</span>}
                {unknown && !kept && (
                  <span className="skill-chip-flag" aria-hidden="true">
                    <span className="skill-flag-long">Not in taxonomy</span>
                    <span className="skill-flag-short">?</span>
                  </span>
                )}
              </button>
              {isOpen && (
                <div
                  id={panelId}
                  className="skill-panel"
                  role="group"
                  aria-label={`${s.name} details`}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setOpen(null);
                      document.getElementById(fieldDomId(`skills.${i}`))?.focus();
                    }
                  }}
                >
                  <p className="skill-panel-line">
                    <strong>{unknown ? "As written" : "Canonical name"}:</strong> {s.name}
                  </p>
                  {s.matchedFrom.length > 0 && (
                    <p className="skill-panel-line">
                      <strong>Matched from:</strong> {s.matchedFrom.join(", ")}
                    </p>
                  )}
                  {unknown && <p className="review-field-note">{UNKNOWN_HELP}</p>}
                  <div className="skill-rename">
                    <label htmlFor={`${panelId}-rename`} className="field-label">
                      Rename
                    </label>
                    <input
                      id={`${panelId}-rename`}
                      className="field-control"
                      value={rename}
                      autoComplete="off"
                      onChange={(e) => setRename(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyRename(i);
                        }
                      }}
                    />
                  </div>
                  <div className="skill-panel-actions">
                    <button type="button" className="cta-secondary review-btn" onClick={() => applyRename(i)} disabled={!rename.trim()}>
                      Apply rename
                    </button>
                    {unknown && (
                      <button
                        type="button"
                        className="cta-secondary review-btn"
                        aria-pressed={kept}
                        onClick={() => {
                          onKeep?.(i);
                          setOpen(null);
                          document.getElementById(fieldDomId(`skills.${i}`))?.focus();
                        }}
                      >
                        Keep as written
                      </button>
                    )}
                    <button type="button" className="review-textbtn" onClick={() => remove(i)}>
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="review-field-note" data-testid="skill-count">
        {skills.length} {skills.length === 1 ? "skill" : "skills"}
        {unknownCount > 0 ? ` · ${unknownCount} not in taxonomy` : ""}
      </p>

      <div role="status" className="skill-undo">
        {undo && (
          <>
            <span>{message}</span>
            <button type="button" ref={undoRef} className="review-textbtn" onClick={doUndo}>
              Undo
            </button>
          </>
        )}
      </div>

      <div className="skill-add">
        <label htmlFor={`${uid}-add`} className="field-label">
          Add a skill
        </label>
        <div className="skill-combo">
          <input
            id={`${uid}-add`}
            ref={addRef}
            className="field-control"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${uid}-opt-${active}` : undefined}
            autoComplete="off"
            placeholder="Add a skill, e.g. JavaScript"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setListOpen(true);
              setActive(-1);
            }}
            onKeyDown={onAddKey}
            onBlur={() => setListOpen(false)}
          />
          {suggestions.length > 0 && (
            <ul id={listId} role="listbox" className="skill-suggest" aria-label="Skill suggestions">
              {suggestions.map((s, i) => {
                const viaAlias = s.matched.trim().toLowerCase() !== s.entry.name.toLowerCase() && canonicalizeSkill(s.matched).known;
                return (
                  <li
                    key={s.entry.id}
                    id={`${uid}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className="skill-option"
                    data-active={i === active ? "true" : undefined}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addRaw(s.matched);
                    }}
                  >
                    {s.entry.name}
                    {viaAlias && <span className="skill-option-hint"> matched from {s.matched}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
