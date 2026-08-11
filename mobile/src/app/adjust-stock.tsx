import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { FloatingBackToTop } from "../components/FloatingBackToTop";
import { UI } from "../constants/ui";
import { sharedStyles } from "../constants/sharedStyles";
import { showSuccessMessage } from "../utils/showSuccessMessage";

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
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
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
    } catch {
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

      showSuccessMessage("Stock adjustment saved successfully.");

      router.replace("/stock-movements" as any);
    } catch {
      Alert.alert("Save failed", "Unable to save this stock adjustment. Please review the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screenShell}>
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      onScroll={(event) =>
        setShowBackToTop(event.nativeEvent.contentOffset.y > 240)
      }
      scrollEventThrottle={16}
    >
      <Text accessibilityRole="header" style={styles.title}>Stock adjustment</Text>
      <Text style={styles.subtitle}>
        Restock products or record damaged stock.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>Select Product</Text>

        {loadingProducts ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={UI.colors.primary} />
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
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
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
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
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
          placeholderTextColor={UI.colors.inkSubtle}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          inputMode="numeric"
        />

        <Text style={styles.label}>Reference</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Supplier invoice no."
          placeholderTextColor={UI.colors.inkSubtle}
          value={reference}
          onChangeText={setReference}
        />

        <Text style={styles.label}>Note</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Example: New stock from supplier"
          placeholderTextColor={UI.colors.inkSubtle}
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
          accessibilityRole="button"
          accessibilityState={{ disabled: saving, busy: saving }}
        >
          <Text style={styles.submitButtonText}>
            {saving ? "Saving..." : "Save Stock Adjustment"}
          </Text>
        </Pressable>

        <Pressable accessibilityRole="button" style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
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
  screen: {
    flex: 1,
    backgroundColor: UI.colors.canvas,
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
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  smallText: {
    fontSize: 13,
    color: UI.colors.inkMuted,
  },
  emptyText: {
    fontSize: 14,
    color: UI.colors.inkMuted,
  },
  productList: {
    gap: 10,
  },
  productCard: {
    borderWidth: 1,
    borderColor: UI.colors.borderStrong,
    borderRadius: 12,
    padding: 14,
    backgroundColor: UI.colors.surface,
  },
  productCardSelected: {
    backgroundColor: UI.colors.ink,
    borderColor: UI.colors.ink,
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
    color: UI.colors.inkMuted,
  },
  selectedText: {
    color: UI.colors.onDark,
  },
  selectedSubText: {
    color: UI.colors.onDarkMuted,
  },
  typeList: {
    gap: 10,
  },
  typeCard: {
    borderWidth: 1,
    borderColor: UI.colors.borderStrong,
    borderRadius: 12,
    padding: 14,
    backgroundColor: UI.colors.surface,
  },
  typeCardSelected: {
    backgroundColor: UI.colors.ink,
    borderColor: UI.colors.ink,
  },
  typeTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  typeDescription: {
    marginTop: 4,
    fontSize: 12,
    color: UI.colors.inkMuted,
  },
  input: {
    ...sharedStyles.input,
    ...sharedStyles.inputWeb,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  summaryBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: UI.colors.surfaceMuted,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    color: UI.colors.inkMuted,
    marginTop: 2,
  },
  submitButton: {
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
    backgroundColor: UI.colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: UI.colors.onDark,
    fontSize: 15,
    fontWeight: "800",
  },
  cancelButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: UI.colors.borderStrong,
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
