import type { NextRequest } from "next/server";
import { getAuthorizedStore, withApiAuth } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withApiAuth(request, async () => {
    const url = new URL(request.url);
    const source = url.searchParams.get("source");
    return {
      imports: await getAuthorizedStore().listImports(
        source === "granola" || source === "notion" || source === "github" || source === "manual" ? source : undefined
      )
    };
  });
}
