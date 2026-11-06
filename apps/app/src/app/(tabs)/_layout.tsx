import { Tabs } from "expo-router/tabs";
import { type ColorValue, Image, type ImageSourcePropType } from "react-native";

function tabIcon(source: ImageSourcePropType) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Image source={source} style={{ width: size, height: size, tintColor: color }} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: tabIcon(require("../../../assets/images/tabIcons/home.png")),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: "Sobre",
          tabBarIcon: tabIcon(require("../../../assets/images/tabIcons/explore.png")),
        }}
      />
    </Tabs>
  );
}
