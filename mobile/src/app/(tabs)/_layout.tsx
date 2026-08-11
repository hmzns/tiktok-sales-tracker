import { Tabs } from "expo-router";
import { StyleSheet, Text } from "react-native";
import type { ColorValue } from "react-native";
import { UI } from "../../constants/ui";

const TabIcon = ({
  label,
  focused,
  color,
}: {
  label: string;
  focused: boolean;
  color: ColorValue;
}) => (
  <Text style={[styles.icon, { color }, focused && styles.activeIcon]}>{label}</Text>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: UI.colors.surface,
          borderTopColor: UI.colors.border,
          borderTopWidth: 1,
          minHeight: 68,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarItemStyle: {
          borderRadius: UI.radius.medium,
          marginHorizontal: 2,
          minHeight: 52,
        },
        tabBarActiveBackgroundColor: UI.colors.primarySoft,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: UI.colors.primary,
        tabBarInactiveTintColor: UI.colors.inkMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Home",
          tabBarAccessibilityLabel: "Dashboard",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="⌂" focused={focused} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarLabel: "Products",
          tabBarAccessibilityLabel: "Products",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="▦" focused={focused} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarLabel: "Orders",
          tabBarAccessibilityLabel: "Orders",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="≡" focused={focused} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarLabel: "Expenses",
          tabBarAccessibilityLabel: "Expenses",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="−" focused={focused} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarLabel: "Reports",
          tabBarAccessibilityLabel: "Reports",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="▥" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 23,
    textAlign: "center",
  },
  activeIcon: {
    color: UI.colors.primary,
  },
});
