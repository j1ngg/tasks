import type { NextRequest } from "next/server";
import { getAuthorizedStore, readJson, withApiAuth } from "@/lib/api";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withApiAuth(request, async () => {
    const { id } = await context.params;
    const body = await readJson<{ taskId: string }>(request);
    return { import: await getAuthorizedStore().mergeImport(id, body.taskId) };
  });
}
