import { useEffect, useMemo, useRef, useState } from "react";
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
import { FieldError } from "../components/FieldError";
import { FloatingBackToTop } from "../components/FloatingBackToTop";
import { showSuccessMessage } from "../utils/showSuccessMessage";
import { UI } from "../constants/ui";
import { sharedStyles } from "../constants/sharedStyles";
import {
  calculateOrderDiscountPreview,
  DISCOUNT_OPTIONS,
  DiscountType,
} from "../utils/orderDiscount";

type SelectedOrderItem = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  sellPrice: number;
  stock: number;
};

export default function AddOrderScreen() {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const selectedItemsOffsetRef = useRef(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [items, setItems] = useState<SelectedOrderItem[]>([]);

  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("NONE");
  const [discount, setDiscount] = useState("0");
  const [shippingFee, setShippingFee] = useState("0");

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({
    orderNumber: "",
    customerName: "",
    product: "",
    quantity: "",
    selectedItems: "",
  });

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);

      // Include inactive products so the picker can communicate their state.
      // Inactive products remain non-selectable below, matching the previous
      // active-only selection behavior.
      const result = await getProducts(1, 100);
      setProducts(result.products);
    } catch {
      Alert.alert("Unable to load products", "Please check your connection and try again.");
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

  const parsedShippingFee = Number(shippingFee);
  const shippingFeeIsValid =
    Number.isFinite(parsedShippingFee) && parsedShippingFee >= 0;
  const discountPreview = calculateOrderDiscountPreview({
    subtotal,
    shippingFee: shippingFeeIsValid ? parsedShippingFee : 0,
    type: discountType,
    value: discount,
  });
  const orderFinancialsAreValid =
    discountPreview.isValid && shippingFeeIsValid;

  const validateAddItemForm = () => {
    const errors = {
      product: "",
      quantity: "",
    };

    if (!selectedProductId) {
      errors.product = "Please select a product.";
    }

    if (!quantity || Number(quantity) < 1) {
      errors.quantity = "Quantity must be 1 or more.";
    }

    setFieldErrors((current) => ({
      ...current,
      product: errors.product,
      quantity: errors.quantity,
    }));

    return !Object.values(errors).some(Boolean);
  };

  const handleAddItem = () => {
    if (!validateAddItemForm()) {
      return;
    }

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
    setFieldErrors((current) => ({ ...current, selectedItems: "" }));

    // The item card is rendered below the product picker. Bring it into view
    // after the state update so a successful add has immediate feedback.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, selectedItemsOffsetRef.current - UI.spacing.md),
        animated: true,
      });
    });
  };

  const handleRemoveItem = (productId: string) => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId)
    );
  };

  const validateOrderForm = () => {
    const errors = {
      orderNumber: "",
      customerName: "",
      selectedItems: "",
    };

    if (!orderNumber.trim()) {
      errors.orderNumber = "Order number is required.";
    }

    if (!customerName.trim()) {
      errors.customerName = "Customer name is required.";
    }

    if (items.length === 0) {
      errors.selectedItems = "Please add at least one item to the order.";
    }

    setFieldErrors((current) => ({
      ...current,
      orderNumber: errors.orderNumber,
      customerName: errors.customerName,
      selectedItems: errors.selectedItems,
    }));

    return !Object.values(errors).some(Boolean);
  };

  const handleCreateOrder = async () => {
    if (!validateOrderForm()) {
      return;
    }

    if (items.length === 0) {
      Alert.alert("Error", "Please add at least one product to the order.");
      return;
    }

    if (!orderFinancialsAreValid) {
      Alert.alert(
        "Error",
        discountPreview.error || "Enter a valid non-negative shipping fee."
      );
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
        status: "COMPLETED",
        discount: {
          type: discountType,
          value: discountPreview.enteredValue,
        },
        shippingFee: parsedShippingFee,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          sellPrice: item.sellPrice,
        })),
      });

      showSuccessMessage("Order created successfully.");

      router.replace("/orders" as any);
    } catch {
      Alert.alert("Save failed", "Unable to create this order. Please review the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <View style={styles.screenShell}>
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.container}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      onScroll={(event) =>
        setShowBackToTop(event.nativeEvent.contentOffset.y > 240)
      }
      scrollEventThrottle={16}
    >
      <Text accessibilityRole="header" style={styles.title}>Order details</Text>
      <Text style={styles.subtitle}>
        Add one or more products into this order.
      </Text>

      <Text style={styles.label}>Order Number</Text>
      <TextInput
        style={styles.input}
        placeholder="Optional order number"
        placeholderTextColor={UI.colors.inkSubtle}
        value={orderNumber}
        onChangeText={(value) => {
          setOrderNumber(value);
          setFieldErrors((current) => ({ ...current, orderNumber: "" }));
        }}
      />
      <FieldError message={fieldErrors.orderNumber} />

      <Text style={styles.label}>Customer Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Optional customer name"
        placeholderTextColor={UI.colors.inkSubtle}
        value={customerName}
        onChangeText={(value) => {
          setCustomerName(value);
          setFieldErrors((current) => ({ ...current, customerName: "" }));
        }}
      />
      <FieldError message={fieldErrors.customerName} />

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Add Product to Order</Text>
        <FieldError message={fieldErrors.product} />

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
              const isInactive = !product.isActive;
              const isFaded = isInactive || product.stock < 1;

              return (
                <Pressable
                  key={product.id}
                  style={[
                    styles.productOption,
                    isSelected && styles.selectedProductOption,
                    isFaded && styles.disabledProductOption,
                  ]}
                  onPress={() => {
                    if (isInactive) {
                      return;
                    }

                    setSelectedProductId(product.id);
                    setFieldErrors((current) => ({ ...current, product: "" }));
                  }}
                  disabled={isInactive}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: isInactive }}
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
          placeholderTextColor={UI.colors.inkSubtle}
          value={quantity}
          onChangeText={(value) => {
            setQuantity(value);
            setFieldErrors((current) => ({ ...current, quantity: "" }));
          }}
          keyboardType="numeric"
          inputMode="numeric"
        />
        <FieldError message={fieldErrors.quantity} />

        <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={handleAddItem}>
          <Text style={styles.secondaryButtonText}>Add Item</Text>
        </Pressable>
      </View>

      <View
        style={styles.formCard}
        onLayout={(event) => {
          selectedItemsOffsetRef.current = event.nativeEvent.layout.y;
        }}
      >
        <Text style={styles.sectionTitle}>Selected Items</Text>
        <FieldError message={fieldErrors.selectedItems} />

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
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name}`}
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

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Discount</Text>
        <View style={styles.discountOptions}>
          {DISCOUNT_OPTIONS.map((option) => (
            <Pressable
              key={option.type}
              style={[
                styles.discountOption,
                discountType === option.type && styles.discountOptionActive,
              ]}
              onPress={() => {
                setDiscountType(option.type);
                setDiscount("0");
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: discountType === option.type }}
            >
              <Text
                style={[
                  styles.discountOptionText,
                  discountType === option.type &&
                    styles.discountOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {discountType !== "NONE" ? (
          <>
            <Text style={styles.label}>
              {discountType === "FIXED" ? "Amount (RM)" : "Percentage (%)"}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={discountType === "FIXED" ? "Example: 10.00" : "Example: 10"}
              placeholderTextColor={UI.colors.inkSubtle}
              value={discount}
              onChangeText={setDiscount}
              keyboardType="decimal-pad"
            />
          </>
        ) : null}
        <FieldError message={discountPreview.error} />
      </View>

      <Text style={styles.label}>Shipping Fee</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 0"
        placeholderTextColor={UI.colors.inkSubtle}
        value={shippingFee}
        onChangeText={setShippingFee}
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <FieldError
        message={
          shippingFeeIsValid ? "" : "Shipping fee must be zero or greater."
        }
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
            RM {discountPreview.discountAmount.toFixed(2)}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Shipping Fee</Text>
          <Text style={styles.summaryValue}>
            RM {(shippingFeeIsValid ? parsedShippingFee : 0).toFixed(2)}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            RM {discountPreview.finalTotal.toFixed(2)}
          </Text>
        </View>
      </View>

      <Pressable
        style={[
          styles.saveButton,
          (saving || !orderFinancialsAreValid) && styles.disabledButton,
        ]}
        onPress={handleCreateOrder}
        disabled={saving || !orderFinancialsAreValid}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving || !orderFinancialsAreValid, busy: saving }}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Creating..." : "Create Order"}
        </Text>
      </Pressable>

      <Pressable accessibilityRole="button" style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
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
  label: {
    ...sharedStyles.label,
  },
  input: {
    ...sharedStyles.input,
    ...sharedStyles.inputWeb,
    marginBottom: 14,
  },
  formCard: {
    ...sharedStyles.card,
    marginBottom: 16,
  },
  discountOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  discountOption: {
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.colors.borderStrong,
    backgroundColor: UI.colors.surfaceMuted,
  },
  discountOptionActive: {
    backgroundColor: UI.colors.ink,
    borderColor: UI.colors.ink,
  },
  discountOptionText: {
    color: UI.colors.inkMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  discountOptionTextActive: { color: UI.colors.onDark },
  sectionTitle: {
    ...sharedStyles.sectionTitle,
  },
  loadingBox: {
    alignItems: "center",
    padding: 16,
  },
  smallText: {
    marginTop: 8,
    color: UI.colors.inkMuted,
    fontSize: 13,
  },
  emptyText: {
    backgroundColor: UI.colors.surfaceMuted,
    borderRadius: 10,
    padding: 14,
    color: UI.colors.inkMuted,
    textAlign: "center",
    marginBottom: 14,
  },
  productList: {
    marginBottom: 14,
  },
  productOption: {
    backgroundColor: UI.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: UI.colors.borderStrong,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  selectedProductOption: {
    backgroundColor: UI.colors.ink,
    borderColor: UI.colors.ink,
  },
  // Keep this aligned with Order Completion's disabled product option.
  disabledProductOption: {
    backgroundColor: UI.colors.surfaceMuted,
    borderColor: UI.colors.border,
    opacity: 0.65,
  },
  productName: {
    fontSize: 14,
    fontWeight: "900",
    color: UI.colors.ink,
    marginBottom: 4,
  },
  productMeta: {
    fontSize: 12,
    color: UI.colors.inkMuted,
  },
  selectedProductText: {
    color: UI.colors.onDark,
  },
  secondaryButton: {
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderStrong,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: UI.colors.ink,
    fontWeight: "900",
  },
  itemCard: {
    backgroundColor: UI.colors.surfaceMuted,
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
    color: UI.colors.inkMuted,
    marginBottom: 4,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: "900",
    color: UI.colors.ink,
  },
  removeButton: {
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
    backgroundColor: UI.colors.dangerSoft,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  removeButtonText: {
    color: UI.colors.danger,
    fontWeight: "800",
    fontSize: 12,
  },
  summaryCard: {
    ...sharedStyles.card,
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
    color: UI.colors.inkMuted,
    fontWeight: "700",
  },
  summaryValue: {
    color: UI.colors.ink,
    fontWeight: "800",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
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
  cancelButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
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
