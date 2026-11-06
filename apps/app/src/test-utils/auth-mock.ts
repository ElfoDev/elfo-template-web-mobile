/**
 * Fake `@/lib/auth-client` for Jest (installed for every test in `jest/setup.ts`), so tests
 * never touch Better Auth, the network or expo-secure-store.
 *
 * The session is a tiny external store: `setSession()` re-renders every `useSession()`
 * consumer, just like Better Auth does after sign-in or sign-out.
 */
import { useSyncExternalStore } from "react";
import type { Session } from "@/lib/auth-client";

let current: Session | null = null;
const listeners = new Set<() => void>();

export function setSession(session: Session | null): void {
  current = session;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function fakeSession(user: Partial<Session["user"]> = {}): Session {
  const now = new Date("2026-01-15T12:00:00.000Z");
  return {
    user: {
      id: "user-1",
      name: "Ana Souza",
      email: "ana@example.com",
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
      ...user,
    },
    session: {
      id: "session-1",
      userId: user.id ?? "user-1",
      token: "token",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      ipAddress: null,
      userAgent: null,
      createdAt: now,
      updatedAt: now,
    },
  };
}

type AuthResult = {
  data: unknown;
  error: { code?: string; message?: string; status: number } | null;
};

const ok = async (): Promise<AuthResult> => ({ data: {}, error: null });

export const authClient = {
  useSession() {
    const data = useSyncExternalStore(subscribe, () => current);
    return { data, isPending: false, isRefetching: false, error: null, refetch: ok };
  },
  signIn: {
    email: jest.fn<Promise<AuthResult>, [{ email: string; password: string }]>(ok),
    social: jest.fn<Promise<AuthResult>, [{ provider: string; callbackURL?: string }]>(ok),
  },
  signUp: {
    email: jest.fn<Promise<AuthResult>, [{ name: string; email: string; password: string }]>(ok),
  },
  signOut: jest.fn<Promise<AuthResult>, []>(ok),
  getCookie: jest.fn(async () => ""),
};

/** Module shape of `@/lib/auth-client`, for `jest.mock`. */
export const authClientModule = {
  authClient,
  authHeaders: async () => ({}),
  refreshSession: jest.fn(),
};

export function resetAuthMock(): void {
  setSession(null);
  for (const fn of [
    authClient.signIn.email,
    authClient.signIn.social,
    authClient.signUp.email,
    authClient.signOut,
  ]) {
    fn.mockReset();
    fn.mockImplementation(ok);
  }
  authClientModule.refreshSession.mockReset();
}
