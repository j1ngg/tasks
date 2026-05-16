import type { NextRequest } from "next/server";
import { errorResponse, getAuthorizedStore, withApiAuth } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { scanGranolaFollowups } from "@/lib/integrations/granola";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return withApiAuth(request, async () => {
    const env = getEnv();
    if (!env.granolaApiKey) throw new Error("GRANOLA_API_KEY is not configured.");

    const url = new URL(request.url);
    const createdAfter =
      url.searchParams.get("createdAfter") ??
      new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString();
    const imports = await scanGranolaFollowups({
      apiKey: env.granolaApiKey,
      createdAfter,
      space: "work",
      project: "meetings"
    });

    const store = getAuthorizedStore();
    const saved = [];
    for (const item of imports) {
      saved.push(await store.upsertImport(item));
    }
    return { imports: saved };
  }).catch(errorResponse);
}
