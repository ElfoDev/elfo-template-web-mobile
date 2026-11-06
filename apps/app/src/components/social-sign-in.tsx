import type { SocialProvider } from "@repo/shared";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/button";
import { useSocialProviders } from "@/hooks/use-auth-providers";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

const LABELS: Record<SocialProvider, string> = {
  github: "GitHub",
  google: "Google",
};

/**
 * OAuth buttons for the providers enabled on the API. On the web the browser is redirected;
 * on iOS/Android the `expoClient` plugin opens an auth session and stores the cookie.
 */
export function SocialSignIn({ onError }: { onError: (message: string | null) => void }) {
  const providers = useSocialProviders();
  const [pending, setPending] = useState<SocialProvider | null>(null);

  if (providers.length === 0) return null;

  async function signIn(provider: SocialProvider) {
    onError(null);
    setPending(provider);
    try {
      // Back to the app after the provider: the web URL, or a deep link (exp:// in Expo Go).
      // The API must trust it (TRUSTED_ORIGINS).
      const callbackURL = Linking.createURL("/");
      const { error } = await authClient.signIn.social({ provider, callbackURL });
      if (error) onError(authErrorMessage(error));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        <Text className="text-sm text-neutral-500">ou</Text>
        <View className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </View>
      {providers.map((provider) => (
        <Button
          key={provider}
          variant="secondary"
          title={`Continuar com ${LABELS[provider]}`}
          loading={pending === provider}
          disabled={pending !== null}
          onPress={() => void signIn(provider)}
        />
      ))}
    </View>
  );
}
