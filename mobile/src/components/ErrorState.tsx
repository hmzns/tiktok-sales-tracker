import { Pressable, StyleSheet, Text, View } from "react-native";
import { UI } from "../constants/ui";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({
  title = "Something went wrong",
  message = "Please check your connection and try again.",
  onRetry,
  retryLabel = "Retry",
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>!</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {onRetry ? (
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>{retryLabel}</Text>
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
    margin: 20,
    marginTop: 48,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: UI.colors.border,
    backgroundColor: UI.colors.surface,
    ...UI.shadow,
  },
  icon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: UI.colors.dangerSoft,
  },
  iconText: {
    color: UI.colors.danger,
    fontSize: 22,
    fontWeight: "800",
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
    marginBottom: 16,
  },
  button: {
    backgroundColor: UI.colors.ink,
    borderRadius: UI.radius.small,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
