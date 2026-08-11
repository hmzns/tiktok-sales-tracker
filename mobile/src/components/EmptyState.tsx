import { Pressable, StyleSheet, Text, View } from "react-native";
import { UI } from "../constants/ui";

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <View style={styles.iconLine} />
        <View style={styles.iconLineShort} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    marginTop: 20,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: UI.colors.border,
    backgroundColor: UI.colors.surface,
  },
  icon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: UI.colors.surfaceMuted,
  },
  iconLine: {
    width: 22,
    height: 2,
    borderRadius: 2,
    backgroundColor: UI.colors.inkMuted,
    marginBottom: 6,
  },
  iconLineShort: {
    width: 14,
    height: 2,
    borderRadius: 2,
    backgroundColor: UI.colors.inkSubtle,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: UI.colors.ink,
    marginBottom: 6,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: UI.colors.inkMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  action: {
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 16,
    borderRadius: UI.radius.small,
    backgroundColor: UI.colors.primary,
  },
  actionPressed: { backgroundColor: UI.colors.primaryPressed },
  actionText: { color: UI.colors.onDark, fontSize: 13, fontWeight: "800" },
});
