import { Platform, ScrollView, Text, View } from "react-native";

const STACK = [
  { name: "App", detail: "Expo + Expo Router + NativeWind" },
  { name: "API", detail: "Hono no Cloudflare Workers" },
  { name: "Shared", detail: "Schemas zod e cliente tipado (Hono RPC)" },
];

export default function AboutScreen() {
  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-neutral-950"
      contentContainerClassName="gap-4 p-6"
    >
      <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Stack</Text>
      {STACK.map((item) => (
        <View key={item.name} className="rounded-xl bg-neutral-100 p-4 dark:bg-neutral-900">
          <Text className="text-base font-semibold text-neutral-900 dark:text-white">
            {item.name}
          </Text>
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">{item.detail}</Text>
        </View>
      ))}
      <Text className="text-xs text-neutral-500">Plataforma atual: {Platform.OS}</Text>
    </ScrollView>
  );
}
