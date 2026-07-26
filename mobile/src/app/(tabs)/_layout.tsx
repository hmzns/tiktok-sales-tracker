import { Tabs } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { UI } from "../../constants/ui";

const TabIcon = ({
  label,
  focused,
}: {
  label: string;
  focused: boolean;
}) => (
  <Text style={[styles.icon, focused && styles.activeIcon]}>{label}</Text>
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
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarItemStyle: {
          borderRadius: UI.radius.medium,
          marginHorizontal: 2,
        },
        tabBarActiveTintColor: UI.colors.primary,
        tabBarInactiveTintColor: UI.colors.inkMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="⌂" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarLabel: "Products",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="□" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarLabel: "Orders",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="≡" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarLabel: "Expenses",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="−" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarLabel: "Reports",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="↗" focused={focused} />
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
    color: UI.colors.inkMuted,
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 23,
    textAlign: "center",
  },
  activeIcon: {
    color: UI.colors.primary,
    backgroundColor: UI.colors.primarySoft,
  },
});
