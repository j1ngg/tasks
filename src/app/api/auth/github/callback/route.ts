import { NextResponse, type NextRequest } from "next/server";
import { clearOAuthState, exchangeGitHubCode, readOAuthState, setSession } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const expectedState = readOAuthState(request);

    if (!code || !state || !expectedState || state !== expectedState) {
      throw new Error("GitHub OAuth state did not match.");
    }

    const session = await exchangeGitHubCode(code);
    const response = NextResponse.redirect(getEnv().appUrl);
    clearOAuthState(response);
    setSession(response, session);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
