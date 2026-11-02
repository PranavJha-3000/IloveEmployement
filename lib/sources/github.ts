// ─── GitHub evidence ─────────────────────────────────────────────────────────
// Public repos via the GitHub REST API (no scraping). Returns a compact text
// block for the prompt plus the repo names, which the finalizer uses to reject
// any repo the model "cites" that wasn't actually fetched.
// Unauthenticated calls are limited to 60/hour per IP; set GITHUB_TOKEN to raise it.

export interface GitHubEvidence {
  ok: boolean;
  detail: string;
  text: string;
  refs: string[];
}

interface Repo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics?: string[];
  fork: boolean;
  pushed_at: string;
  homepage: string | null;
}

export function parseGitHubUser(url: string): string | null {
  try {
    const u = new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`);
    if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
    const user = u.pathname.split("/").filter(Boolean)[0];
    return user && /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(user) ? user : null;
  } catch {
    return /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(url.trim()) ? url.trim() : null;
  }
}

export async function fetchGitHubEvidence(url: string): Promise<GitHubEvidence> {
  const user = parseGitHubUser(url);
  if (!user) return { ok: false, detail: "Not a GitHub profile URL.", text: "", refs: [] };

  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "iloveemployement" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const res = await fetch(`https://api.github.com/users/${user}/repos?per_page=100&sort=pushed`, {
      headers,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, detail: `GitHub user "${user}" not found.`, text: "", refs: [] };
    if (!res.ok) return { ok: false, detail: `GitHub returned ${res.status}; treat GitHub evidence as unverified.`, text: "", refs: [] };

    const repos = ((await res.json()) as Repo[])
      .filter((r) => !r.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count || b.pushed_at.localeCompare(a.pushed_at))
      .slice(0, 25);

    if (!repos.length) return { ok: true, detail: `${user} has no public non-fork repos.`, text: `GitHub user ${user}: no public original repositories.`, refs: [] };

    const lines = repos.map(
      (r) =>
        `- ${r.name} [${r.language ?? "n/a"}] ★${r.stargazers_count} forks:${r.forks_count} last push ${r.pushed_at.slice(0, 10)}` +
        `${r.topics?.length ? ` topics: ${r.topics.join(", ")}` : ""}${r.homepage ? ` site: ${r.homepage}` : ""}` +
        `${r.description ? `\n  ${r.description}` : ""}`,
    );
    return {
      ok: true,
      detail: `${repos.length} public repos from github.com/${user}.`,
      text: `GitHub user ${user} — public original repositories (most-starred first):\n${lines.join("\n")}`,
      refs: repos.map((r) => r.name),
    };
  } catch {
    return { ok: false, detail: "Couldn't reach GitHub; treat GitHub evidence as unverified.", text: "", refs: [] };
  }
}
