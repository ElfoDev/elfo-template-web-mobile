import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/tabs";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    // React Navigation passes plain color strings.
    <Ionicons name={name} size={size} color={typeof color === "string" ? color : undefined} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{ title: "Início", tabBarIcon: tabIcon("home-outline") }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: "Tarefas", tabBarIcon: tabIcon("checkbox-outline") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Perfil", tabBarIcon: tabIcon("person-circle-outline") }}
      />
      <Tabs.Screen
        name="about"
        options={{ title: "Sobre", tabBarIcon: tabIcon("information-circle-outline") }}
      />
    </Tabs>
  );
}
