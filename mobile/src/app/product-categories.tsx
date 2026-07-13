import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import {
  createProductCategory,
  getProductCategories,
  ProductCategory,
} from "../api/productCategories";

export default function ProductCategoriesScreen() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCategories = async () => {
    try {
      const result = await getProductCategories();
      setCategories(result);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to load categories";

      Alert.alert("Error", message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Category name is required.");
      return;
    }

    try {
      setSaving(true);

      await createProductCategory({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      setName("");
      setDescription("");
      await loadCategories();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to create category";

      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCategories();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Product Categories</Text>
      <Text style={styles.subtitle}>
        Add categories to organize your products.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Add New Category</Text>

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

        <Pressable
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={handleCreateCategory}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Add Category"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Existing Categories</Text>

      {categories.length === 0 ? (
        <Text style={styles.emptyText}>No categories yet.</Text>
      ) : (
        categories.map((category) => (
          <View key={category.id} style={styles.card}>
            <Text style={styles.categoryName}>{category.name}</Text>

            <Text style={styles.descriptionText}>
              {category.description || "No description"}
            </Text>

            <Text
              style={[
                styles.statusText,
                category.isActive ? styles.activeText : styles.inactiveText,
              ]}
            >
              {category.isActive ? "Active" : "Inactive"}
            </Text>
          </View>
        ))
      )}
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
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 14,
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
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  emptyText: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    color: "#666",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  activeText: {
    color: "#1f8f46",
  },
  inactiveText: {
    color: "#cc3333",
  },
});