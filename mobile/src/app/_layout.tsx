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
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="add-product"
          options={{
            title: "Add Product",
          }}
        />

        <Stack.Screen
          name="edit-product"
          options={{
            title: "Edit Product",
          }}
        />

        <Stack.Screen
          name="product-categories"
          options={{
            title: "Product Categories",
          }}
        />

        <Stack.Screen
          name="edit-product-category"
          options={{
            title: "Edit Category",
          }}
        />

        <Stack.Screen
          name="add-order"
          options={{
            title: "Create Order",
          }}
        />

        <Stack.Screen
          name="order-detail"
          options={{
            title: "Order Detail",
          }}
        />

        <Stack.Screen
          name="add-expense"
          options={{
            title: "Add Expense",
          }}
        />

        <Stack.Screen
          name="edit-expense"
          options={{
            title: "Edit Expense",
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
      </Stack>
    </ThemeProvider>
  );
}