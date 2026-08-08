import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  getLowStockProducts,
  getProducts,
  Product,
} from "../../api/products";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { apiClient } from "../../api/client";
import { router, useFocusEffect } from "expo-router";
import { UI } from "../../constants/ui";
import { FloatingBackToTop } from "../../components/FloatingBackToTop";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { SafeAreaView } from "react-native-safe-area-context";

const formatRM = (value: number) => {
  return Number.isFinite(value) ? `RM ${value.toFixed(2)}` : "—";
};

export default function ProductsScreen() {
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 600;
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (showLowStockOnly) {
        const lowStockProducts = await getLowStockProducts(5);
        setProducts(lowStockProducts);
        return;
      }

      const [result, allProducts] = await Promise.all([
        getProducts(1, 20, submittedSearch),
        getProducts(1, 1),
      ]);
      setProducts(result.products);
      setTotal(allProducts.meta.total);
    } catch {
      setError("Failed to load products");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showLowStockOnly, submittedSearch]);

  // Reload after add/edit screens close so the list reflects saved changes.
  useFocusEffect(
    useCallback(() => {
      void loadProducts();
    }, [loadProducts])
  );

  const handleSearch = () => {
    if (search === submittedSearch) {
      void loadProducts();
      return;
    }

    setSubmittedSearch(search);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  if (loading) {
    return (
      <LoadingState
        title="Loading products"
        message="Getting current pricing, availability, and stock levels."
      />
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorState
          title="Failed to load products"
          message="Please check your connection and try again."
          onRetry={loadProducts}
        />
      </View>
    );
  }

  const escapeCsvValue = (value: unknown) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const buildCsv = (rows: unknown[][]) => {
    return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  };

  const handleExportProductsCsv = async () => {
    if (Platform.OS !== "web") {
      Alert.alert(
        "Export not available",
        "Products CSV export is currently available on the web version only."
      );
      return;
    }

    try {
      const response = await apiClient.get("/products", {
        params: {
          page: 1,
          limit: 1000,
        },
      });

      const products = response.data.data ?? [];

      if (products.length === 0) {
        Alert.alert("No products", "There are no products to export.");
        return;
      }

      const rows: unknown[][] = [
        ["TikTok Sales Tracker Products Export"],
        ["Export Date", new Date().toLocaleString()],
        [],
        [
          "Name",
          "SKU",
          "Category",
          "Cost Price",
          "Sell Price",
          "Stock",
          "Status",
        ],
        ...products.map((product: any) => [
          product.name,
          product.sku,
          product.category?.name ?? "-",
          product.costPrice,
          product.sellPrice,
          product.stock,
          product.isActive ? "Active" : "Inactive",
        ]),
      ];

      const csv = buildCsv(rows);
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch {
      Alert.alert("Export failed", "Unable to export products.");
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.screenShell}>
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      onScroll={(event) =>
        setShowBackToTop(event.nativeEvent.contentOffset.y > 240)
      }
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View
        style={[
          styles.pageHeader,
          isCompactLayout && styles.compactPageHeader,
        ]}
      >
        <View style={[styles.headerCopy, isCompactLayout && styles.compactHeaderCopy]}>
          <Text accessibilityRole="header" style={styles.title}>Products</Text>
          <Text style={styles.subtitle}>Manage pricing, stock, and availability</Text>
        </View>
        <View style={[styles.headerActions, isCompactLayout && styles.compactHeaderActions]}>
          <Pressable accessibilityRole="button" style={[styles.headerExportButton, isCompactLayout && styles.compactHeaderAction]} onPress={handleExportProductsCsv}>
            <Text style={styles.headerExportButtonText}>Export</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={[styles.headerAddButton, isCompactLayout && styles.compactHeaderAction]} onPress={() => router.push("/add-product")}>
            <Text style={styles.headerAddButtonText}>+ Add product</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        style={styles.manageCategoriesButton}
        onPress={() => router.push("/product-categories" as any)}
        accessibilityRole="button"
      >
        <Text style={styles.manageCategoriesButtonText}>Manage categories</Text>
      </Pressable>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total products</Text>
        <Text style={styles.summaryValue}>{total}</Text>
      </View>

      <View style={styles.toolsCard}>
        <View style={styles.searchRow}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Product name or SKU"
            placeholderTextColor={UI.colors.inkSubtle}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            accessibilityLabel="Search products by name or SKU"
          />
          <Pressable accessibilityRole="button" style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>
        <View style={styles.toolFooter}>
          <Pressable
            style={[styles.lowStockButton, showLowStockOnly && styles.activeLowStockButton]}
            onPress={() => setShowLowStockOnly((current) => !current)}
            accessibilityRole="button"
            accessibilityState={{ selected: showLowStockOnly }}
          >
            <Text style={[styles.lowStockButtonText, showLowStockOnly && styles.activeLowStockButtonText]}>
              {showLowStockOnly ? "Show all products" : "Show low stock"}
            </Text>
          </Pressable>
          <Text style={styles.resultText}>
            {showLowStockOnly
              ? `${products.length} products have 5 units or fewer`
              : `Showing ${products.length} of ${total} products`}
          </Text>
        </View>
      </View>

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          message="Add your first product to start tracking stock and sales."
          actionLabel="Add product"
          onAction={() => router.push("/add-product")}
        />
      ) : (
        products.map((product) => {
          // Keep the badge threshold aligned with the low-stock API filter.
          const isLowStock = product.stock <= 5;

          return (
            <View key={product.id} style={[styles.card, !product.isActive && styles.inactiveCard]}>
              <View style={styles.cardHeader}>
                <View style={styles.flexItem}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.sku}>SKU: {product.sku}</Text>
                </View>

                <View
                  style={[
                    styles.stockBadge,
                    isLowStock ? styles.lowStockBadge : styles.normalStockBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.stockBadgeText,
                      isLowStock
                        ? styles.lowStockText
                        : styles.normalStockText,
                    ]}
                  >
                    {product.stock}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Category</Text>
                <Text style={styles.value}>
                  {product.category?.name ?? "No category"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Cost Price</Text>
                <Text style={styles.value}>{formatRM(product.costPrice)}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Sell Price</Text>
                <Text style={styles.value}>{formatRM(product.sellPrice)}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Status</Text>
                <StatusBadge
                  label={product.isActive ? "Active" : "Inactive"}
                  tone={product.isActive ? "success" : "neutral"}
                />
              </View>

              {isLowStock && (
                <Text style={styles.warningText}>Low stock. Restock soon.</Text>
              )}

              <Pressable
                style={styles.editButton}
                onPress={() =>
                  router.push({
                    pathname: "/edit-product" as any,
                    params: { productId: product.id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Edit ${product.name}`}
              >
                <Text style={styles.editButtonText}>Edit product</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </ScrollView>
    <FloatingBackToTop
      visible={showBackToTop}
      onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
    />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: UI.colors.canvas,
  },
  screenShell: { flex: 1, backgroundColor: UI.colors.canvas },
  content: {
    width: "100%",
    maxWidth: UI.layout.contentMaxWidth,
    alignSelf: "center",
    padding: 20,
    paddingTop: 28,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "700",
    color: "red",
    marginBottom: 8,
  },
  smallText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  title: {
    color: UI.colors.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 14,
    color: UI.colors.inkMuted,
    marginTop: 4,
  },
  pageHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 22 },
  compactPageHeader: { marginBottom: 14 },
  eyebrow: { color: UI.colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 5 },
  headerCopy: { flex: 1, minWidth: 260 },
  compactHeaderCopy: { minWidth: "100%" },
  headerActions: { flexDirection: "row", flexShrink: 0, justifyContent: "flex-end", gap: 8 },
  compactHeaderActions: { width: "100%", flexDirection: "row" },
  compactHeaderAction: { flex: 1, minWidth: 0 },
  headerExportButton: { minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: UI.colors.surface, borderWidth: 1, borderColor: UI.colors.border, borderRadius: UI.radius.small, paddingHorizontal: 13 },
  headerExportButtonText: { color: UI.colors.ink, fontSize: 12, fontWeight: "700" },
  manageCategoriesButton: { minHeight: 42, alignItems: "center", justifyContent: "center", backgroundColor: UI.colors.surface, borderWidth: 1, borderColor: UI.colors.border, borderRadius: UI.radius.small, marginBottom: 16 },
  manageCategoriesButtonText: { color: UI.colors.ink, fontSize: 12, fontWeight: "700" },
  headerAddButton: { minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: UI.colors.primary, borderRadius: UI.radius.small, paddingHorizontal: 16, ...UI.shadow },
  headerAddButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  secondaryAction: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: UI.colors.surface, borderWidth: 1, borderColor: UI.colors.border, borderRadius: UI.radius.small },
  secondaryActionText: { color: UI.colors.ink, fontSize: 12, fontWeight: "700" },
  primaryAction: { flex: 1.25, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: UI.colors.primary, borderRadius: UI.radius.small },
  primaryActionText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  summaryCard: { minHeight: 104, alignItems: "center", justifyContent: "center", borderRadius: UI.radius.large, padding: 20, marginBottom: 16, backgroundColor: UI.colors.ink, ...UI.shadow },
  summaryLabel: { color: "#D0D5DD", fontSize: 13, marginBottom: 7, textAlign: "center" },
  summaryValue: { color: "#fff", fontSize: 30, fontWeight: "800", textAlign: "center" },
  toolsCard: { backgroundColor: UI.colors.surface, borderRadius: UI.radius.large, padding: 14, borderWidth: 1, borderColor: UI.colors.border, marginBottom: 16, ...UI.shadow },
  searchRow: { minHeight: 50, flexDirection: "row", alignItems: "center", backgroundColor: UI.colors.surfaceMuted, borderWidth: 1, borderColor: UI.colors.border, borderRadius: UI.radius.medium, paddingLeft: 14 },
  searchGlyph: { color: UI.colors.inkMuted, fontSize: 22, marginRight: 8 },
  toolFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  resultText: { flex: 1, color: UI.colors.inkMuted, fontSize: 12, textAlign: "right" },
  emptyBox: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    padding: 18,
    borderWidth: 1,
    borderColor: UI.colors.border,
    ...UI.shadow,
  },
  emptyText: {
    fontSize: 14,
    color: "#777",
  },
  card: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: UI.colors.border,
    ...UI.shadowSubtle,
  },
  inactiveCard: { opacity: 0.72, backgroundColor: UI.colors.surfaceMuted },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  flexItem: {
    flex: 1,
  },
  productName: {
    color: UI.colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  sku: {
    marginTop: 4,
    fontSize: 13,
    color: UI.colors.inkMuted,
  },
  stockBadge: {
    minWidth: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  lowStockBadge: {
    backgroundColor: UI.colors.dangerSoft,
  },
  normalStockBadge: {
    backgroundColor: UI.colors.successSoft,
  },
  stockBadgeText: {
    fontSize: 16,
    fontWeight: "800",
  },
  lowStockText: {
    color: UI.colors.danger,
  },
  normalStockText: {
    color: UI.colors.success,
  },
  infoRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    fontSize: 14,
    color: UI.colors.inkMuted,
  },
  value: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
  },
  warningText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "700",
    color: UI.colors.danger,
  },
  addButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  searchInput: {
    flex: 1,
    color: UI.colors.ink,
    fontSize: 14,
    paddingVertical: 12,
    outlineStyle: "none",
  } as any,
  searchButton: {
    alignSelf: "stretch",
    justifyContent: "center",
    backgroundColor: UI.colors.ink,
    borderRadius: 11,
    paddingHorizontal: 16,
    margin: 4,
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  editButton: {
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
    backgroundColor: UI.colors.ink,
    borderWidth: 1,
    borderColor: UI.colors.ink,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
  },
  editArrow: { color: UI.colors.primary, fontSize: 17, fontWeight: "700" },
  lowStockButton: {
    backgroundColor: UI.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  activeLowStockButton: {
    backgroundColor: UI.colors.warningSoft,
    borderColor: "#FEC84B",
  },
  lowStockButtonText: {
    color: UI.colors.inkMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  activeLowStockButtonText: {
    color: UI.colors.warning,
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: UI.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  exportButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  exportButtonText: {
    color: UI.colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
});
