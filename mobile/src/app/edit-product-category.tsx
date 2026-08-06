import { useEffect, useState } from "react";
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
import { LoadingState } from "../components/LoadingState";
import { UI } from "../constants/ui";
import { sharedStyles } from "../constants/sharedStyles";
import { showSuccessMessage } from "../utils/showSuccessMessage";

import {
  getProductCategoryById,
  updateProductCategory,
} from "../api/productCategories";

export default function EditProductCategoryScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCategory = async () => {
    if (!categoryId) return;

    try {
      setLoading(true);

      const category = await getProductCategoryById(categoryId);

      setName(category.name);
      setDescription(category.description ?? "");
      setIsActive(category.isActive);
    } catch {
      Alert.alert("Unable to load category", "Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!categoryId) return;

    if (!name.trim()) {
      Alert.alert("Error", "Category name is required.");
      return;
    }

    try {
      setSaving(true);

      await updateProductCategory(categoryId, {
        name: name.trim(),
        description: description.trim(),
        isActive,
      });

      showSuccessMessage("Category updated successfully.");

      router.replace("/product-categories" as any);
    } catch {
      Alert.alert("Save failed", "Unable to update this category. Please review the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadCategory();
  }, [categoryId]);

  if (loading) {
    return <LoadingState title="Loading category" message="Getting the latest category details." />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.title}>Category details</Text>
      <Text style={styles.subtitle}>Update category details below.</Text>
      <View style={styles.formCard}>

      <Text style={styles.label}>Category Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: Lipstick"
        placeholderTextColor={UI.colors.inkSubtle}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Optional description"
        placeholderTextColor={UI.colors.inkSubtle}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Category Status</Text>

      <View style={styles.statusRow}>
        <Pressable
          style={[
            styles.statusButton,
            isActive && styles.activeStatusButton,
          ]}
          onPress={() => setIsActive(true)}
          accessibilityRole="button"
          accessibilityState={{ selected: isActive }}
        >
          <Text
            style={[
              styles.statusButtonText,
              isActive && styles.activeStatusButtonText,
            ]}
          >
            Active
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.statusButton,
            !isActive && styles.inactiveStatusButton,
          ]}
          onPress={() => setIsActive(false)}
          accessibilityRole="button"
          accessibilityState={{ selected: !isActive }}
        >
          <Text
            style={[
              styles.statusButtonText,
              !isActive && styles.inactiveStatusButtonText,
            ]}
          >
            Inactive
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.saveButton, saving && styles.disabledButton]}
        onPress={handleUpdateCategory}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving, busy: saving }}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Saving..." : "Save Changes"}
        </Text>
      </Pressable>
      </View>
    </ScrollView>
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
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  statusRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statusButton: {
    flex: 1,
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderStrong,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  activeStatusButton: {
    backgroundColor: UI.colors.successSoft,
    borderColor: UI.colors.success,
  },
  inactiveStatusButton: {
    backgroundColor: UI.colors.dangerSoft,
    borderColor: UI.colors.danger,
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: UI.colors.ink,
  },
  activeStatusButtonText: {
    color: UI.colors.success,
  },
  inactiveStatusButtonText: {
    color: UI.colors.danger,
  },
  saveButton: {
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
    backgroundColor: UI.colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: UI.colors.onDark,
    fontWeight: "900",
    fontSize: 15,
  },
});
