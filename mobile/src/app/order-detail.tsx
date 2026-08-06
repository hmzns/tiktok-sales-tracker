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
import { FloatingBackToTop } from "../components/FloatingBackToTop";
import { LoadingState } from "../components/LoadingState";
import { UI } from "../constants/ui";
import { sharedStyles } from "../constants/sharedStyles";
import { StatusBadge, StatusTone } from "../components/ui/StatusBadge";
import { showSuccessMessage } from "../utils/showSuccessMessage";
import {
  buildCompletionConfirmationMessage,
  calculateOrderDiscountPreview,
  DISCOUNT_OPTIONS,
  DiscountType,
} from "../utils/orderDiscount";

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

  if (/discount|subtotal/i.test(message)) {
    return message;
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
      value.status === "COMPLETED" &&
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

const getOrderStatusTone = (status: OrderStatus): StatusTone => {
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED" || status === "REFUNDED") return "danger";
  return "warning";
};

const formatStatusLabel = (status: string) =>
  status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 600;
  const useWebProductRows = Platform.OS === "web" && !isSmallScreen;

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
  const [discountType, setDiscountType] = useState<DiscountType>("NONE");
  const [discountValue, setDiscountValue] = useState("0");
  const [fieldErrors, setFieldErrors] = useState({
    product: "",
    selectedItems: "",
  });
  const [completionError, setCompletionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [completionActionObscuresFloating, setCompletionActionObscuresFloating] =
    useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const completionActionRef = useRef<View>(null);
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
        result.status === "NEEDS_ITEMS" &&
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
    } catch {
      Alert.alert("Update failed", "Unable to update this order. Please try again.");
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
    order.status === "NEEDS_ITEMS" &&
    !order.stockProcessed;

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive),
    [products]
  );
  const normalizedProductSearch = productSearch.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    const matches = normalizedProductSearch
      ? activeProducts.filter((product) =>
          [product.name, product.sku].some((value) =>
            value.toLowerCase().includes(normalizedProductSearch)
          )
        )
      : activeProducts;

    return matches
      .map((product, originalIndex) => ({ product, originalIndex }))
      .sort((a, b) => {
        const stockDifference =
          Number(b.product.stock > 0) - Number(a.product.stock > 0);
        return stockDifference || a.originalIndex - b.originalIndex;
      })
      .map(({ product }) => product);
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
  const discountPreview = calculateOrderDiscountPreview({
    subtotal: estimatedSubtotal,
    shippingFee: order?.shippingFee ?? 0,
    type: discountType,
    value: discountValue,
  });
  const completionDisabled =
    selectedItems.length === 0 ||
    hasInvalidSelection ||
    !discountPreview.isValid ||
    submitting;

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

    if (
      selectedItems.length === 0 ||
      hasInvalidSelection ||
      !discountPreview.isValid
    ) {
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
        {
          discount: {
            type: discountType,
            value: discountPreview.enteredValue,
          },
          items: selectedItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }
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
      setDiscountType("NONE");
      setDiscountValue("0");
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

    const confirmationMessage = buildCompletionConfirmationMessage(
      discountPreview.finalTotal
    );

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
        message="Please check your connection and try again."
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

  const canCancel =
    order.status !== "CANCELLED" &&
    order.status !== "REFUNDED";

  const canRefund =
    order.status !== "CANCELLED" &&
    order.status !== "REFUNDED";

  return (
    <View style={styles.screenShell}>
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[
        styles.container,
        isSmallScreen && styles.smallScreenContainer,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      onScroll={(event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        setShowBackToTop(offsetY > 320);

        if (offsetY <= 320 || !canCompleteImportedOrder) {
          setCompletionActionObscuresFloating(false);
          return;
        }

        completionActionRef.current?.measureInWindow(
          (_x, y, _width, actionHeight) => {
            const floatingTop = height - 68;
            const floatingBottom = height - 20;
            setCompletionActionObscuresFloating(
              y < floatingBottom && y + actionHeight > floatingTop
            );
          }
        );
      }}
      scrollEventThrottle={16}
    >
      <Text accessibilityRole="header" style={styles.title}>
        {order.orderNumber || order.id}
      </Text>

      <Text style={styles.subtitle}>
        {order.source === "TIKTOK" ? "TikTok order" : "Order detail"}
      </Text>

      {completionError ? (
        <View accessibilityRole="alert" style={styles.formError}>
          <Text style={styles.formErrorText}>{completionError}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Order Information</Text>
        <View style={[styles.metadataGrid, isSmallScreen && styles.smallMetadataGrid]}>
          <View style={[styles.metadataItem, isSmallScreen && styles.smallMetadataItem]}>
            <Text style={styles.infoLabel}>Order Identifier</Text>
            <Text selectable style={styles.metadataValue}>{order.orderNumber || order.id}</Text>
          </View>

          {order.source === "TIKTOK" ? (
            <View style={[styles.metadataItem, isSmallScreen && styles.smallMetadataItem]}>
              <Text style={styles.infoLabel}>TikTok Order ID</Text>
              <Text selectable style={styles.metadataValue}>{order.tiktokOrderId || "-"}</Text>
            </View>
          ) : null}

          <View style={[styles.metadataItem, isSmallScreen && styles.smallMetadataItem]}>
            <Text style={styles.infoLabel}>Order Status</Text>
            <StatusBadge label={formatStatusLabel(order.status)} tone={getOrderStatusTone(order.status)} />
          </View>

          <View style={[styles.metadataItem, isSmallScreen && styles.smallMetadataItem]}>
            <Text style={styles.infoLabel}>{order.source === "TIKTOK" && order.importedAt ? "Imported" : "Created"}</Text>
            <Text style={styles.metadataValue}>{formatOrderDate(order.source === "TIKTOK" && order.importedAt ? order.importedAt : order.createdAt)}</Text>
          </View>

          <View style={[styles.metadataItem, isSmallScreen && styles.smallMetadataItem]}>
            <Text style={styles.infoLabel}>Customer</Text>
            <Text style={styles.metadataValue}>{order.customerName || "No customer name"}</Text>
          </View>

          <View style={[styles.metadataItem, isSmallScreen && styles.smallMetadataItem]}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.metadataValue}>{order.platform}</Text>
          </View>
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
            placeholderTextColor={UI.colors.inkSubtle}
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
                      isSmallScreen && styles.compactProductOption,
                      useWebProductRows && styles.webProductOption,
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
                      <Text
                        style={[
                          styles.productName,
                          isSmallScreen && styles.compactProductName,
                        ]}
                      >
                        {product.name}
                      </Text>
                      <Text
                        style={[
                          styles.productMeta,
                          isSmallScreen && styles.compactProductMeta,
                        ]}
                      >
                        SKU: {product.sku}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.productFacts,
                        isSmallScreen && styles.compactProductFacts,
                        useWebProductRows && styles.webProductFacts,
                      ]}
                    >
                      <Text style={[styles.productMeta, isSmallScreen && styles.compactProductMeta]}>
                        Stock: {product.stock}
                      </Text>
                      <Text style={[styles.productMeta, isSmallScreen && styles.compactProductMeta]}>
                        RM {product.sellPrice.toFixed(2)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.productActionText,
                        !useWebProductRows && styles.stackedProductActionText,
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

          <View style={styles.discountSection}>
            <Text style={styles.selectedItemsTitle}>Discount</Text>
            <View style={styles.discountOptions}>
              {DISCOUNT_OPTIONS.map((option) => (
                <Pressable
                  key={option.type}
                  style={[
                    styles.discountOption,
                    discountType === option.type &&
                      styles.discountOptionActive,
                  ]}
                  onPress={() => {
                    setDiscountType(option.type);
                    setDiscountValue("0");
                    setCompletionError("");
                  }}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: discountType === option.type,
                  }}
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
                  {discountType === "FIXED"
                    ? "Discount amount (RM)"
                    : "Discount percentage (%)"}
                </Text>
                <TextInput
                  style={styles.searchInput}
                  value={discountValue}
                  onChangeText={(value) => {
                    setDiscountValue(value);
                    setCompletionError("");
                  }}
                  placeholder={
                    discountType === "FIXED" ? "Example: 10.00" : "Example: 10"
                  }
                  placeholderTextColor={UI.colors.inkSubtle}
                  keyboardType="decimal-pad"
                  accessibilityLabel={
                    discountType === "FIXED"
                      ? "Fixed discount amount in Ringgit"
                      : "Discount percentage"
                  }
                />
              </>
            ) : null}
            <FieldError message={discountPreview.error} />
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
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>
                RM {discountPreview.subtotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={styles.summaryValue}>
                RM {discountPreview.discountAmount.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.estimatedTotalRow]}>
              <Text style={styles.estimatedTotalLabel}>Final total</Text>
              <Text style={styles.estimatedTotalValue}>
                RM {discountPreview.finalTotal.toFixed(2)}
              </Text>
            </View>
          </View>

          <View
            ref={completionActionRef}
            style={styles.completionActionArea}
          >
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
                <Text style={styles.infoLabel}>Gross Line Revenue</Text>
                <Text style={styles.infoValue}>
                  RM {item.lineTotal.toFixed(2)}
                </Text>
              </View>

              {item.allocatedDiscount !== null ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Allocated Discount</Text>
                    <Text style={styles.infoValue}>
                      RM {item.allocatedDiscount.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Net Line Revenue</Text>
                    <Text style={styles.infoValue}>
                      RM {(item.lineTotal - item.allocatedDiscount).toFixed(2)}
                    </Text>
                  </View>
                </>
              ) : null}

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
          <Text style={styles.infoLabel}>
            {order.discountType === "PERCENTAGE"
              ? `Discount (${order.discountValue}%)`
              : "Discount"}
          </Text>
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
          {canCancel ? (
            <Pressable
              style={[styles.dangerButton, updating && styles.disabledButton]}
              onPress={() => handleStatusUpdate("CANCELLED")}
              disabled={updating}
              accessibilityRole="button"
              accessibilityState={{ disabled: updating, busy: updating }}
            >
              <Text style={styles.dangerButtonText}>Cancel Order</Text>
            </Pressable>
          ) : null}

          {canRefund ? (
            <Pressable
              style={[styles.warningButton, updating && styles.disabledButton]}
              onPress={() => handleStatusUpdate("REFUNDED")}
              disabled={updating}
              accessibilityRole="button"
              accessibilityState={{ disabled: updating, busy: updating }}
            >
              <Text style={styles.warningButtonText}>Refund Order</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </ScrollView>
    <FloatingBackToTop
      visible={showBackToTop && !completionActionObscuresFloating}
      onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1, backgroundColor: UI.colors.canvas },
  container: {
    width: "100%",
    maxWidth: UI.layout.formMaxWidth,
    alignSelf: "center",
    padding: UI.layout.screenPadding,
    paddingBottom: 104,
    backgroundColor: UI.colors.canvas,
    flexGrow: 1,
  },
  smallScreenContainer: {
    padding: UI.layout.screenPaddingNarrow,
    paddingBottom: 104,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: UI.colors.inkMuted,
  },
  title: {
    ...sharedStyles.pageTitle,
    flexShrink: 1,
  },
  subtitle: {
    ...sharedStyles.pageSubtitle,
  },
  card: {
    ...sharedStyles.card,
    marginBottom: 14,
  },
  formError: {
    backgroundColor: UI.colors.dangerSoft,
    borderWidth: 1,
    borderColor: UI.colors.danger,
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
    ...sharedStyles.sectionTitle,
  },
  sectionDescription: {
    color: UI.colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: -6,
    marginBottom: 14,
  },
  metadataGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  smallMetadataGrid: { gap: 6 },
  metadataItem: {
    flexGrow: 1,
    flexBasis: "47%",
    minWidth: 240,
    minHeight: 60,
    justifyContent: "flex-start",
    gap: 3,
    padding: 10,
    borderRadius: UI.radius.small,
    backgroundColor: UI.colors.surfaceMuted,
  },
  smallMetadataItem: {
    flexBasis: "47%",
    minWidth: 0,
    minHeight: 56,
    padding: 8,
  },
  metadataValue: { color: UI.colors.ink, fontSize: 13, fontWeight: "800", flexShrink: 1 },
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
    color: UI.colors.inkMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  infoValue: {
    color: UI.colors.ink,
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
    fontSize: UI.type.caption,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: UI.radius.pill,
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
    color: UI.colors.onDark,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyText: {
    backgroundColor: UI.colors.surfaceMuted,
    borderRadius: UI.radius.small,
    padding: 14,
    color: UI.colors.inkMuted,
    textAlign: "center",
    marginBottom: 14,
  },
  productList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  productOption: {
    width: "48%",
    backgroundColor: UI.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: UI.colors.borderStrong,
    borderRadius: UI.radius.small,
    padding: 12,
    minHeight: 64,
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 12,
  },
  compactProductOption: { minHeight: 0, padding: 7, gap: 4 },
  webProductOption: { flexDirection: "row", alignItems: "center" },
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
    color: UI.colors.ink,
    marginBottom: 4,
  },
  compactProductName: { marginBottom: 0 },
  productMeta: {
    fontSize: 12,
    color: UI.colors.inkMuted,
    lineHeight: 18,
  },
  compactProductMeta: { lineHeight: 15 },
  productFacts: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  compactProductFacts: { gap: 6 },
  webProductFacts: { minWidth: 92, flexDirection: "column", gap: 3 },
  productActionText: {
    color: UI.colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  stackedProductActionText: { alignSelf: "flex-start" },
  disabledProductActionText: {
    color: UI.colors.inkMuted,
  },
  label: {
    ...sharedStyles.label,
  },
  searchInput: {
    ...sharedStyles.input,
    ...sharedStyles.inputWeb,
  },
  selectedItemsSection: {
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
    marginTop: 18,
    paddingTop: 16,
  },
  discountSection: {
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
    marginTop: 18,
    paddingTop: 16,
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
    borderRadius: UI.radius.pill,
    borderWidth: 1,
    borderColor: UI.colors.border,
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
  discountOptionTextActive: { color: "#fff" },
  selectedItemsTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  selectedItemCard: {
    backgroundColor: UI.colors.surfaceMuted,
    borderRadius: UI.radius.small,
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
    color: UI.colors.inkMuted,
    marginBottom: 4,
  },
  removeButton: {
    backgroundColor: UI.colors.dangerSoft,
    borderRadius: UI.radius.xsmall,
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  removeButtonText: {
    color: UI.colors.danger,
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
    color: UI.colors.ink,
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
    backgroundColor: UI.colors.primary,
    borderRadius: UI.radius.small,
    minHeight: 48,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  completeButtonText: {
    color: UI.colors.onDark,
    fontWeight: "900",
    fontSize: 15,
  },
  submittingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemCard: {
    backgroundColor: UI.colors.surfaceMuted,
    borderRadius: UI.radius.small,
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
    color: UI.colors.inkMuted,
    marginBottom: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
  },
  totalLabel: {
    color: UI.colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  totalValue: {
    color: UI.colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  profitValue: {
    color: UI.colors.success,
    fontSize: 15,
    fontWeight: "900",
  },
  actionRow: {
    gap: 10,
  },
  actionButton: {
    backgroundColor: UI.colors.ink,
    borderRadius: UI.radius.small,
    minHeight: 44,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: UI.colors.onDark,
    fontWeight: "900",
  },
  dangerButton: {
    backgroundColor: UI.colors.dangerSoft,
    borderRadius: UI.radius.small,
    minHeight: 44,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: UI.colors.danger,
    fontWeight: "900",
  },
  warningButton: {
    backgroundColor: UI.colors.warningSoft,
    borderRadius: UI.radius.small,
    minHeight: 44,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  warningButtonText: {
    color: UI.colors.warning,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.45,
  },
});
