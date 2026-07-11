import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />

      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: "Dashboard",
          }}
        />

        <Stack.Screen
          name="products"
          options={{
            title: "Products",
          }}
        />

        <Stack.Screen
          name="explore"
          options={{
            title: "Explore",
          }}
        />

        <Stack.Screen
          name="add-product"
          options={{
            title: "Add Product",
          }}
        />
        
        <Stack.Screen
          name="orders"
          options={{
            title: "Orders",
          }}
        />

        <Stack.Screen
          name="add-order"
          options={{
            title: "Create Order",
          }}
        />

        <Stack.Screen
          name="expenses"
          options={{
            title: "Expenses",
          }}
        />

        <Stack.Screen
          name="add-expense"
          options={{
            title: "Add Expense",
          }}
        />

        <Stack.Screen
          name="stock-movements"
          options={{
            title: "Stock Movements",
          }}
        />

        <Stack.Screen
          name="adjust-stock"
          options={{
            title: "Adjust Stock",
          }}
        />

        <Stack.Screen
          name="reports"
          options={{
            title: "Reports",
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}