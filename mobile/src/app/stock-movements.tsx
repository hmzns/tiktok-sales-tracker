import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  getStockMovements,
  StockMovement,
} from "../api/stockMovements";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);

  return date.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getMovementLabel = (type: string) => {
  if (type === "RESTOCK") return "Restock";
  if (type === "SALE") return "Sale";
  if (type === "CANCEL_RESTORE") return "Cancel Restore";
  if (type === "REFUND_RESTORE") return "Refund Restore";
  if (type === "MANUAL_IN") return "Manual In";
  if (type === "MANUAL_OUT") return "Manual Out";
  if (type === "DAMAGE") return "Damage";

  return type;
};

export default function StockMovementsScreen() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMovements = async () => {
    try {
      setError(null);

      const result = await getStockMovements(1, 20);

      setMovements(result.movements);
      setTotal(result.meta.total);
    } catch (err) {
      setError("Failed to load stock movements");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMovements();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadMovements();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading stock movements...</Text>
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
      <Text style={styles.title}>Stock Movements</Text>
      <Text style={styles.subtitle}>Total movements: {total}</Text>

      <Pressable
        style={styles.addButton}
        onPress={() => router.push("/adjust-stock" as any)}
      >
        <Text style={styles.addButtonText}>Restock / Adjust Stock</Text>
      </Pressable>

      {movements.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No stock movements yet. Restock or create an order to see activity here.</Text>
        </View>
      ) : (
        movements.map((movement) => {
          const isStockIn = movement.quantity > 0;

          return (
            <View key={movement.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.flexItem}>
                  <Text style={styles.productName}>
                    {movement.product?.name ?? "Unknown Product"}
                  </Text>
                  <Text style={styles.productSku}>
                    SKU: {movement.product?.sku ?? "-"}
                  </Text>
                </View>

                <Text
                  style={isStockIn ? styles.positiveQty : styles.negativeQty}
                >
                  {isStockIn ? "+" : ""}
                  {movement.quantity}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Type</Text>
                <Text style={styles.value}>
                  {getMovementLabel(movement.type)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Stock</Text>
                <Text style={styles.value}>
                  {movement.stockBefore} → {movement.stockAfter}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Date</Text>
                <Text style={styles.value}>
                  {formatDate(movement.createdAt)}
                </Text>
              </View>

              {movement.reference ? (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Reference</Text>
                  <Text style={styles.value}>{movement.reference}</Text>
                </View>
              ) : null}

              {movement.note ? (
                <View style={styles.noteBox}>
                  <Text style={styles.note}>{movement.note}</Text>
                </View>
              ) : null}
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
    marginBottom: 16,
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
  productName: {
    fontSize: 18,
    fontWeight: "800",
  },
  productSku: {
    marginTop: 4,
    fontSize: 13,
    color: "#666",
  },
  positiveQty: {
    fontSize: 18,
    fontWeight: "900",
    color: "green",
  },
  negativeQty: {
    fontSize: 18,
    fontWeight: "900",
    color: "red",
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
  noteBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#f7f7f7",
    borderRadius: 10,
  },
  note: {
    fontSize: 13,
    color: "#555",
  },
});