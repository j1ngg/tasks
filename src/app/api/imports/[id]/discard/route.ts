import type { NextRequest } from "next/server";
import { getAuthorizedStore, withApiAuth } from "@/lib/api";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withApiAuth(request, async () => {
    const { id } = await context.params;
    return { import: await getAuthorizedStore().discardImport(id) };
  });
}
