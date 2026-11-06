import { Text, View } from "react-native";

/** Error banner for a form or screen; renders nothing without a message. */
export function FormMessage({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View
      role="alert"
      accessible
      accessibilityLiveRegion="polite"
      className="rounded-xl bg-red-50 p-3 dark:bg-red-950"
    >
      <Text className="text-sm text-red-700 dark:text-red-300">{message}</Text>
    </View>
  );
}
