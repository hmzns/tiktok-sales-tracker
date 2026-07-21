import { StyleSheet, Text, View } from "react-native";

type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📭</Text>
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
  icon: {
    fontSize: 36,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
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