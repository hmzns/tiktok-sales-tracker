import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { checkApiHealth } from "../api/health";

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("Checking backend...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const testBackendConnection = async () => {
      try {
        const result = await checkApiHealth();
        setStatus(`Backend connected: ${result.service}`);
      } catch (err) {
        setError("Backend connection failed");
      } finally {
        setLoading(false);
      }
    };

    testBackendConnection();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TikTok Sales Tracker</Text>

      {loading ? (
        <>
          <ActivityIndicator size="large" />
          <Text style={styles.text}>Checking backend connection...</Text>
        </>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={styles.success}>{status}</Text>
      )}

      <Text style={styles.apiUrl}>
        API URL: {process.env.EXPO_PUBLIC_API_URL}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 24,
  },
  text: {
    marginTop: 12,
    fontSize: 16,
  },
  success: {
    fontSize: 16,
    fontWeight: "600",
    color: "green",
  },
  error: {
    fontSize: 16,
    fontWeight: "600",
    color: "red",
  },
  apiUrl: {
    marginTop: 24,
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
});