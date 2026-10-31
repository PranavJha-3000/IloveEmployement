import { redactSecrets } from "../../lib/pipeline";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Model ids that support generateContent. The key goes only in the x-goog-api-key header. */
export async function listGoogleModels(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const url = `${BASE}?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await fetchImpl(url, { headers: { "x-goog-api-key": apiKey } });
    if (!res.ok) {
      const body = redactSecrets(await res.text().catch(() => "")).slice(0, 300);
      throw new Error(redactSecrets(`Model listing failed: HTTP ${res.status} ${res.statusText} ${body}`).trim());
    }
    const json = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[]; nextPageToken?: string };
    for (const m of json.models ?? []) {
      if (m.supportedGenerationMethods?.includes("generateContent")) ids.push(m.name.replace(/^models\//, ""));
    }
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return ids;
}
