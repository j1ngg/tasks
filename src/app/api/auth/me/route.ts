import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getSetupWarnings, isAuthConfigured } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    session: getSession(request),
    authConfigured: isAuthConfigured(),
    setupWarnings: getSetupWarnings()
  });
}
