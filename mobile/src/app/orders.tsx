import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getOrders, Order } from "../api/orders";
import { router } from "expo-router";

const formatRM = (value: number) => {
  return `RM ${value.toFixed(2)}`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);

  return date.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getStatusStyle = (status: string) => {
  if (status === "PAID" || status === "DELIVERED") {
    return styles.goodStatus;
  }

  if (status === "CANCELLED" || status === "REFUNDED") {
    return styles.badStatus;
  }

  return styles.neutralStatus;
};

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setError(null);

      const result = await getOrders(1, 20);

      setOrders(result.orders);
      setTotal(result.meta.total);
    } catch (err) {
      setError("Failed to load orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading orders...</Text>
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
      <Text style={styles.title}>Orders</Text>
      <Text style={styles.subtitle}>Total orders: {total}</Text>

      <Pressable
        style={styles.addButton}
        onPress={() => router.push("/add-order" as any)}
      >
        <Text style={styles.addButtonText}>Create Order</Text>
      </Pressable>

      {orders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No orders found.</Text>
        </View>
      ) : (
        orders.map((order) => (
          <View key={order.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.flexItem}>
                <Text style={styles.orderNumber}>
                  {order.orderNumber ?? order.id}
                </Text>
                <Text style={styles.customerName}>
                  {order.customerName ?? "No customer name"}
                </Text>
              </View>

              <Text style={[styles.statusBadge, getStatusStyle(order.status)]}>
                {order.status}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{formatDate(order.createdAt)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Platform</Text>
              <Text style={styles.value}>{order.platform}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Total</Text>
              <Text style={styles.value}>{formatRM(order.total)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Profit</Text>
              <Text
                style={order.profit >= 0 ? styles.profitText : styles.lossText}
              >
                {formatRM(order.profit)}
              </Text>
            </View>

            <View style={styles.itemsBox}>
              <Text style={styles.itemsTitle}>Items</Text>

              {order.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.flexItem}>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    <Text style={styles.itemSku}>SKU: {item.product.sku}</Text>
                  </View>

                  <Text style={styles.itemQty}>x{item.quantity}</Text>
                </View>
              ))}
            </View>
          </View>
        ))
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
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  flexItem: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: "800",
  },
  customerName: {
    marginTop: 4,
    fontSize: 13,
    color: "#666",
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  goodStatus: {
    backgroundColor: "#e8f5e9",
    color: "green",
  },
  badStatus: {
    backgroundColor: "#ffe5e5",
    color: "red",
  },
  neutralStatus: {
    backgroundColor: "#eee",
    color: "#333",
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
  profitText: {
    fontSize: 14,
    fontWeight: "800",
    color: "green",
  },
  lossText: {
    fontSize: 14,
    fontWeight: "800",
    color: "red",
  },
  itemsBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  itemsTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemSku: {
    marginTop: 3,
    fontSize: 12,
    color: "#666",
  },
  itemQty: {
    fontSize: 14,
    fontWeight: "800",
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
});