import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { FormMessage } from "@/components/form-message";
import { authClient } from "@/lib/auth-client";

export default function ProfileScreen() {
  const { data: session } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setError(null);
    setSigningOut(true);
    try {
      // The session turns null and the route guard goes back to sign-in.
      const result = await authClient.signOut();
      if (result.error) setError(result.error.message ?? "Não foi possível sair.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSigningOut(false);
    }
  }

  const user = session?.user;
  const initial = user?.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-neutral-950"
      contentContainerClassName="items-center gap-6 p-6"
    >
      <View className="w-full max-w-md items-center gap-3 rounded-2xl bg-neutral-100 p-6 dark:bg-neutral-900">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-neutral-900 dark:bg-white">
          <Text className="text-3xl font-bold text-white dark:text-neutral-900">{initial}</Text>
        </View>
        <Text className="text-xl font-semibold text-neutral-900 dark:text-white">{user?.name}</Text>
        <Text className="text-base text-neutral-600 dark:text-neutral-400">{user?.email}</Text>
        {user && (
          <Text className="text-xs text-neutral-500">
            Conta criada em {new Date(user.createdAt).toLocaleDateString()}
          </Text>
        )}
      </View>

      <View className="w-full max-w-md gap-3">
        <FormMessage message={error} />
        <Button variant="danger" title="Sair" loading={signingOut} onPress={() => void signOut()} />
      </View>
    </ScrollView>
  );
}
