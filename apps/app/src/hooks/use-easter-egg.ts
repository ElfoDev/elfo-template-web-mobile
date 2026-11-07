import type { EasterEggResponse } from "@repo/shared";
import { useEffect, useState } from "react";
import { fetchEasterEgg } from "@/lib/api";

export type EasterEggState =
  | { status: "loading" }
  | { status: "ok"; data: EasterEggResponse }
  | { status: "error"; error: string };

/** Calls `GET /api/easter-egg` once on mount. Failures become an error state, never a throw. */
export function useEasterEgg(): EasterEggState {
  const [state, setState] = useState<EasterEggState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetchEasterEgg().then(
      (data) => {
        if (active) setState({ status: "ok", data });
      },
      (err: unknown) => {
        if (active) {
          setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
        }
      },
    );
    return () => {
      // Ignore a response that arrives after unmount.
      active = false;
    };
  }, []);

  return state;
}
