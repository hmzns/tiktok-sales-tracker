import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

const formatRM = (value: number) => {
  return `RM ${value.toFixed(2)}`;
};

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      if (showLowStockOnly) {
        const lowStockProducts = await getLowStockProducts(5);
        setProducts(lowStockProducts);
        return;
      }

      const result = await getProducts(1, 20, search);
      setProducts(result.products);
    } catch (error) {
      setError("Failed to load products");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload after add/edit screens close so the list reflects saved changes.
  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  useEffect(() => {
    loadProducts();
  }, [showLowStockOnly]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  if (loading) {
    return (
      <LoadingState
        title="Almost there..."
        message="Sabar is separuh daripada iman."
      />
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorState
          title="Failed to load products"
          message="Please check your connection or backend API, then try again."
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
    } catch (error) {
      Alert.alert("Export failed", "Unable to export products.");
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.pageHeader}>
        <View style={styles.flexItem}>
          <Text style={styles.eyebrow}>INVENTORY</Text>
          <Text style={styles.title}>Products</Text>
          <Text style={styles.subtitle}>Manage pricing, stock, and availability</Text>
        </View>
        <Pressable style={styles.addIconButton} onPress={() => router.push("/add-product")}>
          <Text style={styles.addIconButtonText}>+</Text>
        </Pressable>
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
            onSubmitEditing={loadProducts}
            returnKeyType="search"
          />
          <Pressable style={styles.searchButton} onPress={loadProducts}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>
        <View style={styles.toolFooter}>
          <Pressable
            style={[styles.lowStockButton, showLowStockOnly && styles.activeLowStockButton]}
            onPress={() => setShowLowStockOnly((current) => !current)}
          >
            <Text style={[styles.lowStockButtonText, showLowStockOnly && styles.activeLowStockButtonText]}>
              {showLowStockOnly ? "Low stock only" : "All stock"}
            </Text>
          </Pressable>
          <Text style={styles.resultText}>{products.length} products</Text>
        </View>
        <View style={styles.linkRow}>
          <Pressable onPress={() => router.push("/product-categories" as any)}>
            <Text style={styles.secondaryButtonText}>Manage categories</Text>
          </Pressable>
          <Pressable onPress={handleExportProductsCsv}>
            <Text style={styles.exportButtonText}>Export CSV ↗</Text>
          </Pressable>
        </View>
      </View>

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          message="Add your first product to start tracking stock and sales."
        />
      ) : (
        products.map((product) => {
          // Keep the badge threshold aligned with the low-stock API filter.
          const isLowStock = product.stock <= 5;

          return (
            <View key={product.id} style={styles.card}>
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
                <Text
                  style={
                    product.isActive ? styles.activeStatus : styles.inactiveStatus
                  }
                >
                  {product.isActive ? "Active" : "Inactive"}
                </Text>
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
              >
                <Text style={styles.editButtonText}>Edit product</Text>
                <Text style={styles.editArrow}>→</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: UI.colors.canvas,
  },
  content: {
    width: "100%",
    maxWidth: 760,
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
  pageHeader: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 22 },
  eyebrow: { color: UI.colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 5 },
  addIconButton: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: UI.colors.primary, ...UI.shadow },
  addIconButtonText: { color: "#fff", fontSize: 28, lineHeight: 30 },
  toolsCard: { backgroundColor: UI.colors.surface, borderRadius: UI.radius.large, padding: 14, borderWidth: 1, borderColor: UI.colors.border, marginBottom: 16, ...UI.shadow },
  searchRow: { minHeight: 50, flexDirection: "row", alignItems: "center", backgroundColor: UI.colors.surfaceMuted, borderWidth: 1, borderColor: UI.colors.border, borderRadius: UI.radius.medium, paddingLeft: 14 },
  searchGlyph: { color: UI.colors.inkMuted, fontSize: 22, marginRight: 8 },
  toolFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: UI.colors.border, paddingTop: 12, marginTop: 12, paddingHorizontal: 2 },
  resultText: { color: UI.colors.inkMuted, fontSize: 12 },
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
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#eee",
  },
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
  activeStatus: {
    fontSize: 14,
    fontWeight: "700",
    color: UI.colors.success,
  },
  inactiveStatus: {
    fontSize: 14,
    fontWeight: "700",
    color: UI.colors.danger,
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
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: UI.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
  },
  editButtonText: {
    color: UI.colors.ink,
    fontWeight: "700",
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
