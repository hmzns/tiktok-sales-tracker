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
  getProductById,
  updateProduct,
} from "../api/products";
import {
  getProductCategories,
  ProductCategory,
} from "../api/productCategories";

export default function EditProductScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();

  const [categories, setCategories] = useState<ProductCategory[]>([]);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProduct = async () => {
    if (!productId) return;

    try {
      setLoading(true);

      const [product, categoryList] = await Promise.all([
        getProductById(productId),
        getProductCategories(),
      ]);

      setCategories(categoryList);

      setName(product.name);
      setSku(product.sku);
      setCostPrice(String(product.costPrice));
      setSellPrice(String(product.sellPrice));
      setStock(String(product.stock));
      setCategoryId(product.categoryId);
      setIsActive(product.isActive);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to load product";

      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!productId) return;

    if (!name.trim() || !sku.trim()) {
      Alert.alert("Error", "Product name and SKU are required.");
      return;
    }

    const parsedCostPrice = Number(costPrice);
    const parsedSellPrice = Number(sellPrice);
    const parsedStock = Number(stock);

    if (
      Number.isNaN(parsedCostPrice) ||
      Number.isNaN(parsedSellPrice) ||
      Number.isNaN(parsedStock)
    ) {
      Alert.alert("Error", "Cost price, sell price, and stock must be numbers.");
      return;
    }

    try {
      setSaving(true);

      await updateProduct(productId, {
        name: name.trim(),
        sku: sku.trim(),
        costPrice: parsedCostPrice,
        sellPrice: parsedSellPrice,
        stock: parsedStock,
        categoryId,
        isActive,
      });

      router.replace("/products" as any);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to update product";

      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [productId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading product...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Product</Text>
      <Text style={styles.subtitle}>Update product details below.</Text>

      <Text style={styles.label}>Product Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: Lipmatte Red"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>SKU</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: LM-RED-01"
        value={sku}
        onChangeText={setSku}
      />

      <Text style={styles.label}>Cost Price</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 10"
        value={costPrice}
        onChangeText={setCostPrice}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Sell Price</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 20"
        value={sellPrice}
        onChangeText={setSellPrice}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Stock</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 50"
        value={stock}
        onChangeText={setStock}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Category</Text>

      <Pressable
        style={[
          styles.categoryChip,
          categoryId === null && styles.activeCategoryChip,
        ]}
        onPress={() => setCategoryId(null)}
      >
        <Text
          style={[
            styles.categoryChipText,
            categoryId === null && styles.activeCategoryChipText,
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
            categoryId === category.id && styles.activeCategoryChip,
          ]}
          onPress={() => setCategoryId(category.id)}
        >
          <Text
            style={[
              styles.categoryChipText,
              categoryId === category.id && styles.activeCategoryChipText,
            ]}
          >
            {category.name}
          </Text>
        </Pressable>
      ))}

      <Text style={styles.label}>Product Status</Text>

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
        onPress={handleUpdateProduct}
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
});