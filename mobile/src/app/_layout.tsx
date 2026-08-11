import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AppHeaderBackButton } from "@/components/ui/AppHeaderBackButton";
import { UI } from "@/constants/ui";

SplashScreen.preventAutoHideAsync();

const affectedScreenBackButton = {
  headerLeft: ({ canGoBack }: { canGoBack?: boolean }) =>
    canGoBack ? <AppHeaderBackButton /> : null,
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />

      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: UI.colors.surface },
          headerTintColor: UI.colors.ink,
          headerTitleStyle: { fontWeight: "700" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: UI.colors.canvas },
        }}
      >
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
            ...affectedScreenBackButton,
          }}
        />

        <Stack.Screen
          name="edit-product"
          options={{
            title: "Edit Product",
            ...affectedScreenBackButton,
          }}
        />

        <Stack.Screen
          name="product-categories"
          options={{
            title: "Product Categories",
            ...affectedScreenBackButton,
          }}
        />

        <Stack.Screen
          name="edit-product-category"
          options={{
            title: "Edit Category",
            ...affectedScreenBackButton,
          }}
        />

        <Stack.Screen
          name="add-order"
          options={{
            title: "Create Order",
            ...affectedScreenBackButton,
          }}
        />

        <Stack.Screen
          name="order-detail"
          options={{
            title: "Order Detail",
            ...affectedScreenBackButton,
          }}
        />

        <Stack.Screen
          name="add-expense"
          options={{
            title: "Add Expense",
            ...affectedScreenBackButton,
          }}
        />

        <Stack.Screen
          name="edit-expense"
          options={{
            title: "Edit Expense",
            ...affectedScreenBackButton,
          }}
        />

        <Stack.Screen
          name="stock-movements"
          options={{
            title: "Stock Movements",
            ...affectedScreenBackButton,
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
