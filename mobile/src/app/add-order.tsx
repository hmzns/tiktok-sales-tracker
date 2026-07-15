import { useEffect, useMemo, useState } from "react";
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
import { router } from "expo-router";

import { createOrder } from "../api/orders";
import { getProducts, Product } from "../api/products";

type SelectedOrderItem = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  sellPrice: number;
  stock: number;
};

export default function AddOrderScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [items, setItems] = useState<SelectedOrderItem[]>([]);

  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [discount, setDiscount] = useState("0");
  const [shippingFee, setShippingFee] = useState("0");

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);

      const result = await getProducts(1, 100, "", true);
      setProducts(result.products);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to load products";

      Alert.alert("Error", message);
    } finally {
      setLoadingProducts(false);
    }
  };

  const selectedProduct = products.find(
    (product) => product.id === selectedProductId
  );

  const subtotal = useMemo(() => {
    return items.reduce((total, item) => {
      return total + item.sellPrice * item.quantity;
    }, 0);
  }, [items]);

  const parsedDiscount = Number(discount) || 0;
  const parsedShippingFee = Number(shippingFee) || 0;
  const total = subtotal - parsedDiscount + parsedShippingFee;

  const handleAddItem = () => {
    if (!selectedProduct) {
      Alert.alert("Error", "Please select a product.");
      return;
    }

    const parsedQuantity = Number(quantity);

    if (
      Number.isNaN(parsedQuantity) ||
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      Alert.alert("Error", "Quantity must be a positive whole number.");
      return;
    }

    const existingItem = items.find(
      (item) => item.productId === selectedProduct.id
    );

    // A product can be added repeatedly, so validate the combined quantity
    // rather than only the latest entry.
    const existingQuantity = existingItem?.quantity ?? 0;
    const newTotalQuantity = existingQuantity + parsedQuantity;

    if (newTotalQuantity > selectedProduct.stock) {
      Alert.alert(
        "Error",
        `Not enough stock. Available stock: ${selectedProduct.stock}`
      );
      return;
    }

    if (existingItem) {
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.productId === selectedProduct.id
            ? {
                ...item,
                quantity: item.quantity + parsedQuantity,
              }
            : item
        )
      );
    } else {
      setItems((currentItems) => [
        ...currentItems,
        {
          productId: selectedProduct.id,
          name: selectedProduct.name,
          sku: selectedProduct.sku,
          quantity: parsedQuantity,
          sellPrice: selectedProduct.sellPrice,
          stock: selectedProduct.stock,
        },
      ]);
    }

    setSelectedProductId("");
    setQuantity("1");
  };

  const handleRemoveItem = (productId: string) => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId)
    );
  };

  const handleCreateOrder = async () => {
    if (items.length === 0) {
      Alert.alert("Error", "Please add at least one product to the order.");
      return;
    }

    if (parsedDiscount < 0 || parsedShippingFee < 0) {
      Alert.alert("Error", "Discount and shipping fee cannot be negative.");
      return;
    }

    try {
      setSaving(true);

      // The API revalidates stock and calculates authoritative totals; these
      // client-side values provide immediate feedback before submission.
      await createOrder({
        orderNumber: orderNumber.trim() || undefined,
        customerName: customerName.trim() || undefined,
        platform: "MANUAL",
        status: "PAID",
        discount: parsedDiscount,
        shippingFee: parsedShippingFee,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          sellPrice: item.sellPrice,
        })),
      });

      router.replace("/orders" as any);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to create order";

      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Order</Text>
      <Text style={styles.subtitle}>
        Add one or more products into this order.
      </Text>

      <Text style={styles.label}>Order Number</Text>
      <TextInput
        style={styles.input}
        placeholder="Optional order number"
        value={orderNumber}
        onChangeText={setOrderNumber}
      />

      <Text style={styles.label}>Customer Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Optional customer name"
        value={customerName}
        onChangeText={setCustomerName}
      />

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Add Product to Order</Text>

        {loadingProducts ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.smallText}>Loading products...</Text>
          </View>
        ) : products.length === 0 ? (
          <Text style={styles.emptyText}>
            No active products available. Please activate or add a product first.
          </Text>
        ) : (
          <View style={styles.productList}>
            {products.map((product) => {
              const isSelected = selectedProductId === product.id;

              return (
                <Pressable
                  key={product.id}
                  style={[
                    styles.productOption,
                    isSelected && styles.selectedProductOption,
                  ]}
                  onPress={() => setSelectedProductId(product.id)}
                >
                  <Text
                    style={[
                      styles.productName,
                      isSelected && styles.selectedProductText,
                    ]}
                  >
                    {product.name}
                  </Text>

                  <Text
                    style={[
                      styles.productMeta,
                      isSelected && styles.selectedProductText,
                    ]}
                  >
                    SKU: {product.sku} | Stock: {product.stock} | RM{" "}
                    {product.sellPrice.toFixed(2)}
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

        <Pressable style={styles.secondaryButton} onPress={handleAddItem}>
          <Text style={styles.secondaryButtonText}>Add Item</Text>
        </Pressable>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Selected Items</Text>

        {items.length === 0 ? (
          <Text style={styles.emptyText}>No products added yet.</Text>
        ) : (
          items.map((item) => (
            <View key={item.productId} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.flexItem}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>SKU: {item.sku}</Text>
                </View>

                <Pressable
                  style={styles.removeButton}
                  onPress={() => handleRemoveItem(item.productId)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>

              <Text style={styles.itemMeta}>
                Quantity: {item.quantity} x RM {item.sellPrice.toFixed(2)}
              </Text>

              <Text style={styles.itemTotal}>
                Line Total: RM {(item.quantity * item.sellPrice).toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>

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

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Order Summary</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>RM {subtotal.toFixed(2)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Discount</Text>
          <Text style={styles.summaryValue}>
            RM {parsedDiscount.toFixed(2)}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Shipping Fee</Text>
          <Text style={styles.summaryValue}>
            RM {parsedShippingFee.toFixed(2)}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>RM {total.toFixed(2)}</Text>
        </View>
      </View>

      <Pressable
        style={[styles.saveButton, saving && styles.disabledButton]}
        onPress={handleCreateOrder}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Creating..." : "Create Order"}
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
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  loadingBox: {
    alignItems: "center",
    padding: 16,
  },
  smallText: {
    marginTop: 8,
    color: "#666",
    fontSize: 13,
  },
  emptyText: {
    backgroundColor: "#f6f6f6",
    borderRadius: 10,
    padding: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 14,
  },
  productList: {
    marginBottom: 14,
  },
  productOption: {
    backgroundColor: "#f6f6f6",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  selectedProductOption: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  productName: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111",
    marginBottom: 4,
  },
  productMeta: {
    fontSize: 12,
    color: "#666",
  },
  selectedProductText: {
    color: "#fff",
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111",
    fontWeight: "900",
  },
  itemCard: {
    backgroundColor: "#f6f6f6",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  flexItem: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111",
  },
  removeButton: {
    backgroundColor: "#ffecec",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  removeButtonText: {
    color: "#cc3333",
    fontWeight: "800",
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryLabel: {
    color: "#666",
    fontWeight: "700",
  },
  summaryValue: {
    color: "#111",
    fontWeight: "800",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "900",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "900",
  },
  saveButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginBottom: 20,
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
