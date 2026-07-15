import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import {
  getOrderById,
  Order,
  OrderStatus,
  updateOrderStatus,
} from "../api/orders";

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadOrder = async () => {
    if (!orderId) return;

    try {
      setLoading(true);

      const result = await getOrderById(orderId);
      setOrder(result);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to load order";

      Alert.alert("Error", message);
    } finally {
      setLoading(false);
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

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [orderId])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading order...</Text>
      </View>
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
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Items</Text>

        {order.items.map((item) => (
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
        ))}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
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