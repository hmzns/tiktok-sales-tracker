import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getOrders,
  Order,
  OrderStatus,
  updateOrderStatus,
} from "../../api/orders";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { router, useFocusEffect } from "expo-router";
import { UI } from "../../constants/ui";

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

const STATUS_FILTERS: (OrderStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "PAID",
  "PACKING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setError(null);

      const result = await getOrders(1, 20, search, statusFilter);

      setOrders(result.orders);
      setTotal(result.meta.total);
    } catch (err) {
      setError("Failed to load orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [search, statusFilter])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, status);
      await loadOrders();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Failed to update order status";

      Alert.alert("Error", message);
    }
  };

  if (loading) {
    return (
      <LoadingState
        title="Let's see your hustle..."
        message="Mind you, everything is from Him."
      />
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorState
          title="Failed to load orders"
          message="Please check your connection or backend API, then try again."
          onRetry={loadOrders}
        />
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
      <View style={styles.pageHeader}>
        <View style={styles.flexItem}>
          <Text style={styles.eyebrow}>SALES</Text>
          <Text style={styles.title}>Orders</Text>
          <Text style={styles.subtitle}>Manage fulfilment and customer sales</Text>
        </View>
        <Pressable
          style={styles.addIconButton}
          onPress={() => router.push("/add-order" as any)}
        >
          <Text style={styles.addIconButtonText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Order records</Text>
        <Text style={styles.summaryValue}>{total}</Text>
      </View>

      <View style={styles.toolsCard}>
        <View style={styles.searchRow}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Customer or order number"
            placeholderTextColor={UI.colors.inkSubtle}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={loadOrders}
            returnKeyType="search"
          />
          <Pressable style={styles.searchButton} onPress={loadOrders}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>

        <Text style={styles.filterLabel}>FILTER BY STATUS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {STATUS_FILTERS.map((status) => (
          <Pressable
            key={status}
            style={[
              styles.filterChip,
              statusFilter === status && styles.activeFilterChip,
            ]}
            onPress={() => {
              setStatusFilter(status);
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === status && styles.activeFilterChipText,
              ]}
            >
              {status === "ALL" ? "All" : status.toLowerCase()}
            </Text>
          </Pressable>
        ))}
        </ScrollView>
        <Text style={styles.resultText}>Showing {orders.length} of {total}</Text>
      </View>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="Create your first order to start tracking revenue and stock movement."
        />
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

            <Pressable
              style={styles.detailsButton}
              onPress={() =>
                router.push({
                  pathname: "/order-detail" as any,
                  params: { orderId: order.id },
                })
              }
            >
              <Text style={styles.detailsButtonText}>View order</Text>
              <Text style={styles.detailsArrow}>→</Text>
            </Pressable>
          </View>
        ))
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
  summaryCard: { minHeight: 104, borderRadius: UI.radius.large, padding: 20, marginBottom: 16, backgroundColor: UI.colors.ink, ...UI.shadow },
  summaryLabel: { color: "#D0D5DD", fontSize: 13, marginBottom: 7 },
  summaryValue: { color: "#fff", fontSize: 30, fontWeight: "800" },
  toolsCard: { backgroundColor: UI.colors.surface, borderRadius: UI.radius.large, padding: 14, borderWidth: 1, borderColor: UI.colors.border, marginBottom: 16, ...UI.shadow },
  searchRow: { minHeight: 50, flexDirection: "row", alignItems: "center", backgroundColor: UI.colors.surfaceMuted, borderWidth: 1, borderColor: UI.colors.border, borderRadius: UI.radius.medium, paddingLeft: 14 },
  searchGlyph: { color: UI.colors.inkMuted, fontSize: 22, marginRight: 8 },
  filterLabel: { color: UI.colors.inkMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: 16, marginBottom: 9 },
  resultText: { color: UI.colors.inkMuted, fontSize: 12, borderTopWidth: 1, borderTopColor: UI.colors.border, paddingTop: 12, marginTop: 12 },
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
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: UI.colors.border,
    ...UI.shadow,
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
    color: UI.colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  customerName: {
    marginTop: 4,
    fontSize: 13,
    color: UI.colors.inkMuted,
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
    backgroundColor: UI.colors.successSoft,
    color: UI.colors.success,
  },
  badStatus: {
    backgroundColor: UI.colors.dangerSoft,
    color: UI.colors.danger,
  },
  neutralStatus: {
    backgroundColor: UI.colors.warningSoft,
    color: UI.colors.warning,
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
  profitText: {
    fontSize: 14,
    fontWeight: "800",
    color: UI.colors.success,
  },
  lossText: {
    fontSize: 14,
    fontWeight: "800",
    color: UI.colors.danger,
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
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  smallButton: {
    backgroundColor: "#111",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  smallButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  dangerButton: {
    backgroundColor: "#ffe5e5",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  dangerButtonText: {
    color: "red",
    fontSize: 12,
    fontWeight: "800",
  },
  warningButton: {
    backgroundColor: "#fff4d6",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  warningButtonText: {
    color: "#8a5a00",
    fontSize: 12,
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
  filterScroll: {
    marginBottom: 10,
  },
  filterChip: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  activeFilterChip: {
    backgroundColor: UI.colors.primarySoft,
    borderColor: "#F9A8B8",
  },
  filterChipText: {
    color: UI.colors.inkMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  activeFilterChipText: {
    color: UI.colors.primary,
  },
  detailsButton: {
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
  detailsButtonText: {
    color: UI.colors.ink,
    fontWeight: "700",
  },
  detailsArrow: { color: UI.colors.primary, fontSize: 17, fontWeight: "700" },
});
