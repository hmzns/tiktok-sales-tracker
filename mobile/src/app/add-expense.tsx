import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createExpense,
  ExpenseCategory,
} from "../api/expenses";

const categories: ExpenseCategory[] = [
  "PACKAGING",
  "ADS",
  "SHIPPING",
  "SUPPLIES",
  "EQUIPMENT",
  "SALARY",
  "OTHER",
];

export default function AddExpenseScreen() {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("OTHER");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const parsedAmount = Number(amount);

    if (!title.trim()) {
      Alert.alert("Validation Error", "Expense title is required");
      return;
    }

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Validation Error", "Amount must be more than 0");
      return;
    }

    try {
      setSaving(true);

      await createExpense({
        title: title.trim(),
        amount: parsedAmount,
        category,
        description: description.trim() || undefined,
      });

      router.replace("/expenses" as any);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to create expense";

      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add Expense</Text>
      <Text style={styles.subtitle}>
        Record business expenses such as packaging, ads, and shipping.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Packaging Plastic"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: 25"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Category</Text>

        <View style={styles.categoryList}>
          {categories.map((item) => {
            const isSelected = category === item;

            return (
              <Pressable
                key={item}
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipSelected,
                ]}
                onPress={() => setCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected && styles.categoryChipTextSelected,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Example: Plastic bags for orders"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Pressable
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          <Text style={styles.submitButtonText}>
            {saving ? "Saving..." : "Create Expense"}
          </Text>
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7f7f7",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  categoryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  categoryChipSelected: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
  },
  categoryChipTextSelected: {
    color: "#fff",
  },
  submitButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  cancelButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
});