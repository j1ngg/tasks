import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv, isAuthConfigured, type AppEnv } from "./env";

export const SESSION_COOKIE = "tcc_session";
const OAUTH_STATE_COOKIE = "tcc_oauth_state";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

export interface AppSession {
  login: string;
  name?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthorizedActor {
  type: "owner" | "agent";
  label: string;
}

export function createOAuthState() {
  return crypto.randomBytes(24).toString("base64url");
}

export function setOAuthState(response: NextResponse, state: string) {
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  });
}

export function readOAuthState(request: NextRequest) {
  return request.cookies.get(OAUTH_STATE_COOKIE)?.value;
}

export function clearOAuthState(response: NextResponse) {
  response.cookies.delete(OAUTH_STATE_COOKIE);
}

export function setSession(response: NextResponse, session: AppSession, env = getEnv()) {
  response.cookies.set(SESSION_COOKIE, signSession(session, env), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE
  });
}

export function clearSession(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE);
}

export function getSession(request: NextRequest, env = getEnv()): AppSession | null {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  return getSessionFromCookieValue(cookie, env);
}

export function getSessionFromCookieValue(cookie: string | undefined, env = getEnv()): AppSession | null {
  if (!cookie || !env.sessionSecret) return null;
  return verifySession(cookie, env);
}

export async function authorizeRequest(request: NextRequest, env = getEnv()): Promise<AuthorizedActor> {
  const auth = request.headers.get("authorization");
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer && env.taskAgentToken && safeEqual(bearer, env.taskAgentToken)) {
    return { type: "agent", label: "agent" };
  }

  const session = getSession(request, env);
  if (session) return { type: "owner", label: session.login };

  throw new UnauthorizedError();
}

export function getGitHubOAuthUrl(state: string, env = getEnv()) {
  if (!isAuthConfigured(env)) throw new Error("GitHub OAuth is not configured.");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.githubClientId!);
  url.searchParams.set("redirect_uri", `${env.appUrl.replace(/\/$/, "")}/api/auth/github/callback`);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeGitHubCode(code: string, env = getEnv()) {
  if (!isAuthConfigured(env)) throw new Error("GitHub OAuth is not configured.");
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: env.githubClientId,
      client_secret: env.githubClientSecret,
      code,
      redirect_uri: `${env.appUrl.replace(/\/$/, "")}/api/auth/github/callback`
    })
  });

  if (!tokenResponse.ok) throw new Error("Could not exchange GitHub OAuth code.");
  const tokenPayload = (await tokenResponse.json()) as { access_token?: string; error_description?: string };
  if (!tokenPayload.access_token) {
    throw new Error(tokenPayload.error_description ?? "GitHub did not return an access token.");
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenPayload.access_token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!userResponse.ok) throw new Error("Could not read GitHub user.");
  const user = (await userResponse.json()) as { login: string; name?: string; avatar_url?: string };
  if (user.login !== env.githubAllowedOwner) {
    throw new UnauthorizedError(`GitHub user ${user.login} is not allowed to access this task app.`);
  }

  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    createdAt: new Date().toISOString()
  } satisfies AppSession;
}

export class UnauthorizedError extends Error {
  status = 401;

  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function signSession(session: AppSession, env: AppEnv) {
  if (!env.sessionSecret) throw new Error("SESSION_SECRET is required.");
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(cookie: string, env: AppEnv): AppSession | null {
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature || !env.sessionSecret) return null;
  const expected = crypto.createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AppSession;
  } catch {
    return null;
  }
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
