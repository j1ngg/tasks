import { NextResponse, type NextRequest } from "next/server";
import { UnauthorizedError, authorizeRequest } from "./auth";
import { getEnv, getWritableTaskStore } from "./env";

export async function withApiAuth<T>(request: NextRequest, handler: () => Promise<T>) {
  try {
    await authorizeRequest(request);
    const result = await handler();
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export function getAuthorizedStore() {
  return getWritableTaskStore(getEnv());
}

export function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unexpected error.";
  const status = /not found/i.test(message) ? 404 : /not configured/i.test(message) ? 503 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}
