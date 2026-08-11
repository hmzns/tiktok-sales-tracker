import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { UI } from "../../constants/ui";

export function AppHeaderBackButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      accessibilityHint="Returns to the previous screen"
      hitSlop={4}
      onPress={() => router.back()}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text accessible={false} style={styles.icon}>
        {"\u2190"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: UI.control.minTouchTarget,
    minHeight: UI.control.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: UI.spacing.xxs,
    paddingHorizontal: UI.spacing.xs,
    borderRadius: UI.radius.small,
  },
  buttonPressed: {
    backgroundColor: UI.colors.surfaceMuted,
  },
  icon: {
    color: UI.colors.ink,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "700",
  },
});
