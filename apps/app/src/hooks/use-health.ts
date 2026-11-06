import type { HealthResponse } from "@repo/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHealth } from "@/lib/api";

export type HealthState =
  | { status: "loading" }
  | { status: "ok"; data: HealthResponse }
  | { status: "error"; error: string };

/** Calls `GET /health` on mount and exposes `refetch` for retries. */
export function useHealth() {
  const [state, setState] = useState<HealthState>({ status: "loading" });
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    setState({ status: "loading" });
    try {
      const data = await fetchHealth();
      if (id === requestId.current) setState({ status: "ok", data });
    } catch (err) {
      if (id === requestId.current) {
        setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
      }
    }
  }, []);

  useEffect(() => {
    void refetch();
    return () => {
      // Ignore responses that arrive after unmount.
      requestId.current++;
    };
  }, [refetch]);

  return { state, refetch };
}
