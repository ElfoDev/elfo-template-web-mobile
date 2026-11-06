import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_URL } from "./api-url";

/**
 * Better Auth client (`/api/auth/*` on the API).
 *
 * - Web: the browser keeps the session in an HTTP-only cookie (`credentials: "include"`).
 * - iOS/Android: the `expoClient` plugin stores the cookie in expo-secure-store, sends it
 *   as a header and caches the session for offline starts. The app scheme comes from
 *   `app.json` (`exp://` in Expo Go).
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      storagePrefix: "foremanapp",
      storage: SecureStore,
    }),
  ],
});

export type Session = typeof authClient.$Infer.Session;

/** Headers that authenticate a request to our own API routes (e.g. `/tasks`). */
export async function authHeaders(): Promise<Record<string, string>> {
  if (Platform.OS === "web") return {};
  const cookie = await authClient.getCookie();
  return cookie ? { Cookie: cookie } : {};
}

/**
 * Asks Better Auth to fetch the session again (e.g. after the API answered 401). If it is
 * gone, `useSession` turns null and the route guard sends the user to sign-in.
 */
export function refreshSession(): void {
  authClient.$store.notify("$sessionSignal");
}
