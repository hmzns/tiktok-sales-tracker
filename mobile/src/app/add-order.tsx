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
import { createOrder } from "../api/orders";
import { getProducts, Product } from "../api/products";

const formatRM = (value: number) => {
  return `RM ${value.toFixed(2)}`;
};

export default function AddOrderScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );

  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [discount, setDiscount] = useState("0");
  const [shippingFee, setShippingFee] = useState("0");

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

  const calculatedSubtotal = selectedProduct
    ? selectedProduct.sellPrice * Number(quantity || 0)
    : 0;

  const calculatedTotal =
    calculatedSubtotal - Number(discount || 0) + Number(shippingFee || 0);

  const handleSubmit = async () => {
    const parsedQuantity = Number(quantity);
    const parsedDiscount = Number(discount);
    const parsedShippingFee = Number(shippingFee);

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

    if (selectedProduct.stock < parsedQuantity) {
      Alert.alert("Validation Error", "Not enough stock for this product");
      return;
    }

    if (Number.isNaN(parsedDiscount) || parsedDiscount < 0) {
      Alert.alert("Validation Error", "Discount must be 0 or more");
      return;
    }

    if (Number.isNaN(parsedShippingFee) || parsedShippingFee < 0) {
      Alert.alert("Validation Error", "Shipping fee must be 0 or more");
      return;
    }

    try {
      setSaving(true);

      await createOrder({
        orderNumber: orderNumber.trim() || undefined,
        platform: "MANUAL",
        status: "PAID",
        customerName: customerName.trim() || undefined,
        discount: parsedDiscount,
        shippingFee: parsedShippingFee,
        items: [
          {
            productId: selectedProduct.id,
            quantity: parsedQuantity,
          },
        ],
      });

      router.replace("/orders" as any);
    } catch (err: any) {
      const message = err?.response?.data?.message ?? "Failed to create order";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Order</Text>
      <Text style={styles.subtitle}>Add a customer order manually.</Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>Order Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: ORD-MOB-001"
          value={orderNumber}
          onChangeText={setOrderNumber}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Customer Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Aina"
          value={customerName}
          onChangeText={setCustomerName}
        />

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
                      SKU: {product.sku} | Stock: {product.stock}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.productPrice,
                      isSelected && styles.selectedText,
                    ]}
                  >
                    {formatRM(product.sellPrice)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: 1"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Discount</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: 0"
          value={discount}
          onChangeText={setDiscount}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Shipping Fee</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: 0"
          value={shippingFee}
          onChangeText={setShippingFee}
          keyboardType="numeric"
        />

        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              {formatRM(calculatedSubtotal)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryTotal}>{formatRM(calculatedTotal)}</Text>
          </View>
        </View>

        <Pressable
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          <Text style={styles.submitButtonText}>
            {saving ? "Saving..." : "Create Order"}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
  productPrice: {
    fontSize: 14,
    fontWeight: "800",
  },
  selectedText: {
    color: "#fff",
  },
  selectedSubText: {
    color: "#ddd",
  },
  summaryBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f7f7f7",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: "900",
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