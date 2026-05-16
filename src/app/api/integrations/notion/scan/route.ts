import type { NextRequest } from "next/server";
import { errorResponse, getAuthorizedStore, withApiAuth } from "@/lib/api";
import { getEnv, getWritableContentRepository } from "@/lib/env";
import { scanNotionSources } from "@/lib/integrations/notion";
import { readSourceConfig } from "@/lib/sources";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return withApiAuth(request, async () => {
    const env = getEnv();
    if (!env.notionApiToken) throw new Error("NOTION_API_TOKEN is not configured.");

    const config = await readSourceConfig(getWritableContentRepository(env));
    if (!config.notionDatabases.length) {
      return { imports: [], warning: "No Notion databases configured in config/sources.yml." };
    }

    const imports = await scanNotionSources({
      apiToken: env.notionApiToken,
      sources: config.notionDatabases
    });
    const store = getAuthorizedStore();
    const saved = [];
    for (const item of imports) {
      saved.push(await store.upsertImport(item));
    }
    return { imports: saved };
  }).catch(errorResponse);
}
