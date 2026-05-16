import type { NextRequest } from "next/server";
import { getAuthorizedStore, readJson, withApiAuth } from "@/lib/api";
import type { TaskRecord } from "@/lib/types";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return withApiAuth(request, async () => {
    const { id } = await context.params;
    const task = await getAuthorizedStore().getTask(id);
    if (!task) throw new Error(`Task ${id} not found.`);
    return { task };
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withApiAuth(request, async () => {
    const { id } = await context.params;
    const patch = await readJson<Partial<TaskRecord>>(request);
    return { task: await getAuthorizedStore().updateTask(id, patch) };
  });
}
