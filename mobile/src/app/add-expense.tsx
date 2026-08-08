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
import { FieldError } from "../components/FieldError";
import { AppButton } from "../components/ui/AppButton";
import { showSuccessMessage } from "../utils/showSuccessMessage";
import {
  createExpense,
  ExpenseCategory,
} from "../api/expenses";
import { UI } from "../constants/ui";
import { sharedStyles } from "../constants/sharedStyles";
import { getPositiveAmountError } from "../utils/formValidation";

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

  const [fieldErrors, setFieldErrors] = useState({
    title: "",
    amount: "",
    category: "",
  });

  const validateExpenseForm = () => {
    const errors = {
      title: "",
      amount: "",
      category: "",
    };

    if (!title.trim()) {
      errors.title = "Expense title is required.";
    }

    errors.amount = getPositiveAmountError(amount);

    if (!category) {
      errors.category = "Category is required.";
    }

    setFieldErrors(errors);

    return !Object.values(errors).some(Boolean);
  };

  const handleSubmit = async () => {
    const parsedAmount = Number(amount);

    if (!validateExpenseForm()) {
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

      showSuccessMessage("Expense added successfully.");

      router.replace("/expenses" as any);
    } catch {
      Alert.alert("Save failed", "Unable to create this expense. Please review the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Text accessibilityRole="header" style={styles.title}>Expense details</Text>
      <Text style={styles.subtitle}>
        Record business expenses such as packaging, ads, and shipping.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Packaging Plastic"
          placeholderTextColor={UI.colors.inkSubtle}
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            setFieldErrors((current) => ({ ...current, title: "" }));
          }}
        />
        <FieldError message={fieldErrors.title} />

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: 25"
          placeholderTextColor={UI.colors.inkSubtle}
          value={amount}
          onChangeText={(value) => {
            setAmount(value);
            setFieldErrors((current) => ({
              ...current,
              amount: getPositiveAmountError(value),
            }));
          }}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        <FieldError message={fieldErrors.amount} />

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
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
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
          placeholderTextColor={UI.colors.inkSubtle}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <View style={styles.actionStack}>
        <AppButton
          label="Create Expense"
          loadingLabel="Saving..."
          onPress={handleSubmit}
          disabled={saving}
          loading={saving}
        />
        <AppButton label="Cancel" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...sharedStyles.screen,
  },
  content: {
    ...sharedStyles.formContent,
  },
  title: {
    ...sharedStyles.pageTitle,
  },
  subtitle: {
    ...sharedStyles.pageSubtitle,
  },
  formCard: {
    ...sharedStyles.card,
  },
  label: {
    ...sharedStyles.label,
  },
  input: {
    ...sharedStyles.input,
    ...sharedStyles.inputWeb,
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
    ...sharedStyles.chip,
  },
  categoryChipSelected: {
    ...sharedStyles.chipSelected,
  },
  categoryChipText: {
    ...sharedStyles.chipText,
  },
  categoryChipTextSelected: {
    ...sharedStyles.chipTextSelected,
  },
  actionStack: { gap: UI.spacing.sm, marginTop: UI.spacing.xl },
});
