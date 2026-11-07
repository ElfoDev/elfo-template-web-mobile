import Constants from "expo-constants";
import { Platform } from "react-native";

const API_DEV_PORT = 8787;

type ResolveApiUrlInput = {
  /** Value of `EXPO_PUBLIC_API_URL`, if set. */
  envUrl?: string;
  /** Metro host (`Constants.expoConfig.hostUri`), e.g. `192.168.0.10:8081`. */
  hostUri?: string | null;
  platform: typeof Platform.OS;
  /** Development bundle (`__DEV__`): Metro, not the deployed web app. */
  dev: boolean;
  /** Origin of the page, on the web in the browser (`window.location.origin`). */
  webOrigin?: string;
};

/**
 * Picks the API base URL (its origin: routes live under `/api` on it).
 *
 * 1. `EXPO_PUBLIC_API_URL` always wins (set it for iOS/Android builds that talk to a
 *    deployed API).
 * 2. The deployed web app: the page's own origin. The same Worker serves the web build and
 *    the API, so every environment (production, staging, a custom domain) finds its own API.
 * 3. In development, the machine running Metro on port 8787, so simulators, emulators and
 *    Expo Go on the same network all reach `pnpm dev`.
 * 4. Last resort: the Android emulator alias for the host machine, or localhost.
 */
export function resolveApiUrl({
  envUrl,
  hostUri,
  platform,
  dev,
  webOrigin,
}: ResolveApiUrlInput): string {
  const fromEnv = envUrl?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  if (platform === "web" && !dev && webOrigin) return webOrigin;

  const host = hostUri?.split(":")[0];
  if (host && platform !== "web") return `http://${host}:${API_DEV_PORT}`;

  if (platform === "android") return `http://10.0.2.2:${API_DEV_PORT}`;
  return `http://localhost:${API_DEV_PORT}`;
}

export const API_URL = resolveApiUrl({
  // Must be read as `process.env.EXPO_PUBLIC_*` literally so Expo inlines it at build time.
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  platform: Platform.OS,
  dev: __DEV__,
  // Undefined while `expo export` pre-renders the pages in Node (no request is made there).
  webOrigin:
    Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : undefined,
});
