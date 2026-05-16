import type { NextRequest } from "next/server";
import { getAuthorizedStore, readJson, withApiAuth } from "@/lib/api";
import type { TaskFilters, TaskRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withApiAuth(request, async () => {
    const url = new URL(request.url);
    const filters: TaskFilters = {
      q: url.searchParams.get("q") ?? undefined,
      space: parseSpace(url.searchParams.get("space")),
      project: url.searchParams.get("project") ?? undefined,
      status: parseStatus(url.searchParams.get("status")),
      includeDone: url.searchParams.get("includeDone") === "true"
    };
    return { tasks: await getAuthorizedStore().listTasks(filters) };
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async () => {
    const input = await readJson<Partial<TaskRecord> & Pick<TaskRecord, "title" | "space" | "project">>(request);
    return { task: await getAuthorizedStore().createTask(input) };
  });
}

function parseSpace(value: string | null) {
  return value === "personal" || value === "work" ? value : undefined;
}

function parseStatus(value: string | null) {
  return value === "idea" ||
    value === "in_progress" ||
    value === "in_review" ||
    value === "delegated" ||
    value === "done"
    ? value
    : undefined;
}
