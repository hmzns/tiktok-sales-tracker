import { useCallback, useMemo, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  Alert,
  Keyboard,
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
  getAllOrders,
  getTikTokSyncHistory,
  syncTikTokOrders,
} from "../../api/orders";
import type {
  OrderStatus,
  SalesOrder,
  TikTokSyncHistory,
} from "../../api/orders";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { UI } from "../../constants/ui";
import { getDashboardSummary } from "../../api/dashboard";
import { FloatingBackToTop } from "../../components/FloatingBackToTop";
import { TikTokSyncStatusCard } from "../../components/TikTokSyncStatusCard";
import { showSuccessMessage } from "../../utils/showSuccessMessage";

const formatRM = (value: number) => {
  return `RM ${value.toFixed(2)}`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

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

type OrderListFilter = OrderStatus | "ALL" | "NEEDS_ITEMS";
type DateFilter = "ALL" | "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS";
type OrderSort =
  | "recent"
  | "newest"
  | "oldest"
  | "needs-attention"
  | "highest"
  | "lowest";

const STATUS_FILTERS: OrderListFilter[] = [
  "ALL",
  "NEEDS_ITEMS",
  "PENDING",
  "PAID",
  "PACKING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TODAY", label: "Today" },
  { key: "LAST_7_DAYS", label: "Last 7 Days" },
  { key: "LAST_30_DAYS", label: "Last 30 Days" },
];

const SORT_OPTIONS: { key: OrderSort; label: string }[] = [
  { key: "recent", label: "Default" },
  { key: "newest", label: "Newest First" },
  { key: "oldest", label: "Oldest First" },
  { key: "needs-attention", label: "Needs Attention First" },
  { key: "highest", label: "Highest Profit" },
  { key: "lowest", label: "Lowest Profit" },
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const isTikTokOrderNeedingItems = (order: SalesOrder) =>
  order.source === "TIKTOK" && order.importStatus === "NEEDS_ITEMS";

const getValidTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const getOrderCreatedTimestamp = (order: SalesOrder) =>
  getValidTimestamp(order.createdAt);

const getNeedsItemsTimestamp = (order: SalesOrder) =>
  getValidTimestamp(order.importedAt) ?? getOrderCreatedTimestamp(order);

const compareNewestFirst = (a: SalesOrder, b: SalesOrder) => {
  const aTimestamp = getOrderCreatedTimestamp(a);
  const bTimestamp = getOrderCreatedTimestamp(b);

  if (aTimestamp === null) return bTimestamp === null ? 0 : 1;
  if (bTimestamp === null) return -1;
  return bTimestamp - aTimestamp;
};

const compareOldestFirst = (a: SalesOrder, b: SalesOrder) => {
  const aTimestamp = getOrderCreatedTimestamp(a);
  const bTimestamp = getOrderCreatedTimestamp(b);

  if (aTimestamp === null) return bTimestamp === null ? 0 : 1;
  if (bTimestamp === null) return -1;
  return aTimestamp - bTimestamp;
};

const compareOldestNeedsItemsFirst = (a: SalesOrder, b: SalesOrder) => {
  const aNeedsItems = isTikTokOrderNeedingItems(a);
  const bNeedsItems = isTikTokOrderNeedingItems(b);

  if (aNeedsItems !== bNeedsItems) {
    return aNeedsItems ? -1 : 1;
  }

  if (!aNeedsItems) {
    return compareNewestFirst(a, b);
  }

  const aTimestamp = getNeedsItemsTimestamp(a);
  const bTimestamp = getNeedsItemsTimestamp(b);

  if (aTimestamp === null) return bTimestamp === null ? 0 : 1;
  if (bTimestamp === null) return -1;
  return aTimestamp - bTimestamp;
};

const getNeedsItemsAge = (order: SalesOrder, now: number) => {
  const timestamp = getNeedsItemsTimestamp(order);

  if (timestamp === null) {
    return { label: "Age unavailable", needsAttention: false };
  }

  const elapsed = Math.max(0, now - timestamp);

  if (elapsed < DAY_IN_MS) {
    return { label: "New", needsAttention: false };
  }

  const days = Math.floor(elapsed / DAY_IN_MS);

  if (days <= 2) {
    return { label: `Waiting ${days}d`, needsAttention: false };
  }

  return {
    label: `Needs Attention · ${days} days`,
    needsAttention: true,
  };
};

const isWithinDateFilter = (
  order: SalesOrder,
  dateFilter: DateFilter,
  now: Date
) => {
  if (dateFilter === "ALL") {
    return true;
  }

  const timestamp = getOrderCreatedTimestamp(order);

  if (timestamp === null) {
    return false;
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (dateFilter === "LAST_7_DAYS") {
    start.setDate(start.getDate() - 6);
  } else if (dateFilter === "LAST_30_DAYS") {
    start.setDate(start.getDate() - 29);
  }

  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);

  return timestamp >= start.getTime() && timestamp < end.getTime();
};

const orderMatchesSearch = (order: SalesOrder, normalizedSearch: string) => {
  if (!normalizedSearch) {
    return true;
  }

  const searchableValues = [
    order.id,
    order.orderNumber,
    order.tiktokOrderId,
    order.customerName,
    ...order.items.map((item) => item.product.name),
  ];

  return searchableValues.some((value) =>
    value?.toLowerCase().includes(normalizedSearch)
  );
};

const getTikTokSyncErrorMessage = (error: unknown) => {
  if (!isAxiosError(error)) {
    return "Unable to sync TikTok orders. Please try again.";
  }

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return "TikTok sync is taking longer than expected. It may still complete in the background.";
  }

  if (!error.response) {
    return "Network request failed. Check your connection and try again.";
  }

  const responseData = error.response.data;

  const backendMessage =
    responseData &&
    typeof responseData === "object" &&
    "message" in responseData &&
    typeof responseData.message === "string"
      ? responseData.message
      : "";

  if (
    /not connected|single TikTok Shop connection|metadata must be synchronized/i.test(
      backendMessage
    )
  ) {
    return "TikTok Shop is not connected. Connect your shop and try again.";
  }

  if (
    /refresh token|token service|token request|token expiry|stored TikTok token|access token/i.test(
      backendMessage
    )
  ) {
    return "TikTok Shop access token refresh failed. Reconnect your shop and try again.";
  }

  if (
    error.response.status === 502 ||
    /unable to reach TikTok Shop|rejected the order-list request|invalid order-list response/i.test(
      backendMessage
    )
  ) {
    return "TikTok Shop is temporarily unavailable. Please try again later.";
  }

  return "Unable to sync TikTok orders. Please try again.";
};

const showTikTokSyncError = (message: string) => {
  if (Platform.OS === "web") {
    window.alert(message);
    return;
  }

  Alert.alert("TikTok sync failed", message);
};

export default function OrdersScreen() {
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncHistory, setSyncHistory] = useState<TikTokSyncHistory | null>(
    null
  );
  const [syncHistoryLoading, setSyncHistoryLoading] = useState(true);
  const [syncHistoryError, setSyncHistoryError] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<OrderListFilter>(() =>
    filter === "needs-items" ? "NEEDS_ITEMS" : "ALL"
  );
  const [error, setError] = useState<string | null>(null);
  const [monthDifference, setMonthDifference] = useState<number | null>(null);
  const [orderSort, setOrderSort] = useState<OrderSort>("recent");
  const [ageReferenceTime, setAgeReferenceTime] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const syncInFlightRef = useRef(false);
  const syncHistoryHasDataRef = useRef(false);
  const syncHistoryRequestRef = useRef(0);

  const loadOrders = useCallback(async () => {
    try {
      setError(null);

      const now = new Date();
      const previousMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const previousYear =
        now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const [result, currentSummary, previousSummary] = await Promise.all([
        getAllOrders(),
        getDashboardSummary(now.getFullYear(), now.getMonth() + 1),
        getDashboardSummary(previousYear, previousMonth),
      ]);

      setOrders(result);
      setAgeReferenceTime(new Date().getTime());
      const currentCount = currentSummary.orderCount;
      const previousCount = previousSummary.orderCount;
      setMonthDifference(
        previousCount === 0
          ? currentCount === 0
            ? 0
            : 100
          : ((currentCount - previousCount) / previousCount) * 100
      );
    } catch {
      setError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSyncHistory = useCallback(async () => {
    const requestId = syncHistoryRequestRef.current + 1;
    syncHistoryRequestRef.current = requestId;

    if (!syncHistoryHasDataRef.current) {
      setSyncHistoryLoading(true);
    }
    setSyncHistoryError(false);

    try {
      const result = await getTikTokSyncHistory(10);

      if (syncHistoryRequestRef.current !== requestId) {
        return;
      }

      syncHistoryHasDataRef.current = true;
      setSyncHistory(result.data);
    } catch {
      if (syncHistoryRequestRef.current === requestId) {
        setSyncHistoryError(true);
      }
    } finally {
      if (syncHistoryRequestRef.current === requestId) {
        setSyncHistoryLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOrders();
    }, [loadOrders])
  );

  useFocusEffect(
    useCallback(() => {
      void loadSyncHistory();
    }, [loadSyncHistory])
  );

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      await Promise.all([loadOrders(), loadSyncHistory()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTikTokSync = async () => {
    if (syncInFlightRef.current) {
      return;
    }

    syncInFlightRef.current = true;
    setSyncing(true);

    try {
      const result = await syncTikTokOrders(7);

      if (!result.success || !result.data) {
        throw new Error("Unexpected TikTok sync response");
      }

      await loadOrders();

      showSuccessMessage(
        [
          "TikTok sync completed.",
          `New orders: ${result.data.created}`,
          `Existing orders: ${result.data.existing}`,
          `Failed: ${result.data.failed}`,
        ].join("\n")
      );
    } catch (error) {
      showTikTokSyncError(getTikTokSyncErrorMessage(error));
    } finally {
      void loadSyncHistory();
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  };

  const activeFilter =
    filter === "needs-items" ? "NEEDS_ITEMS" : statusFilter;
  const needsItemsCount = useMemo(
    () => orders.filter(isTikTokOrderNeedingItems).length,
    [orders]
  );
  const displayedOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const now = new Date();
    const matchingOrders = orders.filter((order) => {
      if (!orderMatchesSearch(order, normalizedSearch)) {
        return false;
      }

      if (!isWithinDateFilter(order, dateFilter, now)) {
        return false;
      }

      if (activeFilter === "NEEDS_ITEMS") {
        return isTikTokOrderNeedingItems(order);
      }

      return activeFilter === "ALL" || order.status === activeFilter;
    });

    return matchingOrders.sort((a, b) => {
      if (orderSort === "highest") return b.profit - a.profit;
      if (orderSort === "lowest") return a.profit - b.profit;
      if (orderSort === "newest") return compareNewestFirst(a, b);
      if (orderSort === "oldest") return compareOldestFirst(a, b);
      if (orderSort === "needs-attention") {
        return compareOldestNeedsItemsFirst(a, b);
      }

      if (activeFilter === "ALL") {
        const needsItemsDifference =
          Number(isTikTokOrderNeedingItems(b)) -
          Number(isTikTokOrderNeedingItems(a));

        if (needsItemsDifference !== 0) {
          return needsItemsDifference;
        }
      }

      return compareNewestFirst(a, b);
    });
  }, [activeFilter, dateFilter, orderSort, orders, search]);
  const hasFilteringCriteria =
    search.trim().length > 0 || dateFilter !== "ALL" || activeFilter !== "ALL";
  const hasActiveFilters = hasFilteringCriteria || orderSort !== "recent";

  const clearFilters = () => {
    setSearch("");
    setDateFilter("ALL");
    setStatusFilter("ALL");
    setOrderSort("recent");

    if (filter) {
      router.setParams({ filter: undefined });
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
    <View style={styles.screenShell}>
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
      <View style={styles.pageHeader}>
        <View style={styles.flexItem}>
          <Text style={styles.title}>Orders</Text>
          <Text style={styles.subtitle}>Manage fulfilment and customer sales</Text>
        </View>
        <Pressable
          style={styles.headerAddButton}
          onPress={() => router.push("/add-order" as any)}
        >
          <Text style={styles.headerAddButtonText}>+ Add order</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.syncButton, syncing && styles.disabledButton]}
        onPress={handleTikTokSync}
        disabled={syncing}
      >
        <Text style={styles.syncButtonText}>
          {syncing ? "Syncing..." : "Sync TikTok Orders"}
        </Text>
      </Pressable>

      <TikTokSyncStatusCard
        data={syncHistory}
        loading={syncHistoryLoading}
        error={syncHistoryError}
        onRetry={loadSyncHistory}
      />

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>Order records</Text>
          <Text style={styles.summaryValue}>{displayedOrders.length}</Text>
        </View>
        <View style={styles.comparisonBox}>
          <Text style={styles.comparisonLabel}>vs previous month</Text>
          <Text style={[
            styles.comparisonValue,
            (monthDifference ?? 0) >= 0 ? styles.positiveComparison : styles.negativeComparison,
          ]}>
            {monthDifference === null
              ? "—"
              : `${monthDifference >= 0 ? "↑" : "↓"} ${Math.abs(monthDifference).toFixed(1)}%`}
          </Text>
        </View>
      </View>

      <View style={styles.toolsCard}>
        <View style={styles.searchRow}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search order or TikTok order ID"
            placeholderTextColor={UI.colors.inkSubtle}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="search"
          />
          <Pressable style={styles.searchButton} onPress={Keyboard.dismiss}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>

        <Text style={styles.filterLabel}>FILTER ORDERS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {STATUS_FILTERS.map((status) => (
          <Pressable
            key={status}
            style={[
              styles.filterChip,
              activeFilter === status && styles.activeFilterChip,
            ]}
            onPress={() => {
              setStatusFilter(status);
              if (filter) {
                router.setParams({ filter: undefined });
              }
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === status && styles.activeFilterChipText,
              ]}
            >
              {status === "ALL"
                ? "All"
                : status === "NEEDS_ITEMS"
                  ? `Needs Items (${needsItemsCount})`
                  : status.toLowerCase()}
            </Text>
          </Pressable>
        ))}
        </ScrollView>

        <Text style={styles.filterLabel}>DATE RANGE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {DATE_FILTERS.map((option) => (
            <Pressable
              key={option.key}
              style={[
                styles.filterChip,
                dateFilter === option.key && styles.activeFilterChip,
              ]}
              onPress={() => setDateFilter(option.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  dateFilter === option.key && styles.activeFilterChipText,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>SORT ORDERS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sortScroll}
        >
          {SORT_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              style={[
                styles.sortButton,
                orderSort === option.key && styles.activeSortButton,
              ]}
              onPress={() => setOrderSort(option.key)}
            >
              <Text
                style={[
                  styles.sortButtonText,
                  orderSort === option.key && styles.activeSortButtonText,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.resultsRow}>
          <Text style={styles.resultText}>
            Showing {displayedOrders.length} of {orders.length} orders
          </Text>
          {hasActiveFilters ? (
            <Pressable onPress={clearFilters} hitSlop={8}>
              <Text style={styles.clearFiltersText}>Clear Filters</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {displayedOrders.length === 0 ? (
        <EmptyState
          title={
            activeFilter === "NEEDS_ITEMS"
              ? "No TikTok orders need product details."
              : hasFilteringCriteria
                ? "No orders match the selected filters."
                : "No orders yet"
          }
          message={
            activeFilter === "NEEDS_ITEMS"
              ? "Incomplete TikTok orders will appear here after synchronization."
              : hasFilteringCriteria
                ? "Try changing or clearing your search and filter selections."
                : "Create your first order to start tracking revenue and stock movement."
          }
        />
      ) : (
        displayedOrders.map((order) => {
          const needsItems = isTikTokOrderNeedingItems(order);
          const needsItemsAge = needsItems
            ? getNeedsItemsAge(order, ageReferenceTime)
            : null;

          return (
            <View
              key={order.id}
              style={[styles.card, needsItems && styles.needsItemsCard]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.flexItem}>
                  <Text style={styles.orderNumber}>
                    {order.orderNumber ?? order.id}
                  </Text>
                  <Text style={styles.customerName}>
                    {order.customerName ?? "No customer name"}
                  </Text>
                </View>

                <View style={styles.badgeColumn}>
                  <Text
                    style={[styles.statusBadge, getStatusStyle(order.status)]}
                  >
                    {order.status}
                  </Text>

                  {needsItems ? (
                    <Text style={[styles.statusBadge, styles.needsItemsBadge]}>
                      Needs Items
                    </Text>
                  ) : null}

                  {needsItemsAge ? (
                    <Text
                      style={[
                        styles.statusBadge,
                        needsItemsAge.needsAttention
                          ? styles.attentionBadge
                          : styles.ageBadge,
                      ]}
                    >
                      {needsItemsAge.label}
                    </Text>
                  ) : null}

                  {order.source === "TIKTOK" &&
                  order.importStatus === "READY" &&
                  order.stockProcessed ? (
                    <Text style={[styles.statusBadge, styles.readyBadge]}>
                      Ready
                    </Text>
                  ) : null}
                </View>
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
                style={[
                  styles.detailsButton,
                  needsItems && styles.completeOrderButton,
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/order-detail" as any,
                    params: { orderId: order.id },
                  })
                }
              >
                <Text style={styles.detailsButtonText}>
                  {needsItems ? "Complete Order" : "View order"}
                </Text>
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
    </View>
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
  headerAddButton: { minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: UI.colors.primary, borderRadius: UI.radius.small, paddingHorizontal: 16, ...UI.shadow },
  headerAddButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  syncButton: { minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: UI.colors.surface, borderWidth: 1, borderColor: UI.colors.border, borderRadius: UI.radius.small, marginBottom: 16 },
  syncButtonText: { color: UI.colors.ink, fontSize: 12, fontWeight: "700" },
  disabledButton: { opacity: 0.6 },
  summaryCard: { minHeight: 104, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: UI.radius.large, padding: 20, marginBottom: 16, backgroundColor: UI.colors.ink, ...UI.shadow },
  summaryLabel: { color: "#D0D5DD", fontSize: 13, marginBottom: 7 },
  summaryValue: { color: "#fff", fontSize: 30, fontWeight: "800" },
  comparisonBox: { alignItems: "flex-end" },
  comparisonLabel: { color: "#D0D5DD", fontSize: 12, marginBottom: 7 },
  comparisonValue: { fontSize: 30, fontWeight: "800", textAlign: "right" },
  positiveComparison: { color: "#6CE9A6" },
  negativeComparison: { color: "#FDA29B" },
  toolsCard: { backgroundColor: UI.colors.surface, borderRadius: UI.radius.large, padding: 14, borderWidth: 1, borderColor: UI.colors.border, marginBottom: 16, ...UI.shadow },
  searchRow: { minHeight: 50, flexDirection: "row", alignItems: "center", backgroundColor: UI.colors.surfaceMuted, borderWidth: 1, borderColor: UI.colors.border, borderRadius: UI.radius.medium, paddingLeft: 14 },
  searchGlyph: { color: UI.colors.inkMuted, fontSize: 22, marginRight: 8 },
  filterLabel: { color: UI.colors.inkMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: 16, marginBottom: 9 },
  resultsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
    paddingTop: 12,
    marginTop: 12,
  },
  resultText: { flex: 1, color: UI.colors.inkMuted, fontSize: 12 },
  clearFiltersText: {
    color: UI.colors.primary,
    fontSize: 12,
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
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: UI.colors.border,
    ...UI.shadow,
  },
  needsItemsCard: {
    backgroundColor: "#FFFCF5",
    borderColor: "#FEC84B",
    borderWidth: 2,
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
  badgeColumn: {
    alignItems: "flex-end",
    gap: 6,
  },
  needsItemsBadge: {
    backgroundColor: UI.colors.warningSoft,
    color: UI.colors.warning,
  },
  ageBadge: {
    backgroundColor: UI.colors.surfaceMuted,
    color: UI.colors.inkMuted,
  },
  attentionBadge: {
    backgroundColor: UI.colors.dangerSoft,
    color: UI.colors.danger,
  },
  readyBadge: {
    backgroundColor: UI.colors.successSoft,
    color: UI.colors.success,
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
  sortScroll: { marginBottom: 2 },
  sortButton: { minHeight: 38, alignItems: "center", justifyContent: "center", backgroundColor: UI.colors.surfaceMuted, borderWidth: 1, borderColor: UI.colors.border, borderRadius: UI.radius.small, paddingHorizontal: 12, marginRight: 7 },
  activeSortButton: { backgroundColor: UI.colors.ink, borderColor: UI.colors.ink },
  sortButtonText: { color: UI.colors.inkMuted, fontSize: 10, fontWeight: "700", textAlign: "center" },
  activeSortButtonText: { color: "#fff" },
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
    justifyContent: "center",
    backgroundColor: "rgba(16, 24, 40, 1.00)",
    borderWidth: 1,
    borderColor: "rgba(16, 24, 40, 1.00)",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
  },
  detailsButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
  },
  completeOrderButton: {
    backgroundColor: UI.colors.warning,
    borderColor: UI.colors.warning,
  },
  detailsArrow: { color: UI.colors.primary, fontSize: 17, fontWeight: "700" },
});
