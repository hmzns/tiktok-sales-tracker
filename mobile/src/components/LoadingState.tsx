import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

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
      <ActivityIndicator size="large" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    marginTop: 32,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111",
    marginTop: 12,
    marginBottom: 6,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
});