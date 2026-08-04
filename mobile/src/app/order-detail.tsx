import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
  sellPrice: number;
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

const isCompletedImportedOrder = (
  value: SalesOrder | null | undefined
): value is SalesOrder =>
  Boolean(
    value &&
      value.source === "TIKTOK" &&
      value.importStatus === "READY" &&
      value.stockProcessed &&
      Array.isArray(value.items)
  );

const formatOrderDate = (dateString: string | null) => {
  if (!dateString) {
    return "Not available";
  }

  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
};

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productLoadError, setProductLoadError] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<
    SelectedImportedOrderItem[]
  >([]);
  const [fieldErrors, setFieldErrors] = useState({
    product: "",
    selectedItems: "",
  });
  const [completionError, setCompletionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const confirmationOpenRef = useRef(false);
  const productsLoadedRef = useRef(false);
  const productsLoadingRef = useRef(false);

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

  const loadProducts = async (force = false) => {
    if (
      productsLoadingRef.current ||
      (!force && productsLoadedRef.current)
    ) {
      return;
    }

    try {
      productsLoadingRef.current = true;
      setLoadingProducts(true);
      setProductLoadError("");

      const result = await getProducts(1, 100, "", true);
      setProducts(result.products);
      productsLoadedRef.current = true;
    } catch {
      setProductLoadError(
        "Unable to load available products. Check your connection and try again."
      );
    } finally {
      productsLoadingRef.current = false;
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

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive),
    [products]
  );
  const normalizedProductSearch = productSearch.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    if (!normalizedProductSearch) {
      return activeProducts;
    }

    return activeProducts.filter((product) =>
      [product.name, product.sku].some((value) =>
        value.toLowerCase().includes(normalizedProductSearch)
      )
    );
  }, [activeProducts, normalizedProductSearch]);

  const selectedProductIds = useMemo(
    () => new Set(selectedItems.map((item) => item.productId)),
    [selectedItems]
  );

  const getSelectedItemError = (item: SelectedImportedOrderItem) => {
    const currentProduct = products.find(
      (product) => product.id === item.productId
    );

    if (!currentProduct || !currentProduct.isActive) {
      return "This product is no longer available. Remove it and choose another product.";
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return "Quantity must be a whole number of at least 1.";
    }

    if (item.quantity > currentProduct.stock) {
      return `Quantity cannot exceed available stock (${currentProduct.stock}).`;
    }

    return "";
  };

  const selectedItemErrors = selectedItems.map((item) => ({
    productId: item.productId,
    message: getSelectedItemError(item),
  }));
  const hasInvalidSelection = selectedItemErrors.some(
    (itemError) => Boolean(itemError.message)
  );
  const totalSelectedUnits = selectedItems.reduce(
    (total, item) => total + item.quantity,
    0
  );
  const estimatedSubtotal = selectedItems.reduce(
    (total, item) => {
      const currentSellPrice =
        products.find((product) => product.id === item.productId)?.sellPrice ??
        item.sellPrice;

      return total + currentSellPrice * item.quantity;
    },
    0
  );
  const estimatedOrderTotal = order
    ? estimatedSubtotal - order.discount + order.shippingFee
    : estimatedSubtotal;
  const completionDisabled =
    selectedItems.length === 0 || hasInvalidSelection || submitting;

  const handleAddProduct = (product: Product) => {
    if (!product.isActive) {
      setFieldErrors((current) => ({
        ...current,
        product: "This product is no longer active.",
      }));
      return;
    }

    if (selectedProductIds.has(product.id)) {
      setFieldErrors((current) => ({
        ...current,
        product: `${product.name} has already been added. Adjust its quantity below.`,
      }));
      return;
    }

    if (product.stock < 1) {
      setFieldErrors((current) => ({
        ...current,
        product: `${product.name} is out of stock.`,
      }));
      return;
    }

    setSelectedItems((currentItems) =>
      currentItems.some((item) => item.productId === product.id)
        ? currentItems
        : [
            ...currentItems,
            {
              productId: product.id,
              name: product.name,
              sku: product.sku,
              quantity: 1,
              stock: product.stock,
              sellPrice: product.sellPrice,
            },
          ]
    );
    setFieldErrors({ product: "", selectedItems: "" });
    setCompletionError("");
  };

  const handleChangeQuantity = (productId: string, change: -1 | 1) => {
    setSelectedItems((currentItems) =>
      currentItems.map((item) => {
        if (item.productId !== productId) {
          return item;
        }

        const currentProduct = products.find(
          (product) => product.id === productId
        );
        const availableStock = currentProduct?.stock ?? item.stock;
        const nextQuantity = item.quantity + change;

        if (nextQuantity < 1 || nextQuantity > availableStock) {
          return item;
        }

        return { ...item, quantity: nextQuantity };
      })
    );
    setFieldErrors((current) => ({ ...current, selectedItems: "" }));
    setCompletionError("");
  };

  const handleRemoveItem = (productId: string) => {
    setSelectedItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId)
    );
    setFieldErrors((current) => ({
      ...current,
      product: "",
      selectedItems: "",
    }));
    setCompletionError("");
  };

  const submitCompletion = async () => {
    if (submittingRef.current) {
      return;
    }

    if (selectedItems.length === 0 || hasInvalidSelection) {
      setFieldErrors((current) => ({
        ...current,
        selectedItems:
          selectedItems.length === 0
            ? "Please add at least one item to complete the order."
            : "Review the highlighted quantities before completing the order.",
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

      const refreshedOrder = await loadOrder(false);
      const latestCompletedOrder = isCompletedImportedOrder(refreshedOrder)
        ? refreshedOrder
        : isCompletedImportedOrder(completedOrder)
          ? completedOrder
          : null;

      if (!latestCompletedOrder) {
        setCompletionError(
          "The server returned an unexpected response. Reload the order before trying again."
        );
        return;
      }

      setOrder(latestCompletedOrder);
      setSelectedItems([]);
      setProductSearch("");
      setFieldErrors({ product: "", selectedItems: "" });

      showSuccessMessage("Imported order completed successfully.");

      if (!refreshedOrder) {
        setCompletionError(
          "The order was completed, but its latest details could not be reloaded. Reopen this order to refresh it."
        );
      }
    } catch (error) {
      setCompletionError(getCompletionErrorMessage(error));

      const status =
        typeof error === "object" && error !== null
          ? (error as ApiError).response?.status
          : undefined;

      if (status === 400 || status === 404) {
        await loadProducts(true);
      }

      if (
        status === 409
      ) {
        await loadOrder(false);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCompleteOrder = () => {
    if (
      completionDisabled ||
      submittingRef.current ||
      confirmationOpenRef.current
    ) {
      return;
    }

    const confirmationMessage =
      "Complete this order and deduct the selected quantities from stock?";

    confirmationOpenRef.current = true;

    if (Platform.OS === "web") {
      const confirmed = window.confirm(confirmationMessage);
      confirmationOpenRef.current = false;

      if (confirmed) {
        void submitCompletion();
      }

      return;
    }

    Alert.alert(
      "Complete Order",
      confirmationMessage,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            confirmationOpenRef.current = false;
          },
        },
        {
          text: "Complete Order",
          onPress: () => {
            confirmationOpenRef.current = false;
            void submitCompletion();
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          confirmationOpenRef.current = false;
        },
      },
    );
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
    <ScrollView
      contentContainerStyle={[
        styles.container,
        isSmallScreen && styles.smallScreenContainer,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.title}>
        {order.orderNumber || order.id}
      </Text>

      <Text style={styles.subtitle}>
        {order.source === "TIKTOK" ? "TikTok order" : "Order detail"}
      </Text>

      {completionError ? (
        <View style={styles.formError}>
          <Text style={styles.formErrorText}>{completionError}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Order Information</Text>

        <View style={[styles.infoRow, isSmallScreen && styles.smallInfoRow]}>
          <Text style={styles.infoLabel}>Order Identifier</Text>
          <Text
            selectable
            style={[styles.infoValue, isSmallScreen && styles.smallInfoValue]}
          >
            {order.orderNumber || order.id}
          </Text>
        </View>

        {order.source === "TIKTOK" ? (
          <View style={[styles.infoRow, isSmallScreen && styles.smallInfoRow]}>
            <Text style={styles.infoLabel}>TikTok Order ID</Text>
            <Text
              selectable
              style={[
                styles.infoValue,
                styles.longIdentifier,
                isSmallScreen && styles.smallInfoValue,
              ]}
            >
              {order.tiktokOrderId || "-"}
            </Text>
          </View>
        ) : null}

        <View style={[styles.infoRow, isSmallScreen && styles.smallInfoRow]}>
          <Text style={styles.infoLabel}>Order Source</Text>
          <Text
            style={[styles.infoValue, isSmallScreen && styles.smallInfoValue]}
          >
            {order.source === "TIKTOK" ? "TikTok" : "Manual"}
          </Text>
        </View>

        {order.source === "TIKTOK" ? (
          <View style={[styles.infoRow, isSmallScreen && styles.smallInfoRow]}>
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

        <View style={[styles.infoRow, isSmallScreen && styles.smallInfoRow]}>
          <Text style={styles.infoLabel}>Order Status</Text>
          <Text
            style={[styles.infoValue, isSmallScreen && styles.smallInfoValue]}
          >
            {order.status}
          </Text>
        </View>

        <View style={[styles.infoRow, isSmallScreen && styles.smallInfoRow]}>
          <Text style={styles.infoLabel}>
            {order.source === "TIKTOK" && order.importedAt
              ? "Imported"
              : "Created"}
          </Text>
          <Text
            style={[styles.infoValue, isSmallScreen && styles.smallInfoValue]}
          >
            {formatOrderDate(
              order.source === "TIKTOK" && order.importedAt
                ? order.importedAt
                : order.createdAt
            )}
          </Text>
        </View>

        <View style={[styles.infoRow, isSmallScreen && styles.smallInfoRow]}>
          <Text style={styles.infoLabel}>Customer</Text>
          <Text
            style={[styles.infoValue, isSmallScreen && styles.smallInfoValue]}
          >
            {order.customerName || "No customer name"}
          </Text>
        </View>

        <View style={[styles.infoRow, isSmallScreen && styles.smallInfoRow]}>
          <Text style={styles.infoLabel}>Platform</Text>
          <Text
            style={[styles.infoValue, isSmallScreen && styles.smallInfoValue]}
          >
            {order.platform}
          </Text>
        </View>
      </View>

      {canCompleteImportedOrder ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Complete Imported Order</Text>
          <Text style={styles.sectionDescription}>
            Match this TikTok order with one or more local products.
          </Text>

          <Text style={styles.label}>Search products</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by product name or SKU"
            value={productSearch}
            onChangeText={(value) => {
              setProductSearch(value);
              setFieldErrors((current) => ({ ...current, product: "" }));
            }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search products by name or SKU"
          />
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
                onPress={() => void loadProducts(true)}
                accessibilityRole="button"
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : activeProducts.length === 0 ? (
            <Text style={styles.emptyText}>
              No active products are available.
            </Text>
          ) : filteredProducts.length === 0 ? (
            <Text style={styles.emptyText}>
              No products match “{productSearch.trim()}”.
            </Text>
          ) : (
            <View style={styles.productList}>
              {filteredProducts.map((product) => {
                const isAlreadySelected = selectedProductIds.has(product.id);
                const isOutOfStock = product.stock < 1;
                const isDisabled = isAlreadySelected || isOutOfStock;

                return (
                  <Pressable
                    key={product.id}
                    style={[
                      styles.productOption,
                      isDisabled && styles.disabledProductOption,
                    ]}
                    onPress={() => handleAddProduct(product)}
                    disabled={isDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isAlreadySelected
                        ? `${product.name} is already added`
                        : isOutOfStock
                          ? `${product.name} is out of stock`
                          : `Add ${product.name}, SKU ${product.sku}, ${product.stock} available`
                    }
                    accessibilityState={{ disabled: isDisabled }}
                  >
                    <View style={styles.productResultContent}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productMeta}>SKU: {product.sku}</Text>
                      <Text style={styles.productMeta}>
                        Available stock: {product.stock}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.productActionText,
                        isDisabled && styles.disabledProductActionText,
                      ]}
                    >
                      {isAlreadySelected
                        ? "Added"
                        : isOutOfStock
                          ? "Out of stock"
                          : "Add"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.selectedItemsSection}>
            <Text style={styles.selectedItemsTitle}>Selected Items</Text>
            <FieldError message={fieldErrors.selectedItems} />

            {selectedItems.length === 0 ? (
              <Text style={styles.emptyText}>No products added yet.</Text>
            ) : (
              selectedItems.map((item) => {
                const currentProduct = products.find(
                  (product) => product.id === item.productId
                );
                const availableStock = currentProduct?.stock ?? item.stock;
                const itemError = selectedItemErrors.find(
                  (error) => error.productId === item.productId
                )?.message;
                const cannotDecrease = item.quantity <= 1;
                const cannotIncrease =
                  Boolean(itemError) || item.quantity >= availableStock;

                return (
                  <View key={item.productId} style={styles.selectedItemCard}>
                    <View style={styles.itemHeader}>
                      <View style={styles.flexItem}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemSku}>SKU: {item.sku}</Text>
                        <Text style={styles.selectedItemMeta}>
                          Available stock: {availableStock}
                        </Text>
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

                    <View style={styles.quantityRow}>
                      <Text style={styles.quantityLabel}>Quantity</Text>
                      <View style={styles.quantityControls}>
                        <Pressable
                          style={[
                            styles.quantityButton,
                            cannotDecrease && styles.disabledQuantityButton,
                          ]}
                          onPress={() =>
                            handleChangeQuantity(item.productId, -1)
                          }
                          disabled={cannotDecrease}
                          accessibilityRole="button"
                          accessibilityLabel={`Decrease quantity for ${item.name}`}
                          accessibilityState={{ disabled: cannotDecrease }}
                        >
                          <Text style={styles.quantityButtonText}>−</Text>
                        </Pressable>
                        <Text
                          style={styles.quantityValue}
                          accessibilityLabel={`Quantity ${item.quantity}`}
                        >
                          {item.quantity}
                        </Text>
                        <Pressable
                          style={[
                            styles.quantityButton,
                            cannotIncrease && styles.disabledQuantityButton,
                          ]}
                          onPress={() =>
                            handleChangeQuantity(item.productId, 1)
                          }
                          disabled={cannotIncrease}
                          accessibilityRole="button"
                          accessibilityLabel={`Increase quantity for ${item.name}`}
                          accessibilityState={{ disabled: cannotIncrease }}
                        >
                          <Text style={styles.quantityButtonText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                    <FieldError message={itemError} />
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.selectedSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Selected products</Text>
              <Text style={styles.summaryValue}>{selectedItems.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total units</Text>
              <Text style={styles.summaryValue}>{totalSelectedUnits}</Text>
            </View>
            <View style={[styles.summaryRow, styles.estimatedTotalRow]}>
              <Text style={styles.estimatedTotalLabel}>
                Estimated order total
              </Text>
              <Text style={styles.estimatedTotalValue}>
                RM {estimatedOrderTotal.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.completionActionArea}>
            <Pressable
              style={[
                styles.completeButton,
                completionDisabled && styles.disabledButton,
              ]}
              onPress={handleCompleteOrder}
              disabled={completionDisabled}
              accessibilityRole="button"
              accessibilityState={{
                disabled: completionDisabled,
                busy: submitting,
              }}
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
    paddingBottom: 32,
    backgroundColor: "#f6f6f6",
    flexGrow: 1,
  },
  smallScreenContainer: {
    padding: 12,
    paddingBottom: 28,
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
    flexShrink: 1,
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
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  smallInfoRow: {
    flexDirection: "column",
    gap: 4,
    marginBottom: 14,
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
    flexShrink: 1,
  },
  smallInfoValue: {
    textAlign: "left",
    alignSelf: "stretch",
    flex: 0,
  },
  longIdentifier: {
    minWidth: 0,
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
    minHeight: 44,
    justifyContent: "center",
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
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  disabledProductOption: {
    backgroundColor: UI.colors.surfaceMuted,
    borderColor: UI.colors.border,
    opacity: 0.65,
  },
  productResultContent: {
    flex: 1,
    minWidth: 0,
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
    lineHeight: 18,
  },
  productActionText: {
    color: UI.colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  disabledProductActionText: {
    color: UI.colors.inkMuted,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
    color: "#333",
  },
  searchInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 44,
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
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  removeButtonText: {
    color: "#cc3333",
    fontWeight: "800",
    fontSize: 12,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  quantityLabel: {
    color: "#333",
    fontSize: 13,
    fontWeight: "800",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: UI.colors.border,
    backgroundColor: UI.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledQuantityButton: {
    backgroundColor: UI.colors.surfaceMuted,
    opacity: 0.45,
  },
  quantityButtonText: {
    color: UI.colors.ink,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
  },
  quantityValue: {
    minWidth: 36,
    textAlign: "center",
    color: UI.colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  selectedSummary: {
    backgroundColor: UI.colors.surfaceMuted,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  summaryLabel: {
    color: UI.colors.inkMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  summaryValue: {
    color: UI.colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  estimatedTotalRow: {
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
    marginBottom: 0,
    paddingTop: 10,
  },
  estimatedTotalLabel: {
    color: UI.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  estimatedTotalValue: {
    color: UI.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  completionActionArea: {
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
    marginTop: 14,
    paddingTop: 14,
  },
  completeButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    minHeight: 48,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
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
    minHeight: 44,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  dangerButton: {
    backgroundColor: "#ffecec",
    borderRadius: 10,
    minHeight: 44,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#cc3333",
    fontWeight: "900",
  },
  warningButton: {
    backgroundColor: "#fff4d6",
    borderRadius: 10,
    minHeight: 44,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  warningButtonText: {
    color: "#8a5a00",
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.45,
  },
});
