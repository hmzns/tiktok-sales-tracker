import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { UI } from "../constants/ui";

type LoadingStateProps = {
  title?: string;
  message?: string;
};

export function LoadingState({
  title = "Loading...",
  message = "Please wait while we get your data.",
}: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.indicatorWrap}>
          <ActivityIndicator size="small" color={UI.colors.primary} />
        </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    flex: 1,
    backgroundColor: UI.colors.canvas,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: UI.colors.border,
    padding: 32,
    ...UI.shadow,
  },
  indicatorWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: UI.colors.primarySoft,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: UI.colors.ink,
    marginTop: 16,
    marginBottom: 6,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: UI.colors.inkMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
