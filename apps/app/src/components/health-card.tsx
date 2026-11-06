import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { HealthState } from "@/hooks/use-health";

type Props = {
  state: HealthState;
  apiUrl: string;
  onRetry: () => void;
};

export function HealthCard({ state, apiUrl, onRetry }: Props) {
  return (
    <View className="w-full max-w-md gap-3 rounded-2xl bg-neutral-100 p-5 dark:bg-neutral-900">
      <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Status da API
      </Text>

      {state.status === "loading" && (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator />
          <Text className="text-base text-neutral-700 dark:text-neutral-300">Verificando…</Text>
        </View>
      )}

      {state.status === "ok" && (
        <View className="gap-1">
          <Text className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            ● Online
          </Text>
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">
            {state.data.service} · {new Date(state.data.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      )}

      {state.status === "error" && (
        <View className="gap-2">
          <Text className="text-lg font-semibold text-red-600 dark:text-red-400">● Offline</Text>
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">{state.error}</Text>
          <Pressable
            role="button"
            onPress={onRetry}
            className="self-start rounded-lg bg-neutral-900 px-4 py-2 active:opacity-70 dark:bg-white"
          >
            <Text className="font-medium text-white dark:text-neutral-900">Tentar de novo</Text>
          </Pressable>
        </View>
      )}

      <Text selectable className="text-xs text-neutral-500 dark:text-neutral-500">
        {apiUrl}
      </Text>
    </View>
  );
}
