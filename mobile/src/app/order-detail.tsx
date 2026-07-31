import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import {
  completeImportedOrder,
  getOrderById,
  OrderStatus,
  SalesOrder,
  updateOrderStatus,
} from "../api/orders";
import { getProducts, Product } from "../api/products";
import { ErrorState } from "../components/ErrorState";
import { FieldError } from "../components/FieldError";
import { LoadingState } from "../components/LoadingState";
import { UI } from "../constants/ui";
import { showSuccessMessage } from "../utils/showSuccessMessage";

type SelectedImportedOrderItem = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  stock: number;
};

type ApiError = {
  response?: {
    status?: number;
    data?: {
      message?: unknown;
    };
  };
};

const getCompletionErrorMessage = (error: unknown) => {
  const apiError =
    typeof error === "object" && error !== null
      ? (error as ApiError)
      : {};
  const status = apiError.response?.status;
  const responseMessage = apiError.response?.data?.message;
  const message =
    typeof responseMessage === "string" ? responseMessage : "";

  if (!apiError.response) {
    return "Unable to reach the server. Check your connection and try again.";
  }

  if (/not enough stock/i.test(message)) {
    return message;
  }

  if (/product/i.test(message) && /not found/i.test(message)) {
    return "One or more selected products could not be found. Reload the products and try again.";
  }

  if (/inactive/i.test(message)) {
    return "One or more selected products are no longer active. Reload the products and try again.";
  }

  if (/already/i.test(message)) {
    return "This imported order has already been completed.";
  }

  if (/not an incomplete TikTok import/i.test(message)) {
    return "This imported order is no longer eligible for completion.";
  }

  if (/order not found/i.test(message)) {
    return "This order could not be found.";
  }

  if (status === 400) {
    return "Please review the selected products and quantities, then try again.";
  }

  if (status === 409) {
    return "This imported order is no longer eligible for completion.";
  }

  return "Unable to complete the imported order. Please try again.";
};

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productLoadError, setProductLoadError] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedItems, setSelectedItems] = useState<
    SelectedImportedOrderItem[]
  >([]);
  const [fieldErrors, setFieldErrors] = useState({
    product: "",
    quantity: "",
    selectedItems: "",
  });
  const [completionError, setCompletionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const loadOrder = async (showLoading = true) => {
    if (!orderId) return;

    try {
      if (showLoading) {
        setLoading(true);
        setLoadError(false);
      }

      const result = await getOrderById(orderId);
      setOrder(result);

      if (
        result.source === "TIKTOK" &&
        result.importStatus === "NEEDS_ITEMS" &&
        !result.stockProcessed
      ) {
        void loadProducts();
      }

      return result;
    } catch {
      if (showLoading) {
        setLoadError(true);
        setOrder(null);
      }

      return null;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      setProductLoadError("");

      const result = await getProducts(1, 100, "", true);
      setProducts(result.products);
    } catch {
      setProductLoadError(
        "Unable to load available products. Check your connection and try again."
      );
    } finally {
      setLoadingProducts(false);
    }
  };

  const updateStatus = async (status: OrderStatus) => {
    if (!orderId) return;

    try {
      setUpdating(true);

      await updateOrderStatus(orderId, status);
      await loadOrder();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to update order status";

      Alert.alert("Error", message);
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = async (status: OrderStatus) => {
    if (status !== "CANCELLED" && status !== "REFUNDED") {
      await updateStatus(status);
      return;
    }

    const actionLabel = status === "CANCELLED" ? "cancel" : "refund";

    // React Native alerts do not provide confirmation buttons on web.
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Are you sure you want to ${actionLabel} this order? Stock will be restored.`
      );

      if (confirmed) {
        await updateStatus(status);
      }

      return;
    }

    Alert.alert(
      status === "CANCELLED" ? "Cancel Order" : "Refund Order",
      `Are you sure you want to ${actionLabel} this order? Stock will be restored.`,
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => updateStatus(status),
        },
      ]
    );
  };

  // Refresh when returning from another route so status changes stay current.
  useFocusEffect(
    useCallback(() => {
      void loadOrder();
    }, [orderId])
  );

  const canCompleteImportedOrder =
    order?.source === "TIKTOK" &&
    order.importStatus === "NEEDS_ITEMS" &&
    !order.stockProcessed;

  const selectedProduct = products.find(
    (product) => product.id === selectedProductId
  );

  const handleAddItem = () => {
    const errors = {
      product: "",
      quantity: "",
    };
    const parsedQuantity = Number(quantity);

    if (!selectedProduct) {
      errors.product = "Please select a product.";
    }

    if (
      !quantity.trim() ||
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      errors.quantity = "Quantity must be a positive whole number.";
    }

    const existingItem = selectedProduct
      ? selectedItems.find(
          (item) => item.productId === selectedProduct.id
        )
      : undefined;
    const combinedQuantity =
      (existingItem?.quantity ?? 0) +
      (Number.isInteger(parsedQuantity) ? parsedQuantity : 0);

    if (
      selectedProduct &&
      !errors.quantity &&
      combinedQuantity > selectedProduct.stock
    ) {
      errors.quantity = `Quantity cannot exceed available stock (${selectedProduct.stock}).`;
    }

    setFieldErrors((current) => ({
      ...current,
      product: errors.product,
      quantity: errors.quantity,
    }));

    if (errors.product || errors.quantity || !selectedProduct) {
      return;
    }

    if (existingItem) {
      setSelectedItems((currentItems) =>
        currentItems.map((item) =>
          item.productId === selectedProduct.id
            ? { ...item, quantity: item.quantity + parsedQuantity }
            : item
        )
      );
    } else {
      setSelectedItems((currentItems) => [
        ...currentItems,
        {
          productId: selectedProduct.id,
          name: selectedProduct.name,
          sku: selectedProduct.sku,
          quantity: parsedQuantity,
          stock: selectedProduct.stock,
        },
      ]);
    }

    setSelectedProductId("");
    setQuantity("1");
    setFieldErrors((current) => ({
      ...current,
      product: "",
      quantity: "",
      selectedItems: "",
    }));
    setCompletionError("");
  };

  const handleRemoveItem = (productId: string) => {
    setSelectedItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId)
    );
  };

  const handleCompleteOrder = async () => {
    if (submittingRef.current) {
      return;
    }

    if (selectedItems.length === 0) {
      setFieldErrors((current) => ({
        ...current,
        selectedItems: "Please add at least one item to complete the order.",
      }));
      return;
    }

    if (!orderId) {
      setCompletionError("This order could not be found.");
      return;
    }

    try {
      submittingRef.current = true;
      setSubmitting(true);
      setCompletionError("");

      const completedOrder = await completeImportedOrder(
        orderId,
        selectedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
      );

      setOrder(completedOrder);
      setSelectedItems([]);
      setSelectedProductId("");
      setQuantity("1");
      setFieldErrors({
        product: "",
        quantity: "",
        selectedItems: "",
      });

      showSuccessMessage("Imported order completed successfully.");

      const refreshedOrder = await loadOrder(false);

      if (!refreshedOrder) {
        setCompletionError(
          "The order was completed, but its latest details could not be reloaded. Reopen this order to refresh it."
        );
      } else if (
        refreshedOrder.importStatus !== "READY" ||
        !refreshedOrder.stockProcessed
      ) {
        setCompletionError(
          "The order was completed, but its latest Ready status could not be confirmed. Refresh the order and try again."
        );
      }
    } catch (error) {
      setCompletionError(getCompletionErrorMessage(error));

      if (
        typeof error === "object" &&
        error !== null &&
        (error as ApiError).response?.status === 409
      ) {
        await loadOrder(false);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState title="Loading order..." />;
  }

  if (loadError) {
    return (
      <ErrorState
        title="Failed to load order"
        message="Please check your connection or backend API, then try again."
        onRetry={() => void loadOrder()}
      />
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Order not found.</Text>
      </View>
    );
  }

  const canMarkShipped =
    order.status !== "SHIPPED" &&
    order.status !== "DELIVERED" &&
    order.status !== "CANCELLED" &&
    order.status !== "REFUNDED";

  const canMarkDelivered = order.status === "SHIPPED";

  const canCancel =
    order.status !== "CANCELLED" &&
    order.status !== "REFUNDED" &&
    order.status !== "DELIVERED";

  const canRefund =
    order.status !== "CANCELLED" &&
    order.status !== "REFUNDED";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        {order.orderNumber || "Order Detail"}
      </Text>

      <Text style={styles.subtitle}>
        {new Date(order.createdAt).toLocaleString()}
      </Text>

      {completionError ? (
        <View style={styles.formError}>
          <Text style={styles.formErrorText}>{completionError}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Order Information</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Customer</Text>
          <Text style={styles.infoValue}>
            {order.customerName || "No customer name"}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={styles.infoValue}>{order.status}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Platform</Text>
          <Text style={styles.infoValue}>{order.platform}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Order Number</Text>
          <Text style={styles.infoValue}>
            {order.orderNumber || "-"}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>TikTok Order ID</Text>
          <Text style={styles.infoValue}>
            {order.tiktokOrderId || "-"}
          </Text>
        </View>

        {order.source === "TIKTOK" ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Import Status</Text>
            <Text
              style={[
                styles.importBadge,
                order.importStatus === "READY" && order.stockProcessed
                  ? styles.readyBadge
                  : order.importStatus === "NEEDS_ITEMS"
                    ? styles.needsItemsBadge
                    : styles.failedBadge,
              ]}
            >
              {order.importStatus === "READY" && order.stockProcessed
                ? "Ready"
                : order.importStatus === "NEEDS_ITEMS"
                  ? "Needs Items"
                  : "Import Failed"}
            </Text>
          </View>
        ) : null}
      </View>

      {canCompleteImportedOrder ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Complete Imported Order</Text>
          <Text style={styles.sectionDescription}>
            Match this TikTok order with one or more local products.
          </Text>

          <FieldError message={fieldErrors.product} />

          {loadingProducts ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={UI.colors.primary} />
              <Text style={styles.loadingText}>Loading products...</Text>
            </View>
          ) : productLoadError ? (
            <View style={styles.productErrorBox}>
              <Text style={styles.productErrorText}>{productLoadError}</Text>
              <Pressable
                style={styles.retryButton}
                onPress={() => void loadProducts()}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : products.length === 0 ? (
            <Text style={styles.emptyText}>
              No active products are available.
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
                    onPress={() => {
                      setSelectedProductId(product.id);
                      setFieldErrors((current) => ({
                        ...current,
                        product: "",
                      }));
                    }}
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
                      SKU: {product.sku} | Available stock: {product.stock}
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
            onChangeText={(value) => {
              setQuantity(value);
              setFieldErrors((current) => ({
                ...current,
                quantity: "",
              }));
            }}
            keyboardType="numeric"
          />
          <FieldError message={fieldErrors.quantity} />

          <Pressable
            style={styles.secondaryButton}
            onPress={handleAddItem}
            disabled={loadingProducts || Boolean(productLoadError)}
          >
            <Text style={styles.secondaryButtonText}>Add Item</Text>
          </Pressable>

          <View style={styles.selectedItemsSection}>
            <Text style={styles.selectedItemsTitle}>Selected Items</Text>
            <FieldError message={fieldErrors.selectedItems} />

            {selectedItems.length === 0 ? (
              <Text style={styles.emptyText}>No products added yet.</Text>
            ) : (
              selectedItems.map((item) => (
                <View key={item.productId} style={styles.selectedItemCard}>
                  <View style={styles.itemHeader}>
                    <View style={styles.flexItem}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemSku}>SKU: {item.sku}</Text>
                    </View>

                    <Pressable
                      style={styles.removeButton}
                      onPress={() => handleRemoveItem(item.productId)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.selectedItemMeta}>
                    Quantity: {item.quantity}
                  </Text>
                  <Text style={styles.selectedItemMeta}>
                    Available stock: {item.stock}
                  </Text>
                </View>
              ))
            )}
          </View>

          <Pressable
            style={[
              styles.completeButton,
              submitting && styles.disabledButton,
            ]}
            onPress={handleCompleteOrder}
            disabled={submitting}
          >
            {submitting ? (
              <View style={styles.submittingContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.completeButtonText}>Completing...</Text>
              </View>
            ) : (
              <Text style={styles.completeButtonText}>Complete Order</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Items</Text>

        {order.items.length === 0 ? (
          <Text style={styles.emptyText}>No order items yet.</Text>
        ) : (
          order.items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <Text style={styles.itemName}>
                {item.product.name}
              </Text>

              <Text style={styles.itemSku}>
                SKU: {item.product.sku}
              </Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Quantity</Text>
                <Text style={styles.infoValue}>{item.quantity}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Sell Price</Text>
                <Text style={styles.infoValue}>
                  RM {item.sellPrice.toFixed(2)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Line Total</Text>
                <Text style={styles.infoValue}>
                  RM {item.lineTotal.toFixed(2)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Line Profit</Text>
                <Text style={styles.infoValue}>
                  RM {item.lineProfit.toFixed(2)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Payment Summary</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Subtotal</Text>
          <Text style={styles.infoValue}>
            RM {order.subtotal.toFixed(2)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Discount</Text>
          <Text style={styles.infoValue}>
            RM {order.discount.toFixed(2)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Shipping Fee</Text>
          <Text style={styles.infoValue}>
            RM {order.shippingFee.toFixed(2)}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            RM {order.total.toFixed(2)}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Profit</Text>
          <Text style={styles.profitValue}>
            RM {order.profit.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Order Actions</Text>

        <View style={styles.actionRow}>
          {canMarkShipped ? (
            <Pressable
              style={[styles.actionButton, updating && styles.disabledButton]}
              onPress={() => handleStatusUpdate("SHIPPED")}
              disabled={updating}
            >
              <Text style={styles.actionButtonText}>Mark Shipped</Text>
            </Pressable>
          ) : null}

          {canMarkDelivered ? (
            <Pressable
              style={[styles.actionButton, updating && styles.disabledButton]}
              onPress={() => handleStatusUpdate("DELIVERED")}
              disabled={updating}
            >
              <Text style={styles.actionButtonText}>Mark Delivered</Text>
            </Pressable>
          ) : null}

          {canCancel ? (
            <Pressable
              style={[styles.dangerButton, updating && styles.disabledButton]}
              onPress={() => handleStatusUpdate("CANCELLED")}
              disabled={updating}
            >
              <Text style={styles.dangerButtonText}>Cancel Order</Text>
            </Pressable>
          ) : null}

          {canRefund ? (
            <Pressable
              style={[styles.warningButton, updating && styles.disabledButton]}
              onPress={() => handleStatusUpdate("REFUNDED")}
              disabled={updating}
            >
              <Text style={styles.warningButtonText}>Refund Order</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
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
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  formError: {
    backgroundColor: UI.colors.dangerSoft,
    borderWidth: 1,
    borderColor: "#FECDCA",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  formErrorText: {
    color: UI.colors.danger,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  sectionDescription: {
    color: "#666",
    fontSize: 13,
    lineHeight: 19,
    marginTop: -6,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  infoLabel: {
    color: "#666",
    fontSize: 13,
    fontWeight: "700",
  },
  infoValue: {
    color: "#111",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    flex: 1,
  },
  importBadge: {
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  readyBadge: {
    backgroundColor: UI.colors.successSoft,
    color: UI.colors.success,
  },
  needsItemsBadge: {
    backgroundColor: UI.colors.warningSoft,
    color: UI.colors.warning,
  },
  failedBadge: {
    backgroundColor: UI.colors.dangerSoft,
    color: UI.colors.danger,
  },
  loadingBox: {
    alignItems: "center",
    padding: 16,
  },
  productErrorBox: {
    alignItems: "center",
    backgroundColor: UI.colors.dangerSoft,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  productErrorText: {
    color: UI.colors.danger,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: UI.colors.ink,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
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
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: {
    color: "#111",
    fontWeight: "900",
  },
  selectedItemsSection: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    marginTop: 18,
    paddingTop: 16,
  },
  selectedItemsTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  selectedItemCard: {
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
  selectedItemMeta: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
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
  completeButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  completeButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },
  submittingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemCard: {
    backgroundColor: "#f7f7f7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  itemSku: {
    fontSize: 12,
    color: "#666",
    marginBottom: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  totalLabel: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
  },
  totalValue: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
  },
  profitValue: {
    color: "#1f8f46",
    fontSize: 15,
    fontWeight: "900",
  },
  actionRow: {
    gap: 10,
  },
  actionButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  dangerButton: {
    backgroundColor: "#ffecec",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#cc3333",
    fontWeight: "900",
  },
  warningButton: {
    backgroundColor: "#fff4d6",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  warningButtonText: {
    color: "#8a5a00",
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.6,
  },
});
