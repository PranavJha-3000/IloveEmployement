"use client";

import { createContext, useContext, useEffect, useId, useReducer, useRef, useState, type Dispatch, type ReactNode, type RefObject } from "react";
import {
  canConfirm,
  fieldStatus,
  getFieldValue,
  initReview,
  needsLookPaths,
  reviewReducer,
  splitBullets,
  summaryCounts,
  type ItemGroup,
  type ReviewAction,
  type ReviewState,
} from "@/lib/profile/reviewState";
import {
  fieldPaths,
  MSG_NAME_REQUIRED,
  validateProfile,
  type ConfirmedProfile,
  type ExtractionResult,
  type StructuredProfile,
  type YearMonth,
} from "@/lib/profile/schema";
import { normalizeSkills } from "@/lib/skills/normalize";
import { fieldDomId, ReviewField, type ReviewControlProps } from "./ReviewField";
import { SkillEditor } from "./SkillEditor";

export const PROFILE_REVIEW_HEADING_ID = "profile-review-heading";

/** Moves focus to the panel heading (call after extraction finishes). */
export function focusProfileReview(): void {
  const el = document.getElementById(PROFILE_REVIEW_HEADING_ID);
  el?.focus();
  el?.scrollIntoView({ block: "start" });
}

const NOT_FOUND = "Not found. Add it or leave blank.";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface Props {
  initial: { result: ExtractionResult } | { saved: ConfirmedProfile };
  onConfirm: (profile: StructuredProfile) => Promise<void>;
  onDiscard: () => void;
  confirming: boolean;
  headerExtra?: ReactNode;
}

const NOUN: Record<Exclude<ItemGroup, "links">, string> = { roles: "role", education: "school", projects: "project" };

// ─── Inputs with local text, so normalisation never fights typing ────────────

function BulletsInput({ value, onChange, ...rest }: { value: string[]; onChange: (v: string) => void } & ReviewControlProps & { placeholder?: string; onBlur?: () => void }) {
  const [text, setText] = useState(value.join("\n"));
  useEffect(() => {
    // Re-sync only when the stored bullets stop matching what the box would produce (e.g. a role was removed above).
    if (JSON.stringify(splitBullets(text)) !== JSON.stringify(value)) setText(value.join("\n"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <textarea
      {...rest}
      className="field-control"
      rows={4}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}

const sameYm = (a: YearMonth | null, b: YearMonth | null) => (a === null && b === null) || (!!a && !!b && a.year === b.year && a.month === b.month);

function DateInput({
  value,
  onChange,
  onBlur,
  disabled,
  label,
  ...rest
}: { value: YearMonth | null; onChange: (v: YearMonth | null) => void; onBlur: () => void; disabled?: boolean; label: string } & ReviewControlProps) {
  const [m, setM] = useState(value?.month ? String(value.month) : "");
  const [y, setY] = useState(value ? String(value.year) : "");
  const toValue = (mm: string, yy: string): YearMonth | null => (/^\d{1,4}$/.test(yy) ? { year: Number(yy), month: mm ? Number(mm) : null } : null);
  useEffect(() => {
    if (!sameYm(toValue(m, y), value)) {
      setM(value?.month ? String(value.month) : "");
      setY(value ? String(value.year) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="review-date">
      <select
        {...rest}
        className="field-control"
        aria-label={`${label} month`}
        value={m}
        disabled={disabled}
        onChange={(e) => {
          setM(e.target.value);
          onChange(toValue(e.target.value, y));
        }}
        onBlur={onBlur}
      >
        <option value="">Month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={String(i + 1)}>
            {name}
          </option>
        ))}
      </select>
      <input
        id={`${rest.id}-year`}
        data-path={rest["data-path"]}
        className="field-control"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        aria-label={`${label} year`}
        aria-invalid={rest["aria-invalid"]}
        aria-describedby={rest["aria-describedby"]}
        placeholder="Year"
        value={y}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "");
          setY(next);
          onChange(toValue(m, next));
        }}
        onBlur={onBlur}
      />
    </div>
  );
}

// ─── Shared context (components below are module-level so inputs keep focus) ─

interface Ctx {
  state: ReviewState;
  dispatch: Dispatch<ReviewAction>;
  uid: string;
  removing: string | null;
  setRemoving: (key: string | null) => void;
  keepRef: RefObject<HTMLButtonElement | null>;
  removeItem: (group: ItemGroup, index: number) => void;
  setFocusId: (id: string | null) => void;
}

const ReviewCtx = createContext<Ctx | null>(null);

function useCtx(): Ctx {
  const c = useContext(ReviewCtx);
  if (!c) throw new Error("Review components must render inside ProfileReview");
  return c;
}

function Text({
  path,
  label,
  wide,
  cardTitleId,
  type = "text",
  autoComplete,
  inputMode,
}: {
  path: string;
  label: string;
  wide?: boolean;
  cardTitleId?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "email" | "tel" | "url";
}) {
  const { state, dispatch } = useCtx();
  const status = fieldStatus(state, path);
  const raw = getFieldValue(state.profile, path);
  return (
    <ReviewField
      path={path}
      label={label}
      status={status}
      error={state.errors[path]}
      wide={wide}
      cardTitleId={cardTitleId}
      onToggleConfirm={() => dispatch({ type: "toggleConfirm", path })}
    >
      {(props) => (
        <input
          {...props}
          className="field-control"
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete ?? "off"}
          placeholder={status === "empty" ? NOT_FOUND : undefined}
          value={raw === null || raw === undefined ? "" : String(raw)}
          onChange={(e) => dispatch({ type: "edit", path, value: e.target.value })}
          onBlur={() => dispatch({ type: "blur", path })}
        />
      )}
    </ReviewField>
  );
}

function Area({ path, label, cardTitleId, bullets }: { path: string; label: string; cardTitleId?: string; bullets?: boolean }) {
  const { state, dispatch } = useCtx();
  const status = fieldStatus(state, path);
  const raw = getFieldValue(state.profile, path);
  return (
    <ReviewField
      path={path}
      label={label}
      status={status}
      error={state.errors[path]}
      help={bullets ? "One bullet per line." : undefined}
      wide
      cardTitleId={cardTitleId}
      onToggleConfirm={() => dispatch({ type: "toggleConfirm", path })}
    >
      {(props) =>
        bullets ? (
          <BulletsInput
            {...props}
            value={(raw as string[]) ?? []}
            placeholder={status === "empty" ? NOT_FOUND : undefined}
            onChange={(v) => dispatch({ type: "edit", path, value: v })}
            onBlur={() => dispatch({ type: "blur", path })}
          />
        ) : (
          <textarea
            {...props}
            className="field-control"
            rows={3}
            placeholder={status === "empty" ? NOT_FOUND : undefined}
            value={String(raw ?? "")}
            onChange={(e) => dispatch({ type: "edit", path, value: e.target.value })}
            onBlur={() => dispatch({ type: "blur", path })}
          />
        )
      }
    </ReviewField>
  );
}

function DateField({ path, label, cardTitleId, disabled }: { path: string; label: string; cardTitleId?: string; disabled?: boolean }) {
  const { state, dispatch } = useCtx();
  const status = fieldStatus(state, path);
  return (
    <ReviewField
      path={path}
      label={label}
      status={status}
      error={state.errors[path]}
      cardTitleId={cardTitleId}
      onToggleConfirm={() => dispatch({ type: "toggleConfirm", path })}
    >
      {(props) => (
        <DateInput
          {...props}
          label={label}
          value={(getFieldValue(state.profile, path) as YearMonth | null) ?? null}
          disabled={disabled}
          onChange={(v) => dispatch({ type: "edit", path, value: v })}
          onBlur={() => dispatch({ type: "blur", path })}
        />
      )}
    </ReviewField>
  );
}

function Card({ group, index, title, children }: { group: Exclude<ItemGroup, "links">; index: number; title: string; children: ReactNode }) {
  const { uid, removing, setRemoving, keepRef, removeItem } = useCtx();
  const titleId = `${uid}-${group}-${index}-title`;
  const key = `${group}-${index}`;
  const noun = NOUN[group];
  return (
    <div className="review-card" role="group" aria-labelledby={titleId}>
      <p id={titleId} className="review-card-title">
        {title}
      </p>
      <div className="review-grid">{children}</div>
      <div className="review-card-actions">
        {removing === key ? (
          <div className="review-inline-confirm" role="group" aria-label={`Remove ${noun}`}>
            <p>Remove this {noun} from the profile? You can re-add it later.</p>
            <div className="review-inline-buttons">
              <button type="button" ref={keepRef} className="cta-secondary review-btn" onClick={() => setRemoving(null)}>
                Keep {noun}
              </button>
              <button type="button" className="cta-secondary review-btn review-btn-danger" onClick={() => removeItem(group, index)}>
                Remove {noun}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" id={`${uid}-rm-${group}-${index}`} className="review-textbtn" onClick={() => setRemoving(key)}>
            Remove {noun}
          </button>
        )}
      </div>
    </div>
  );
}

function AddButton({ group, label }: { group: ItemGroup; label: string }) {
  const { state, dispatch, uid, setFocusId } = useCtx();
  const p = state.profile;
  return (
    <button
      type="button"
      id={`${uid}-add-${group}`}
      className="cta-secondary review-btn"
      onClick={() => {
        dispatch({ type: "addItem", group });
        const count = group === "links" ? p.contact.links.length : p[group].length;
        const first = group === "roles" ? "title" : group === "education" ? "degree" : group === "projects" ? "name" : "";
        setFocusId(fieldDomId(group === "links" ? `contact.links.${count}` : `${group}.${count}.${first}`));
      }}
    >
      {label}
    </button>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function ProfileReview({ initial, onConfirm, onDiscard, confirming, headerExtra }: Props) {
  const uid = useId();
  const [state, dispatch] = useReducer(reviewReducer, initial, initReview);
  const [blocked, setBlocked] = useState(0);
  const [discarding, setDiscarding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [nextMsg, setNextMsg] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const discardKeepRef = useRef<HTMLButtonElement>(null);

  const p = state.profile;
  const counts = summaryCounts(state);
  const nameMissing = p.contact.name.trim() === "";

  useEffect(() => {
    if (focusId) {
      document.getElementById(focusId)?.focus();
      setFocusId(null);
    }
  }, [focusId]);
  useEffect(() => {
    if (removing) keepRef.current?.focus();
  }, [removing]);
  useEffect(() => {
    if (discarding) discardKeepRef.current?.focus();
  }, [discarding]);

  const removeItem = (group: ItemGroup, index: number) => {
    dispatch({ type: "removeItem", group, index });
    setRemoving(null);
    // Focus moves to the previous card’s Remove button, or the group’s Add button when none is left.
    setFocusId(index > 0 ? `${uid}-rm-${group}-${index - 1}` : `${uid}-add-${group}`);
  };
  const ctx: Ctx = { state, dispatch, uid, removing, setRemoving, keepRef, removeItem, setFocusId };

  // ─ actions
  function nextToCheck() {
    const list = needsLookPaths(state);
    if (!list.length) {
      setNextMsg("No more fields to check.");
      return;
    }
    setNextMsg("");
    const order = fieldPaths(p);
    const active = document.activeElement as HTMLElement | null;
    const current = active?.dataset?.path;
    const from = current ? order.indexOf(current) : -1;
    const next = list.find((path) => order.indexOf(path) > from) ?? list[0];
    const el = document.getElementById(fieldDomId(next));
    el?.focus();
    el?.scrollIntoView({ block: "center" });
  }

  async function confirm() {
    dispatch({ type: "attemptConfirm" });
    const errors = validateProfile(p);
    const bad = Object.keys(errors);
    if (bad.length) {
      setBlocked(bad.length);
      const first = fieldPaths(p).find((path) => errors[path]) ?? bad[0];
      requestAnimationFrame(() => document.getElementById(fieldDomId(first))?.focus());
      return;
    }
    setBlocked(0);
    await onConfirm(p);
  }

  const headingId = PROFILE_REVIEW_HEADING_ID;
  const needs = counts.needsLook;

  return (
    <ReviewCtx.Provider value={ctx}>
    <section className="review-panel rounded-xl border border-zinc-200" aria-labelledby={headingId} aria-busy={confirming || undefined}>
      <div className="review-header">
        <div>
          <h2 id={headingId} tabIndex={-1} className="text-[15px] font-bold text-zinc-900">
            Review your profile
          </h2>
          <p role="status" className="review-summary">
            {needs} {needs === 1 ? "field needs" : "fields need"} a look · {counts.confirmed} confirmed of {counts.total}
          </p>
        </div>
        <div className="review-header-actions">
          <button type="button" className="cta-secondary review-btn" onClick={nextToCheck}>
            Next field to check
          </button>
          {headerExtra}
        </div>
        <p role="status" className="review-summary">
          {nextMsg}
        </p>
      </div>

      <div className="review-body">
        <fieldset className="review-group">
          <legend>
            <h3>Contact</h3>
          </legend>
          <div className="review-grid">
            <Text path="contact.name" label="Name" autoComplete="name" />
            <Text path="contact.email" label="Email" type="email" autoComplete="email" inputMode="email" />
            <Text path="contact.phone" label="Phone" type="tel" autoComplete="tel" inputMode="tel" />
            <Text path="contact.location" label="Location" autoComplete="off" />
            {p.contact.links.map((_, i) => (
              <div key={i} className="review-link-row" data-wide="true">
                <Text path={`contact.links.${i}`} label={`Link ${i + 1}`} type="url" autoComplete="url" inputMode="url" />
                <button
                  type="button"
                  className="review-textbtn"
                  onClick={() => {
                    dispatch({ type: "removeItem", group: "links", index: i });
                    setFocusId(i > 0 ? fieldDomId(`contact.links.${i - 1}`) : `${uid}-add-links`);
                  }}
                >
                  Remove link {i + 1}
                </button>
              </div>
            ))}
          </div>
          <div className="review-add">
            <AddButton group="links" label="Add link" />
          </div>
        </fieldset>

        <fieldset className="review-group">
          <legend>
            <h3>Roles</h3>
          </legend>
          {p.roles.map((r, i) => {
            const cardTitle = `${uid}-roles-${i}-title`;
            return (
              <Card key={i} group="roles" index={i} title={`Role ${i + 1}`}>
                <Text path={`roles.${i}.title`} label="Title" cardTitleId={cardTitle} />
                <Text path={`roles.${i}.company`} label="Company" cardTitleId={cardTitle} />
                <DateField path={`roles.${i}.start`} label="Start" cardTitleId={cardTitle} />
                <div className="review-end">
                  <DateField path={`roles.${i}.end`} label="End" cardTitleId={cardTitle} disabled={r.current} />
                  <label className="review-check">
                    <input type="checkbox" checked={r.current} onChange={(e) => dispatch({ type: "edit", path: `roles.${i}.current`, value: e.target.checked })} />
                    <span>Current role</span>
                  </label>
                </div>
                <Text path={`roles.${i}.location`} label="Location" cardTitleId={cardTitle} />
                <Area path={`roles.${i}.bullets`} label="Bullets" cardTitleId={cardTitle} bullets />
              </Card>
            );
          })}
          <div className="review-add">
            <AddButton group="roles" label="Add a role" />
          </div>
        </fieldset>

        <fieldset className="review-group">
          <legend>
            <h3>Education</h3>
          </legend>
          {p.education.map((_, i) => {
            const cardTitle = `${uid}-education-${i}-title`;
            return (
              <Card key={i} group="education" index={i} title={`School ${i + 1}`}>
                <Text path={`education.${i}.degree`} label="Degree" cardTitleId={cardTitle} />
                <Text path={`education.${i}.institution`} label="Institution" cardTitleId={cardTitle} />
                <Text path={`education.${i}.startYear`} label="Start year" cardTitleId={cardTitle} inputMode="numeric" />
                <Text path={`education.${i}.endYear`} label="End year" cardTitleId={cardTitle} inputMode="numeric" />
                <Text path={`education.${i}.detail`} label="Detail" cardTitleId={cardTitle} wide />
              </Card>
            );
          })}
          <div className="review-add">
            <AddButton group="education" label="Add a school" />
          </div>
        </fieldset>

        <fieldset className="review-group">
          <legend>
            <h3>Skills</h3>
          </legend>
          <SkillEditor
            skills={p.skills}
            confirmed={p.skills.map((_, i) => fieldStatus(state, `skills.${i}`) === "confirmed")}
            onKeep={(i) => dispatch({ type: "toggleConfirm", path: `skills.${i}` })}
            onChange={(skills) => dispatch({ type: "setSkills", skills })}
          />
        </fieldset>

        <fieldset className="review-group">
          <legend>
            <h3>Projects</h3>
          </legend>
          {p.projects.map((pr, i) => {
            const cardTitle = `${uid}-projects-${i}-title`;
            return (
              <Card key={i} group="projects" index={i} title={`Project ${i + 1}`}>
                <Text path={`projects.${i}.name`} label="Name" cardTitleId={cardTitle} />
                <Text path={`projects.${i}.link`} label="Link" cardTitleId={cardTitle} type="url" inputMode="url" />
                <Area path={`projects.${i}.description`} label="Description" cardTitleId={cardTitle} />
                <div className="review-field" data-wide="true">
                  <label htmlFor={`${uid}-ps-${i}`} className="field-label">
                    Skills used
                  </label>
                  <input
                    id={`${uid}-ps-${i}`}
                    className="field-control"
                    autoComplete="off"
                    aria-describedby={`${uid}-ps-${i}-help`}
                    value={pr.skills.join(", ")}
                    onChange={(e) => dispatch({ type: "edit", path: `projects.${i}.skills`, value: e.target.value.split(",") })}
                  />
                  <p id={`${uid}-ps-${i}-help`} className="review-field-note">
                    Separate skills with commas.
                  </p>
                  {pr.skills.length > 0 && (
                    <ul className="skill-list" aria-label="Skills used">
                      {normalizeSkills(pr.skills).map((s) => (
                        <li key={s.name} className="skill-item">
                          <span className="skill-chip" data-static="true" data-unknown={s.canonicalId === null ? "true" : undefined}>
                            <span className="skill-chip-name">{s.name}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            );
          })}
          <div className="review-add">
            <AddButton group="projects" label="Add a project" />
          </div>
        </fieldset>
      </div>

      <div className="review-footer">
        {blocked > 0 && (
          <p role="alert" className="form-error">
            Fix {blocked} {blocked === 1 ? "field" : "fields"} before confirming.
          </p>
        )}
        {nameMissing && <p className="review-field-note">{MSG_NAME_REQUIRED}</p>}
        {discarding ? (
          <div className="review-inline-confirm" role="group" aria-label="Discard profile">
            <p>Discard this profile? Your edits and confirmations will be lost. Your resume text stays in the box so you can extract it again.</p>
            <div className="review-inline-buttons">
              <button type="button" ref={discardKeepRef} className="cta-secondary review-btn" onClick={() => setDiscarding(false)}>
                Keep reviewing
              </button>
              <button type="button" className="cta-secondary review-btn review-btn-danger" onClick={onDiscard}>
                Discard profile
              </button>
            </div>
          </div>
        ) : (
          <div className="review-footer-actions">
            <button type="button" className="review-textbtn" onClick={() => setDiscarding(true)}>
              Discard
            </button>
            <button type="button" className="cta-secondary review-btn" onClick={() => dispatch({ type: "confirmAllHigh" })}>
              Confirm all high-confidence fields
            </button>
            <button type="button" className="cta-primary" disabled={!canConfirm(state) || confirming} onClick={() => void confirm()}>
              {confirming ? "Saving…" : "Confirm profile"}
            </button>
          </div>
        )}
      </div>
    </section>
    </ReviewCtx.Provider>
  );
}
