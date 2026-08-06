import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import {
  createProductCategory,
  getProductCategories,
  ProductCategory,
} from "../api/productCategories";
import { FloatingBackToTop } from "../components/FloatingBackToTop";
import { UI } from "../constants/ui";
import { sharedStyles } from "../constants/sharedStyles";
import { StatusBadge } from "../components/ui/StatusBadge";
import { LoadingState } from "../components/LoadingState";
import { showSuccessMessage } from "../utils/showSuccessMessage";

export default function ProductCategoriesScreen() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadCategories = async () => {
    try {
      const result = await getProductCategories();
      setCategories(result);
    } catch {
      Alert.alert("Unable to load categories", "Please check your connection and try again.");
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

      showSuccessMessage("Category created successfully.");

      setName("");
      setDescription("");
      await loadCategories();
    } catch {
      Alert.alert("Save failed", "Unable to create this category. Please review the details and try again.");
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
    return <LoadingState title="Loading categories" message="Getting your product categories." />;
  }

  return (
    <View style={styles.screenShell}>
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.container}
      onScroll={(event) =>
        setShowBackToTop(event.nativeEvent.contentOffset.y > 240)
      }
      scrollEventThrottle={16}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text accessibilityRole="header" style={styles.title}>Manage categories</Text>
      <Text style={styles.subtitle}>
        Add categories to organize your products.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Add New Category</Text>

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

        <Pressable
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={handleCreateCategory}
          disabled={saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving, busy: saving }}
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

            <StatusBadge
              label={category.isActive ? "Active" : "Inactive"}
              tone={category.isActive ? "success" : "neutral"}
            />

            <Pressable
							style={styles.editButton}
							onPress={() =>
									router.push({
									pathname: "/edit-product-category" as any,
									params: { categoryId: category.id },
									})
							}
							accessibilityRole="button"
							accessibilityLabel={`Edit ${category.name}`}
							>
							<Text style={styles.editButtonText}>Edit Category</Text>
							</Pressable>
          </View>
        ))
      )}
    </ScrollView>
    <FloatingBackToTop
      visible={showBackToTop}
      onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1, backgroundColor: UI.colors.canvas },
  container: {
    ...sharedStyles.formContent,
    backgroundColor: UI.colors.canvas,
    flexGrow: 1,
  },
  title: {
    ...sharedStyles.pageTitle,
  },
  subtitle: {
    ...sharedStyles.pageSubtitle,
  },
  formCard: {
    ...sharedStyles.card,
    marginBottom: 20,
  },
  formTitle: {
    ...sharedStyles.sectionTitle,
    marginBottom: 14,
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
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveButton: {
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
    backgroundColor: UI.colors.primary,
    borderRadius: UI.radius.small,
    padding: 12,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: UI.colors.onDark,
    fontWeight: "900",
    fontSize: 15,
  },
  sectionTitle: {
    ...sharedStyles.sectionTitle,
  },
  emptyText: {
    backgroundColor: UI.colors.surface,
    borderRadius: 10,
    padding: 14,
    color: UI.colors.inkMuted,
    textAlign: "center",
  },
  card: {
    ...sharedStyles.card,
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 13,
    color: UI.colors.inkMuted,
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
	editButton: {
		minHeight: UI.control.minTouchTarget,
		justifyContent: "center",
		backgroundColor: UI.colors.ink,
		borderRadius: 10,
		padding: 12,
		alignItems: "center",
		marginTop: 12,
	},
	editButtonText: {
		color: UI.colors.onDark,
		fontWeight: "800",
	},
});
