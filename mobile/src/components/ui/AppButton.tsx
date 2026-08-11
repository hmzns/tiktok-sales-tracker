import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { UI } from "../../constants/ui";

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
  accessibilityLabel?: string;
  compact?: boolean;
};

export function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  loadingLabel,
  icon,
  accessibilityLabel,
  compact = false,
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const displayedLabel = loading ? loadingLabel ?? label : label;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        styles[variant],
        pressed && !isDisabled && styles[`${variant}Pressed`],
        isDisabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconSlot}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={variant === "primary" ? UI.colors.onDark : UI.colors.ink}
            />
          ) : (
            icon ?? null
          )}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            styles[`${variant}Label`],
            isDisabled && styles.disabledLabel,
          ]}
        >
          {displayedLabel}
        </Text>
        <View style={styles.iconSlot} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: UI.control.buttonHeight,
    minWidth: UI.control.minTouchTarget,
    paddingHorizontal: UI.spacing.md,
    borderRadius: UI.radius.small,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  compact: { paddingHorizontal: UI.spacing.sm },
  primary: {
    backgroundColor: UI.colors.primary,
    borderColor: UI.colors.primary,
    ...UI.shadowSubtle,
  },
  secondary: {
    backgroundColor: UI.colors.surface,
    borderColor: UI.colors.borderStrong,
  },
  destructive: {
    backgroundColor: UI.colors.dangerSoft,
    borderColor: UI.colors.dangerSoft,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  primaryPressed: { backgroundColor: UI.colors.primaryPressed },
  secondaryPressed: { backgroundColor: UI.colors.surfaceMuted },
  destructivePressed: { opacity: 0.78 },
  ghostPressed: { backgroundColor: UI.colors.surfaceMuted },
  disabled: {
    backgroundColor: UI.colors.disabled,
    borderColor: UI.colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  content: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: UI.spacing.xs,
  },
  iconSlot: { width: 16, alignItems: "center" },
  label: { fontSize: 13, fontWeight: "800", textAlign: "center" },
  primaryLabel: { color: UI.colors.onDark },
  secondaryLabel: { color: UI.colors.ink },
  destructiveLabel: { color: UI.colors.danger },
  ghostLabel: { color: UI.colors.primary },
  disabledLabel: { color: UI.colors.disabledText },
});
