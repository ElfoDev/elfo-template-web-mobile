import { ActivityIndicator, Pressable, Text } from "react-native";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
  /** Accessible name, when it should differ from the visible title. */
  label?: string;
};

const CONTAINER = {
  primary: "bg-neutral-900 dark:bg-white",
  secondary: "border border-neutral-300 bg-transparent dark:border-neutral-700",
  danger: "bg-red-600",
} as const;

const TEXT = {
  primary: "text-white dark:text-neutral-900",
  secondary: "text-neutral-900 dark:text-white",
  danger: "text-white",
} as const;

export function Button({ title, onPress, variant = "primary", loading, disabled, label }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      role="button"
      aria-label={label ?? title}
      aria-disabled={inactive}
      aria-busy={loading}
      disabled={inactive}
      onPress={onPress}
      className={`h-12 flex-row items-center justify-center gap-2 rounded-xl px-4 active:opacity-70 ${CONTAINER[variant]} ${inactive ? "opacity-50" : ""}`}
    >
      {loading && <ActivityIndicator size="small" />}
      <Text className={`text-base font-semibold ${TEXT[variant]}`}>{title}</Text>
    </Pressable>
  );
}
