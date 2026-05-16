import { createImportId } from "../ids";
import type { ImportSuggestion, Space } from "../types";

const GRANOLA_API = "https://public-api.granola.ai/v1";

interface GranolaListResponse {
  notes?: GranolaNoteSummary[];
  hasMore?: boolean;
  cursor?: string;
}

interface GranolaNoteSummary {
  id: string;
  title?: string;
  created_at?: string;
  createdAt?: string;
  url?: string;
  summary?: string;
}

interface GranolaNoteDetail extends GranolaNoteSummary {
  summary?: string;
  transcript?: Array<{ text?: string }>;
  owner?: { name?: string; email?: string };
}

export interface GranolaScanOptions {
  apiKey: string;
  createdAfter?: string;
  space?: Space;
  project?: string;
  fetchImpl?: typeof fetch;
}

export async function scanGranolaFollowups(options: GranolaScanOptions): Promise<ImportSuggestion[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const notes = await listGranolaNotes(options.apiKey, options.createdAfter, fetchImpl);
  const imports: ImportSuggestion[] = [];

  for (const note of notes) {
    const detail = await getGranolaNote(options.apiKey, note.id, fetchImpl);
    imports.push(...granolaNoteToImports(detail, options));
  }

  return imports;
}

export function granolaNoteToImports(
  note: GranolaNoteDetail,
  options: Pick<GranolaScanOptions, "space" | "project"> = {}
): ImportSuggestion[] {
  const title = note.title ?? "Untitled meeting";
  const summary = note.summary ?? "";
  const candidates = extractActionLines(summary);
  const now = new Date().toISOString();
  const sourceLink = {
    source: "granola" as const,
    id: note.id,
    title,
    url: note.url
  };

  if (!candidates.length) {
    return [
      {
        id: createImportId("granola", note.id),
        source: "granola",
        sourceId: note.id,
        title: `Review follow-ups from ${title}`,
        body: summary || "Granola did not expose explicit action items. Review this meeting for follow-ups.",
        status: "pending",
        suggestedTask: {
          title: `Review follow-ups from ${title}`,
          space: options.space ?? "work",
          project: options.project ?? "meetings",
          status: "idea",
          contextLinks: note.url ? [{ type: "granola", label: title, url: note.url }] : [],
          sourceLinks: [sourceLink],
          body: summary
        },
        sourceLinks: [sourceLink],
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  return candidates.map((candidate, index) => ({
    id: createImportId("granola", `${note.id}-${index + 1}`),
    source: "granola",
    sourceId: `${note.id}-${index + 1}`,
    title: candidate,
    body: `From ${title}\n\n${summary}`,
    status: "pending",
    suggestedTask: {
      title: candidate,
      space: options.space ?? "work",
      project: options.project ?? "meetings",
      status: "idea",
      contextLinks: note.url ? [{ type: "granola", label: title, url: note.url }] : [],
      sourceLinks: [sourceLink],
      body: `Source meeting: ${title}\n\n${summary}`
    },
    sourceLinks: [sourceLink],
    createdAt: now,
    updatedAt: now
  }));
}

export function extractActionLines(summary: string) {
  return summary
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .map((line) => line.replace(/^(actions?|action items?|todos?|follow[- ]?ups?)\s*:\s*/i, "").trim())
    .filter((line) => /(^|\b)(action|todo|follow up|follow-up|send|draft|review|confirm|schedule|share|update|decide)\b/i.test(line))
    .map((line) => line.replace(/^\[[ x]\]\s*/i, "").replace(/^@\w+\s*[-:]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

async function listGranolaNotes(apiKey: string, createdAfter: string | undefined, fetchImpl: typeof fetch) {
  const notes: GranolaNoteSummary[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`${GRANOLA_API}/notes`);
    if (createdAfter) url.searchParams.set("created_after", createdAfter);
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) throw new Error(`Granola notes request failed with ${response.status}.`);
    const payload = (await response.json()) as GranolaListResponse;
    notes.push(...(payload.notes ?? []));
    cursor = payload.hasMore ? payload.cursor : undefined;
  } while (cursor);

  return notes;
}

async function getGranolaNote(apiKey: string, id: string, fetchImpl: typeof fetch) {
  const url = new URL(`${GRANOLA_API}/notes/${id}`);
  url.searchParams.set("include", "transcript");
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) throw new Error(`Granola note ${id} request failed with ${response.status}.`);
  return (await response.json()) as GranolaNoteDetail;
}
