import { router } from "expo-router";
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
import { createProduct } from "../api/products";
import { FieldError } from "../components/FieldError";
import { AppButton } from "../components/ui/AppButton";
import { showSuccessMessage } from "../utils/showSuccessMessage";
import {
  getProductCategories,
  ProductCategory,
} from "../api/productCategories";
import { UI } from "../constants/ui";
import { sharedStyles } from "../constants/sharedStyles";

export default function AddProductScreen() {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCategories = async () => {
    try {
      const categoryList = await getProductCategories();
      setCategories(categoryList.filter((category) => category.isActive));
    } catch {
      Alert.alert("Error", "Failed to load categories");
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const [fieldErrors, setFieldErrors] = useState({
    name: "",
    sku: "",
    costPrice: "",
    sellPrice: "",
    stock: "",
  });

  const validateProductForm = () => {
    const errors = {
      name: "",
      sku: "",
      costPrice: "",
      sellPrice: "",
      stock: "",
    };

    if (!name.trim()) {
      errors.name = "Product name is required.";
    }

    if (!sku.trim()) {
      errors.sku = "SKU is required.";
    }

    if (!costPrice || Number(costPrice) < 0) {
      errors.costPrice = "Cost price must be 0 or more.";
    }

    if (!sellPrice || Number(sellPrice) < 0) {
      errors.sellPrice = "Sell price must be 0 or more.";
    }

    if (stock && Number(stock) < 0) {
      errors.stock = "Stock cannot be negative.";
    }

    setFieldErrors(errors);

    return !Object.values(errors).some(Boolean);
  };

  const handleSubmit = async () => {
    const parsedCostPrice = Number(costPrice);
    const parsedSellPrice = Number(sellPrice);
    const parsedStock = Number(stock);

    if (!validateProductForm()) {
      return;
    }

    if (!name.trim()) {
      Alert.alert("Validation Error", "Product name is required");
      return;
    }

    if (!sku.trim()) {
      Alert.alert("Validation Error", "SKU is required");
      return;
    }

    if (Number.isNaN(parsedCostPrice) || parsedCostPrice < 0) {
      Alert.alert("Validation Error", "Cost price must be 0 or more");
      return;
    }

    if (Number.isNaN(parsedSellPrice) || parsedSellPrice < 0) {
      Alert.alert("Validation Error", "Sell price must be 0 or more");
      return;
    }

    if (
      Number.isNaN(parsedStock) ||
      parsedStock < 0 ||
      !Number.isInteger(parsedStock)
    ) {
      Alert.alert("Validation Error", "Stock must be a whole number");
      return;
    }

    try {
      setSaving(true);

      await createProduct({
        name: name.trim(),
        sku: sku.trim(),
        costPrice: parsedCostPrice,
        sellPrice: parsedSellPrice,
        stock: parsedStock,
        categoryId,
      });

      showSuccessMessage("Product created successfully.");

      router.replace("/products" as any);
    } catch {
      Alert.alert("Save failed", "Unable to create this product. Please review the details and try again.");
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
      <Text accessibilityRole="header" style={styles.title}>Product details</Text>
      <Text style={styles.subtitle}>Create a new product for tracking.</Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>Product Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Tudung Bawal Premium"
          placeholderTextColor={UI.colors.inkSubtle}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setFieldErrors((current) => ({ ...current, name: "" }));
          }}
        />
        <FieldError message={fieldErrors.name} />

        <Text style={styles.label}>SKU</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: TDG001"
          placeholderTextColor={UI.colors.inkSubtle}
          value={sku}
          onChangeText={(value) => {
            setSku(value);
            setFieldErrors((current) => ({ ...current, sku: "" }));
          }}
          autoCapitalize="characters"
        />
        <FieldError message={fieldErrors.sku} />

        <Text style={styles.label}>Cost Price</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: 12"
          placeholderTextColor={UI.colors.inkSubtle}
          value={costPrice}
          onChangeText={(value) => {
            setCostPrice(value);
            setFieldErrors((current) => ({ ...current, costPrice: "" }));
          }}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        <FieldError message={fieldErrors.costPrice} />

        <Text style={styles.label}>Sell Price</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: 25"
          placeholderTextColor={UI.colors.inkSubtle}
          value={sellPrice}
          onChangeText={(value) => {
            setSellPrice(value);
            setFieldErrors((current) => ({ ...current, sellPrice: "" }));
          }}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        <FieldError message={fieldErrors.sellPrice} />

        <Text style={styles.label}>Stock</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: 20"
          placeholderTextColor={UI.colors.inkSubtle}
          value={stock}
          onChangeText={(value) => {
            setStock(value);
            setFieldErrors((current) => ({ ...current, stock: "" }));
          }}
          keyboardType="numeric"
          inputMode="numeric"
        />
        <FieldError message={fieldErrors.stock} />

        <Text style={styles.label}>Category</Text>

        {loadingCategories ? (
          <View style={styles.loadingCategory}>
            <ActivityIndicator color={UI.colors.primary} />
            <Text style={styles.smallText}>Loading categories...</Text>
          </View>
        ) : (
          <View style={styles.categoryList}>
            <Pressable
              style={[
                styles.categoryChip,
                categoryId === null && styles.categoryChipSelected,
              ]}
              onPress={() => setCategoryId(null)}
              accessibilityRole="button"
              accessibilityState={{ selected: categoryId === null }}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  categoryId === null && styles.categoryChipTextSelected,
                ]}
              >
                No Category
              </Text>
            </Pressable>

            {categories.map((category) => (
              <Pressable
                key={category.id}
                style={[
                  styles.categoryChip,
                  categoryId === category.id && styles.categoryChipSelected,
                ]}
                onPress={() => setCategoryId(category.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: categoryId === category.id }}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    categoryId === category.id &&
                      styles.categoryChipTextSelected,
                  ]}
                >
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.actionStack}>
        <AppButton
          label="Create Product"
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
  loadingCategory: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  smallText: {
    fontSize: 13,
    color: UI.colors.inkMuted,
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
