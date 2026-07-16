import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,

        tabBarStyle: {
          backgroundColor: "#000000",
          borderTopColor: "#ddd",
          height: 60,
          paddingTop: 3,
        },

        tabBarItemStyle: {
          borderRadius: 10,
          marginHorizontal: 4,
          marginVertical: 6,
        },

        tabBarActiveBackgroundColor: "#111",
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#ffffff",

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Home",
        }}
      />

      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarLabel: "Products",
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarLabel: "Orders",
        }}
      />

      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarLabel: "Expenses",
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarLabel: "Reports",
        }}
      />
    </Tabs>
  );
}