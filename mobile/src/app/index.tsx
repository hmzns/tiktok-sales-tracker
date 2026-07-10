import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getDashboardSummary } from "../api/dashboard";

type DashboardData = {
  revenue: number;
  salesProfit: number;
  totalExpenses: number;
  netProfit: number;
  orderCount: number;
  itemsSold: number;
  averageOrderValue: number;
  lowStockProducts: {
    id: string;
    name: string;
    sku: string;
    stock: number;
  }[];
  recentStockMovements: {
    id: string;
    type: string;
    quantity: number;
    stockBefore: number;
    stockAfter: number;
    product: {
      name: string;
      sku: string;
    };
  }[];
};

const formatRM = (value: number) => {
  return `RM ${value.toFixed(2)}`;
};

export default function HomeScreen() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setError(null);
      const data = await getDashboardSummary(currentYear, currentMonth);
      setDashboard(data);
    } catch (err) {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error || !dashboard) {
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
      <Text style={styles.title}>TikTok Sales Tracker</Text>
      <Text style={styles.subtitle}>
        Dashboard for {currentMonth}/{currentYear}
      </Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Revenue</Text>
          <Text style={styles.cardValue}>{formatRM(dashboard.revenue)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sales Profit</Text>
          <Text style={styles.cardValue}>
            {formatRM(dashboard.salesProfit)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Expenses</Text>
          <Text style={styles.cardValue}>
            {formatRM(dashboard.totalExpenses)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Net Profit</Text>
          <Text style={styles.cardValue}>{formatRM(dashboard.netProfit)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Orders</Text>
          <Text style={styles.cardValue}>{dashboard.orderCount}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Items Sold</Text>
          <Text style={styles.cardValue}>{dashboard.itemsSold}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Average Order Value</Text>
        <Text style={styles.sectionValue}>
          {formatRM(dashboard.averageOrderValue)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Low Stock Products</Text>

        {dashboard.lowStockProducts.length === 0 ? (
          <Text style={styles.emptyText}>No low stock products.</Text>
        ) : (
          dashboard.lowStockProducts.map((product) => (
            <View key={product.id} style={styles.listItem}>
              <View>
                <Text style={styles.itemTitle}>{product.name}</Text>
                <Text style={styles.itemSubtitle}>SKU: {product.sku}</Text>
              </View>
              <Text style={styles.stockText}>Stock: {product.stock}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Stock Activity</Text>

        {dashboard.recentStockMovements.length === 0 ? (
          <Text style={styles.emptyText}>No recent stock movements.</Text>
        ) : (
          dashboard.recentStockMovements.map((movement) => (
            <View key={movement.id} style={styles.listItem}>
              <View style={styles.flexItem}>
                <Text style={styles.itemTitle}>
                  {movement.product?.name ?? "Unknown Product"}
                </Text>
                <Text style={styles.itemSubtitle}>
                  {movement.type} | {movement.stockBefore} →{" "}
                  {movement.stockAfter}
                </Text>
              </View>
              <Text
                style={
                  movement.quantity >= 0
                    ? styles.positiveQty
                    : styles.negativeQty
                }
              >
                {movement.quantity >= 0 ? "+" : ""}
                {movement.quantity}
              </Text>
            </View>
          ))
        )}
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
  grid: {
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  sectionValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  emptyText: {
    fontSize: 14,
    color: "#777",
  },
  listItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  flexItem: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  itemSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: "#666",
  },
  stockText: {
    fontSize: 14,
    fontWeight: "700",
  },
  positiveQty: {
    fontSize: 16,
    fontWeight: "800",
    color: "green",
  },
  negativeQty: {
    fontSize: 16,
    fontWeight: "800",
    color: "red",
  },
});