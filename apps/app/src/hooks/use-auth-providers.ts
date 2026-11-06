import type { SocialProvider } from "@repo/shared";
import { useEffect, useState } from "react";
import { fetchAuthProviders } from "@/lib/api";

/**
 * OAuth providers enabled on the API (`GET /auth/providers`). Empty while loading or if
 * the request fails: email + password always works.
 */
export function useSocialProviders(): SocialProvider[] {
  const [providers, setProviders] = useState<SocialProvider[]>([]);

  useEffect(() => {
    let active = true;
    fetchAuthProviders()
      .then((res) => {
        if (active) setProviders(res.social);
      })
      .catch(() => {
        // Optional feature: just hide the buttons.
      });
    return () => {
      active = false;
    };
  }, []);

  return providers;
}
