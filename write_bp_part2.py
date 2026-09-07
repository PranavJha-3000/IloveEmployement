import os

path = r"c:\Users\prana\OneDrive\Desktop\Code\IloveEmployement\components\BulletPointFixerPage.tsx"

content = '''

interface IdleViewProps {
  phase: Phase;
  error: string;
  validationError: string;
  canSubmit: boolean;
  config: AiRequestConfig;
  setConfig: (c: AiRequestConfig) => void;
  bullet: string;
  setBullet: (v: string) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
  roleContext: string;
  setRoleContext: (v: string) => void;
  technology: string;
  setTechnology: (v: string) => void;
  desperationLevel: number;
  onFix: (e: React.FormEvent) => void;
}

function IdleView({
  phase,
  error,
  validationError,
  canSubmit,
  config,
  setConfig,
  bullet,
  setBullet,
  jobDescription,
  setJobDescription,
  roleContext,
  setRoleContext,
  technology,
  setTechnology,
  onFix,
}: IdleViewProps) {
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Fix that bullet.
        </h1>
        <p className="mt-2 text-sm text-zinc-500 max-w-xl leading-relaxed">
          Because "worked on a project" is not exactly making recruiters levitate.
        </p>

        <form onSubmit={onFix} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>Your inputs</h2>
            </div>

            <div className="mb-4">
              <label htmlFor="bulletText" className="field-label">
                Resume Bullet <span className="text-red-500">*</span>
              </label>
              <textarea
                id="bulletText"
                value={bullet}
                onChange={(e) => setBullet(e.target.value)}
                disabled={phase === "loading"}
                placeholder="Paste your resume bullet here..."
                rows={4}
                className="field-control bullet-input"
              />
              <p className="field-help">One bullet at a time. Be specific for better results.</p>
            </div>

            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="fixBulletJd" className="field-label">
                  Job Description (optional)
                </label>
                <textarea
                  id="fixBulletJd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="Paste target JD for keyword alignment"
                  rows={5}
                  className="field-control jd-input"
                />
                <p className="field-help">Optional. Helps align terminology.</p>
              </div>
              <div className="input-pane space-y-4">
                <div>
                  <label htmlFor="roleContext" className="field-label">
                    Role / Context (optional)
                  </label>
                  <input
                    id="roleContext"
                    type="text"
                    value={roleContext}
                    onChange={(e) => setRoleContext(e.target.value)}
                    disabled={phase === "loading"}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="field-control"
                  />
                </div>
                <div>
                  <label htmlFor="technology" className="field-label">
                    Technology (optional)
                  </label>
                  <input
                    id="technology"
                    type="text"
                    value={technology}
                    onChange={(e) => setTechnology(e.target.value)}
                    disabled={phase === "loading"}
                    placeholder="e.g. React, AWS, Python"
                    className="field-control"
                  />
                </div>
              </div>
            </div>

            <div className="config-card">
              <ProviderConfig config={config} onChange={setConfig} compact />
            </div>

            {(validationError || error) && (
              <div className="form-error" role="alert">
                {validationError || error}
              </div>
            )}

            <div className="action-row">
              <button
                type="submit"
                disabled={!canSubmit || phase === "loading"}
                className="cta-primary action-primary"
              >
                Fix This Bullet <span aria-hidden>&rarr;</span>
              </button>
            </div>
            <p className="field-help text-center">
              Runs on your own API key. Sent per-request, never stored. TRUTH FILTER always on.
            </p>
          </section>
        </form>
      </div>
    </main>
  );
}
'''

with open(path, "a", encoding="utf-8") as f:
    f.write(content)

print(f"Successfully appended part 2 ({len(content)} chars), total: {os.path.getsize(path)} bytes")