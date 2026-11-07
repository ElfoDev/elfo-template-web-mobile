import { ActivityIndicator, Text, View } from "react-native";
import type { EasterEggState } from "@/hooks/use-easter-egg";

type Props = {
  state: EasterEggState;
};

/**
 * Preview Easter Egg: the front-end half is always visible; the backend half is the message
 * from `GET /api/easter-egg`, or a discreet error when the API does not answer.
 */
export function EasterEgg({ state }: Props) {
  return (
    <View
      testID="easter-egg"
      className="w-full max-w-md items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950"
    >
      <Text className="text-4xl" accessibilityLabel="Ovo">
        🥚
      </Text>
      <Text className="text-center text-lg font-semibold text-amber-900 dark:text-amber-200">
        Easter Egg do preview
      </Text>

      {state.status === "loading" && (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator />
          <Text className="text-sm text-amber-800 dark:text-amber-300">Procurando no backend…</Text>
        </View>
      )}

      {state.status === "ok" && (
        <Text className="text-center text-sm text-amber-800 dark:text-amber-300">
          {state.data.message}
        </Text>
      )}

      {state.status === "error" && (
        <Text className="text-center text-xs text-neutral-500 dark:text-neutral-400">
          Easter Egg do backend indisponível ({state.error})
        </Text>
      )}
    </View>
  );
}
