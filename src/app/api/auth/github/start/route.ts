import { NextResponse } from "next/server";
import { createOAuthState, getGitHubOAuthUrl, setOAuthState } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = createOAuthState();
    const response = NextResponse.redirect(getGitHubOAuthUrl(state));
    setOAuthState(response, state);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
