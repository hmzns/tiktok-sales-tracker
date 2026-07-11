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
import { getProducts, Product } from "../api/products";
import {
  adjustStock,
  AdjustStockInput,
} from "../api/stockMovements";

type ManualStockType = AdjustStockInput["type"];

const movementTypes: {
  label: string;
  value: ManualStockType;
  description: string;
}[] = [
  {
    label: "Restock",
    value: "RESTOCK",
    description: "Add stock from supplier",
  },
  {
    label: "Manual In",
    value: "MANUAL_IN",
    description: "Add stock manually",
  },
  {
    label: "Manual Out",
    value: "MANUAL_OUT",
    description: "Reduce stock manually",
  },
  {
    label: "Damage",
    value: "DAMAGE",
    description: "Reduce stock due to damage",
  },
];

export default function AdjustStockScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );
  const [type, setType] = useState<ManualStockType>("RESTOCK");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find(
    (product) => product.id === selectedProductId
  );

  const loadProducts = async () => {
    try {
      const result = await getProducts(1, 50);
      setProducts(result.products.filter((product) => product.isActive));
    } catch (err) {
      Alert.alert("Error", "Failed to load products");
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSubmit = async () => {
    const parsedQuantity = Number(quantity);

    if (!selectedProduct) {
      Alert.alert("Validation Error", "Please select a product");
      return;
    }

    if (
      Number.isNaN(parsedQuantity) ||
      parsedQuantity <= 0 ||
      !Number.isInteger(parsedQuantity)
    ) {
      Alert.alert("Validation Error", "Quantity must be a whole number");
      return;
    }

    const isStockOut = type === "MANUAL_OUT" || type === "DAMAGE";

    if (isStockOut && selectedProduct.stock < parsedQuantity) {
      Alert.alert("Validation Error", "Not enough stock for this adjustment");
      return;
    }

    try {
      setSaving(true);

      await adjustStock({
        productId: selectedProduct.id,
        type,
        quantity: parsedQuantity,
        note: note.trim() || undefined,
        reference: reference.trim() || undefined,
      });

      router.replace("/stock-movements" as any);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to adjust stock";

      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Adjust Stock</Text>
      <Text style={styles.subtitle}>
        Restock products or record damaged stock.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>Select Product</Text>

        {loadingProducts ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.smallText}>Loading products...</Text>
          </View>
        ) : products.length === 0 ? (
          <Text style={styles.emptyText}>No active products found.</Text>
        ) : (
          <View style={styles.productList}>
            {products.map((product) => {
              const isSelected = selectedProductId === product.id;

              return (
                <Pressable
                  key={product.id}
                  style={[
                    styles.productCard,
                    isSelected && styles.productCardSelected,
                  ]}
                  onPress={() => setSelectedProductId(product.id)}
                >
                  <View style={styles.flexItem}>
                    <Text
                      style={[
                        styles.productName,
                        isSelected && styles.selectedText,
                      ]}
                    >
                      {product.name}
                    </Text>
                    <Text
                      style={[
                        styles.productInfo,
                        isSelected && styles.selectedSubText,
                      ]}
                    >
                      SKU: {product.sku} | Current stock: {product.stock}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Movement Type</Text>

        <View style={styles.typeList}>
          {movementTypes.map((movement) => {
            const isSelected = type === movement.value;

            return (
              <Pressable
                key={movement.value}
                style={[
                  styles.typeCard,
                  isSelected && styles.typeCardSelected,
                ]}
                onPress={() => setType(movement.value)}
              >
                <Text
                  style={[
                    styles.typeTitle,
                    isSelected && styles.selectedText,
                  ]}
                >
                  {movement.label}
                </Text>
                <Text
                  style={[
                    styles.typeDescription,
                    isSelected && styles.selectedSubText,
                  ]}
                >
                  {movement.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: 10"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Reference</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Supplier invoice no."
          value={reference}
          onChangeText={setReference}
        />

        <Text style={styles.label}>Note</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Example: New stock from supplier"
          value={note}
          onChangeText={setNote}
          multiline
        />

        {selectedProduct ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Selected Product</Text>
            <Text style={styles.summaryText}>{selectedProduct.name}</Text>
            <Text style={styles.summaryText}>
              Current stock: {selectedProduct.stock}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          <Text style={styles.submitButtonText}>
            {saving ? "Saving..." : "Save Stock Adjustment"}
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
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  smallText: {
    fontSize: 13,
    color: "#666",
  },
  emptyText: {
    fontSize: 14,
    color: "#777",
  },
  productList: {
    gap: 10,
  },
  productCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#fff",
  },
  productCardSelected: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  flexItem: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: "800",
  },
  productInfo: {
    marginTop: 4,
    fontSize: 12,
    color: "#666",
  },
  selectedText: {
    color: "#fff",
  },
  selectedSubText: {
    color: "#ddd",
  },
  typeList: {
    gap: 10,
  },
  typeCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#fff",
  },
  typeCardSelected: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  typeTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  typeDescription: {
    marginTop: 4,
    fontSize: 12,
    color: "#666",
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
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  summaryBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f7f7f7",
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
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