import type { NextRequest } from "next/server";
import { getAuthorizedStore, readJson, withApiAuth } from "@/lib/api";
import type { Space } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withApiAuth(request, async () => ({ projects: await getAuthorizedStore().listProjects() }));
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async () => {
    const input = await readJson<{ space: Space; project: string }>(request);
    return { project: await getAuthorizedStore().ensureProject(input.space, input.project) };
  });
}
