import { StyleSheet, Text } from "react-native";
import { UI } from "../../constants/ui";

export type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger";

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  accessibilityLabel?: string;
};

export function StatusBadge({
  label,
  tone = "neutral",
  accessibilityLabel,
}: StatusBadgeProps) {
  return (
    <Text
      accessibilityLabel={accessibilityLabel ?? `Status: ${label}`}
      style={[styles.badge, styles[`${tone}Badge`]]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: UI.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: UI.type.caption,
    lineHeight: 15,
    fontWeight: "800",
  },
  neutralBadge: {
    color: UI.colors.inkMuted,
    backgroundColor: UI.colors.surfaceMuted,
  },
  primaryBadge: {
    color: UI.colors.primary,
    backgroundColor: UI.colors.primarySoft,
  },
  successBadge: {
    color: UI.colors.success,
    backgroundColor: UI.colors.successSoft,
  },
  warningBadge: {
    color: UI.colors.warning,
    backgroundColor: UI.colors.warningSoft,
  },
  dangerBadge: {
    color: UI.colors.danger,
    backgroundColor: UI.colors.dangerSoft,
  },
});
