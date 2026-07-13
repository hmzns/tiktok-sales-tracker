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
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to load category";

      Alert.alert("Error", message);
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

      router.replace("/product-categories" as any);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to update category";

      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadCategory();
  }, [categoryId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading category...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Category</Text>
      <Text style={styles.subtitle}>Update category details below.</Text>

      <Text style={styles.label}>Category Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: Lipstick"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Optional description"
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
  statusRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statusButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  activeStatusButton: {
    backgroundColor: "#e8f8ee",
    borderColor: "#1f8f46",
  },
  inactiveStatusButton: {
    backgroundColor: "#ffecec",
    borderColor: "#cc3333",
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#333",
  },
  activeStatusButtonText: {
    color: "#1f8f46",
  },
  inactiveStatusButtonText: {
    color: "#cc3333",
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