import { Pressable, StyleSheet, Text } from "react-native";
import { UI } from "../constants/ui";

type FloatingBackToTopProps = {
  visible: boolean;
  onPress: () => void;
  label?: string;
};

export function FloatingBackToTop({
  visible,
  onPress,
  label,
}: FloatingBackToTopProps) {
  if (!visible) {
    return null;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        label && styles.labeledButton,
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? "Back to top"}
    >
      <Text style={label ? styles.label : styles.arrow}>{label ?? "↑"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.colors.ink,
    borderWidth: 1,
    borderColor: "#FFFFFF24",
    ...UI.shadow,
  },
  buttonPressed: {
    transform: [{ scale: 0.96 }],
  },
  labeledButton: { width: "auto", minWidth: 48, paddingHorizontal: 14 },
  label: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  arrow: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
  },
});
