import { ScrollView, Text, View } from "react-native";
import { EasterEgg } from "@/components/easter-egg";
import { HealthCard } from "@/components/health-card";
import { useEasterEgg } from "@/hooks/use-easter-egg";
import { useHealth } from "@/hooks/use-health";
import { API_URL } from "@/lib/api";

export default function HomeScreen() {
  const { state, refetch } = useHealth();
  const easterEgg = useEasterEgg();

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-neutral-950"
      contentContainerClassName="flex-grow items-center justify-center gap-6 p-6"
    >
      <View className="items-center gap-2">
        <Text className="text-center text-3xl font-bold text-neutral-900 dark:text-white">
          Elfo · Web + Mobile
        </Text>
        <Text className="text-center text-base text-neutral-600 dark:text-neutral-400">
          Um app Expo para iOS, Android e Web, com API Hono no Cloudflare Workers.
        </Text>
      </View>

      <EasterEgg state={easterEgg} />

      <HealthCard state={state} apiUrl={API_URL} onRetry={refetch} />
    </ScrollView>
  );
}
