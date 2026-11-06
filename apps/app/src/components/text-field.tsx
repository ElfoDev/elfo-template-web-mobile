import { Text, TextInput, type TextInputProps, View } from "react-native";

type Props = Omit<TextInputProps, "className"> & {
  label: string;
  error?: string;
};

export function TextField({ label, error, ...input }: Props) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</Text>
      <TextInput
        aria-label={label}
        placeholderTextColor="#a3a3a3"
        className={`h-12 rounded-xl border bg-white px-4 text-base text-neutral-900 dark:bg-neutral-900 dark:text-white ${error ? "border-red-500" : "border-neutral-300 dark:border-neutral-700"}`}
        {...input}
      />
      {error ? <Text className="text-sm text-red-600 dark:text-red-400">{error}</Text> : null}
    </View>
  );
}
