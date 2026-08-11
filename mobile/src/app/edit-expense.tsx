import { useCallback, useEffect, useState } from "react";
import {
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
import { FieldError } from "../components/FieldError";
import { LoadingState } from "../components/LoadingState";
import { AppButton } from "../components/ui/AppButton";
import {
  DatePickerModal,
  formatBusinessDateLabel,
  parseBusinessDate,
  toBusinessDateIso,
} from "../components/ui/DatePickerModal";
import { UI } from "../constants/ui";
import { sharedStyles } from "../constants/sharedStyles";
import { getPositiveAmountError } from "../utils/formValidation";
import { showSuccessMessage } from "../utils/showSuccessMessage";

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
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [amountError, setAmountError] = useState("");

  const loadExpense = useCallback(async () => {
    if (!expenseId) return;

    try {
      setLoading(true);

      const expense = await getExpenseById(expenseId);

      setTitle(expense.title);
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setDescription(expense.description ?? "");
      setExpenseDate(
        parseBusinessDate(expense.expenseDate)
          ? expense.expenseDate.slice(0, 10)
          : ""
      );
    } catch {
      Alert.alert("Unable to load expense", "Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [expenseId]);

  const handleUpdateExpense = async () => {
    if (!expenseId) return;

    const nextAmountError = getPositiveAmountError(amount);
    setAmountError(nextAmountError);

    if (!title.trim()) {
      Alert.alert("Error", "Expense title is required.");
      return;
    }

    const parsedAmount = Number(amount);

    if (nextAmountError) {
      return;
    }

    if (!expenseDate.trim()) {
      Alert.alert("Error", "Expense date is required.");
      return;
    }

    const expenseDateIso = toBusinessDateIso(expenseDate);

    if (!expenseDateIso) {
      Alert.alert("Error", "Please select a valid expense date.");
      return;
    }

    try {
      setSaving(true);

      await updateExpense(expenseId, {
        title: title.trim(),
        amount: parsedAmount,
        category,
        description: description.trim(),
        expenseDate: expenseDateIso,
      });

      showSuccessMessage("Expense updated successfully.");

      router.replace("/expenses" as any);
    } catch {
      Alert.alert("Save failed", "Unable to update this expense. Please review the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void loadExpense();
  }, [loadExpense]);

  if (loading) {
    return <LoadingState title="Loading expense" message="Getting the latest expense details." />;
  }

  return (
    <>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Text accessibilityRole="header" style={styles.title}>Expense details</Text>
      <Text style={styles.subtitle}>Update expense details below.</Text>

      <View style={styles.formCard}>

      <Text style={styles.label}>Expense Title</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: Packaging box"
        placeholderTextColor={UI.colors.inkSubtle}
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 25"
        placeholderTextColor={UI.colors.inkSubtle}
        value={amount}
        onChangeText={(value) => {
          setAmount(value);
          setAmountError(getPositiveAmountError(value));
        }}
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <FieldError message={amountError} />

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
            accessibilityRole="button"
            accessibilityState={{ selected: category === item }}
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
        placeholderTextColor={UI.colors.inkSubtle}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Expense Date</Text>
      <Pressable
        style={styles.dateButton}
        onPress={() => setDatePickerVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Expense date, ${formatBusinessDateLabel(expenseDate)}`}
        accessibilityHint="Opens a calendar"
      >
        <Text style={[styles.dateButtonText, !expenseDate && styles.datePlaceholder]}>
          {formatBusinessDateLabel(expenseDate)}
        </Text>
        <Text style={styles.calendarIcon} accessibilityElementsHidden>▦</Text>
      </Pressable>

      <View style={styles.actionStack}>
      <AppButton
        label="Save Changes"
        loadingLabel="Saving..."
        onPress={handleUpdateExpense}
        disabled={saving}
        loading={saving}
      />
      <AppButton label="Cancel" variant="secondary" onPress={() => router.back()} />
      </View>
      </View>
    </ScrollView>
    <DatePickerModal
      visible={datePickerVisible}
      value={expenseDate}
      onCancel={() => setDatePickerVisible(false)}
      onConfirm={(value) => {
        setExpenseDate(value);
        setDatePickerVisible(false);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { ...sharedStyles.screen },
  container: {
    ...sharedStyles.formContent,
    flexGrow: 1,
  },
  formCard: { ...sharedStyles.card },
  title: {
    ...sharedStyles.pageTitle,
  },
  subtitle: {
    ...sharedStyles.pageSubtitle,
  },
  label: {
    ...sharedStyles.label,
  },
  input: {
    ...sharedStyles.input,
    ...sharedStyles.inputWeb,
    marginBottom: 14,
  },
  dateButton: {
    ...sharedStyles.input,
    minHeight: UI.control.inputHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  dateButtonText: { flex: 1, color: UI.colors.ink, fontSize: 14 },
  datePlaceholder: { color: UI.colors.inkSubtle },
  calendarIcon: { color: UI.colors.inkMuted, fontSize: 20, marginLeft: 12 },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  categoryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: UI.spacing.xs,
    marginBottom: 14,
  },
  categoryChip: {
    ...sharedStyles.chip,
  },
  activeCategoryChip: {
    ...sharedStyles.chipSelected,
  },
  categoryChipText: {
    ...sharedStyles.chipText,
  },
  activeCategoryChipText: {
    ...sharedStyles.chipTextSelected,
  },
  actionStack: { gap: UI.spacing.sm, marginTop: UI.spacing.xl },
});
