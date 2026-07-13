import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { router, useFocusEffect } from "expo-router";

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
      if (showLowStockOnly) {
        const lowStockProducts = await getLowStockProducts(5);
        setProducts(lowStockProducts);
        return;
      }

      const result = await getProducts(1, 20, search);
      setProducts(result.products);
    } catch (err) {
      setError("Failed to load products");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.smallText}>
          Make sure your backend is running and API URL is correct.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Products</Text>
      <Text style={styles.subtitle}>Total products: {total}</Text>

      <Pressable
        style={styles.addButton}
        onPress={() => router.push("/add-product")}
      >
        <Text style={styles.addButtonText}>Add Product</Text>
      </Pressable>

      <TextInput
        style={styles.searchInput}
        placeholder="Search by product name or SKU..."
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={loadProducts}
      />

      <Pressable style={styles.searchButton} onPress={loadProducts}>
        <Text style={styles.searchButtonText}>Search</Text>
      </Pressable>

      <Pressable
        style={[
          styles.lowStockButton,
          showLowStockOnly && styles.activeLowStockButton,
        ]}
        onPress={() => {
          setShowLowStockOnly((current) => !current);
        }}
      >
        <Text
          style={[
            styles.lowStockButtonText,
            showLowStockOnly && styles.activeLowStockButtonText,
          ]}
        >
          {showLowStockOnly ? "Showing Low Stock" : "Show Low Stock Only"}
        </Text>
      </Pressable>

      {products.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No products found.</Text>
        </View>
      ) : (
        products.map((product) => {
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
                <Text style={styles.editButtonText}>Edit Product</Text>
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
    backgroundColor: "#f7f7f7",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee",
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
    fontSize: 18,
    fontWeight: "800",
  },
  sku: {
    marginTop: 4,
    fontSize: 13,
    color: "#666",
  },
  stockBadge: {
    minWidth: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  lowStockBadge: {
    backgroundColor: "#ffe5e5",
  },
  normalStockBadge: {
    backgroundColor: "#e8f5e9",
  },
  stockBadgeText: {
    fontSize: 16,
    fontWeight: "800",
  },
  lowStockText: {
    color: "red",
  },
  normalStockText: {
    color: "green",
  },
  infoRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    fontSize: 14,
    color: "#666",
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
    color: "green",
  },
  inactiveStatus: {
    fontSize: 14,
    fontWeight: "700",
    color: "red",
  },
  warningText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "red",
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
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  searchButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  editButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
  },
  editButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  lowStockButton: {
    backgroundColor: "#fff4d6",
    borderWidth: 1,
    borderColor: "#e0b84d",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  activeLowStockButton: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  lowStockButtonText: {
    color: "#8a5a00",
    fontWeight: "800",
  },
  activeLowStockButtonText: {
    color: "#fff",
  },
});