import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.redirect(getEnv().appUrl);
  clearSession(response);
  return response;
}
