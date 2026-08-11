import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function IphoneGuideScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add App to iPhone Home Screen</Text>

      <Text style={styles.description}>
        Follow these steps to open TikTok Sales Tracker like a normal app from
        your iPhone Home Screen.
      </Text>

      <View style={styles.card}>
        <Text style={styles.step}>1. Open the app link in Safari.</Text>
        <Text style={styles.step}>2. Tap the Share button.</Text>
        <Text style={styles.step}>3. Tap Add to Home Screen.</Text>
        <Text style={styles.step}>4. Change the name if needed.</Text>
        <Text style={styles.step}>5. Tap Add.</Text>
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteTitle}>Important</Text>
        <Text style={styles.noteText}>
          Use Safari for this step. The option may not appear properly if using
          another browser.
        </Text>
      </View>

      <Pressable style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111",
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: "#555",
    lineHeight: 22,
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  step: {
    fontSize: 16,
    color: "#111",
    marginBottom: 12,
    lineHeight: 22,
    fontWeight: "700",
  },
  noteBox: {
    backgroundColor: "#fff7ed",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#9a3412",
    marginBottom: 6,
  },
  noteText: {
    fontSize: 14,
    color: "#9a3412",
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
});