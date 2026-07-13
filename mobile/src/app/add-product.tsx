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
import {
  getProductCategories,
  ProductCategory,
} from "../api/productCategories";

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
    } catch (err) {
      Alert.alert("Error", "Failed to load categories");
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSubmit = async () => {
    const parsedCostPrice = Number(costPrice);
    const parsedSellPrice = Number(sellPrice);
    const parsedStock = Number(stock);

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

      router.replace("/products" as any);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to create product";

      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add Product</Text>
      <Text style={styles.subtitle}>Create a new product for tracking.</Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>Product Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Tudung Bawal Premium"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>SKU</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: TDG001"
          value={sku}
          onChangeText={setSku}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Cost Price</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: 12"
          value={costPrice}
          onChangeText={setCostPrice}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Sell Price</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: 25"
          value={sellPrice}
          onChangeText={setSellPrice}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Stock</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: 20"
          value={stock}
          onChangeText={setStock}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Category</Text>

        {loadingCategories ? (
          <View style={styles.loadingCategory}>
            <ActivityIndicator />
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

        <Pressable
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          <Text style={styles.submitButtonText}>
            {saving ? "Saving..." : "Create Product"}
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
  loadingCategory: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  smallText: {
    fontSize: 13,
    color: "#666",
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