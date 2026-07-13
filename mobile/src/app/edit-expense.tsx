import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import {
  ExpenseCategory,
  getExpenseById,
  updateExpense,
} from "../api/expenses";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "PACKAGING",
  "ADS",
  "SHIPPING",
  "SUPPLIES",
  "EQUIPMENT",
  "SALARY",
  "OTHER",
];

export default function EditExpenseScreen() {
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("OTHER");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadExpense = async () => {
    if (!expenseId) return;

    try {
      setLoading(true);

      const expense = await getExpenseById(expenseId);

      setTitle(expense.title);
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setDescription(expense.description ?? "");
      setExpenseDate(new Date(expense.expenseDate).toISOString().slice(0, 10));
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to load expense";

      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExpense = async () => {
    if (!expenseId) return;

    if (!title.trim()) {
      Alert.alert("Error", "Expense title is required.");
      return;
    }

    const parsedAmount = Number(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      Alert.alert("Error", "Amount must be a valid number.");
      return;
    }

    if (!expenseDate.trim()) {
      Alert.alert("Error", "Expense date is required.");
      return;
    }

    const parsedDate = new Date(expenseDate);

    if (Number.isNaN(parsedDate.getTime())) {
      Alert.alert("Error", "Expense date must use YYYY-MM-DD format.");
      return;
    }

    try {
      setSaving(true);

      await updateExpense(expenseId, {
        title: title.trim(),
        amount: parsedAmount,
        category,
        description: description.trim(),
        expenseDate: parsedDate.toISOString(),
      });

      router.replace("/expenses" as any);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to update expense";

      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadExpense();
  }, [expenseId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading expense...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Expense</Text>
      <Text style={styles.subtitle}>Update expense details below.</Text>

      <Text style={styles.label}>Expense Title</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: Packaging box"
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
        {EXPENSE_CATEGORIES.map((item) => (
          <Pressable
            key={item}
            style={[
              styles.categoryChip,
              category === item && styles.activeCategoryChip,
            ]}
            onPress={() => setCategory(item)}
          >
            <Text
              style={[
                styles.categoryChipText,
                category === item && styles.activeCategoryChipText,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Optional description"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Expense Date</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={expenseDate}
        onChangeText={setExpenseDate}
      />

      <Pressable
        style={[styles.saveButton, saving && styles.disabledButton]}
        onPress={handleUpdateExpense}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Saving..." : "Save Changes"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f6f6f6",
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
    color: "#333",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 14,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  categoryList: {
    marginBottom: 14,
  },
  categoryChip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  activeCategoryChip: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  categoryChipText: {
    color: "#333",
    fontSize: 13,
    fontWeight: "700",
  },
  activeCategoryChipText: {
    color: "#fff",
  },
  saveButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },
});