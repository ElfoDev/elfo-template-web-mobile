import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

/** Centered card layout shared by the sign-in and sign-up screens. */
export function AuthScreen({ title, subtitle, children }: Props) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white dark:bg-neutral-950"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-grow items-center justify-center p-6"
      >
        <View className="w-full max-w-sm gap-6">
          <View className="gap-1">
            <Text role="heading" className="text-3xl font-bold text-neutral-900 dark:text-white">
              {title}
            </Text>
            <Text className="text-base text-neutral-600 dark:text-neutral-400">{subtitle}</Text>
          </View>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
