import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getDashboardSummary } from "../../api/dashboard";
import { getOrders } from "../../api/orders";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { UI } from "../../constants/ui";
import { useFocusEffect, useRouter } from "expo-router";
import { FloatingBackToTop } from "../../components/FloatingBackToTop";
import { SafeAreaView } from "react-native-safe-area-context";

type DashboardData = {
  revenue: number;
  salesProfit: number;
  totalExpenses: number;
  netProfit: number;
  orderCount: number;
  itemsSold: number;
  averageOrderValue: number;
  pendingFinanceOrderCount: number;
  financiallyRecognizedOrderCount: number;
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
  return Number.isFinite(value) ? `RM ${value.toFixed(2)}` : "—";
};

const formatDifference = (value: number | null) =>
  value !== null && Number.isFinite(value)
    ? `${value >= 0 ? "↑" : "↓"} ${Math.abs(value).toFixed(1)}%`
    : "—";

export default function HomeScreen() {
  const router = useRouter();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [netProfitDifference, setNetProfitDifference] = useState<number | null>(null);
  const [needsItemsCount, setNeedsItemsCount] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);

      const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const [data, previousData, needsItems] = await Promise.all([
        getDashboardSummary(currentYear, currentMonth),
        getDashboardSummary(previousYear, previousMonth),
        getOrders(1, 1, "", "NEEDS_ITEMS"),
      ]);
      setDashboard(data);
      setNeedsItemsCount(needsItems.meta.total);
      setNetProfitDifference(
        previousData.netProfit === 0
          ? data.netProfit === 0
            ? 0
            : 100
          : ((data.netProfit - previousData.netProfit) /
              Math.abs(previousData.netProfit)) *
            100
      );
    } catch {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentMonth, currentYear]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading) {
    return (
      <LoadingState
        title="Preparing your dashboard"
        message="Pulling together this month's sales, expenses, and stock."
      />
    );
  }

  if (error || !dashboard) {
    return (
      <View style={styles.screen}>
        <ErrorState
          title="Failed to load dashboard"
          message="Please check your connection and try again."
          onRetry={loadDashboard}
        />
      </View>
    );
  }

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
      <View style={styles.pageHeader}>
        <View>
          <Text accessibilityRole="header" style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>
            Your business at a glance · {currentMonth}/{currentYear}
          </Text>
        </View>
      </View>

      <View style={styles.activityRow}>
        <Pressable
          style={styles.needsItemsCard}
          onPress={() =>
            router.push({
              pathname: "/orders" as any,
              params: { filter: "needs-items" },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`${needsItemsCount} TikTok orders need items. View orders.`}
        >
          <View style={styles.flexItem}>
            <Text style={styles.needsItemsLabel}>Orders Needing Items</Text>
            <Text style={styles.needsItemsValue}>{needsItemsCount}</Text>
          </View>
          <Text style={styles.needsItemsArrow}>→</Text>
        </Pressable>

        <Pressable
          style={styles.linkButton}
          onPress={() => router.push("/stock-movements" as any)}
          accessibilityRole="button"
          accessibilityLabel="View stock activity"
        >
          <Text style={styles.linkButtonText}>Stock activity</Text>
          <Text style={styles.linkArrow}>→</Text>
        </Pressable>
      </View>
      
      <View style={styles.netProfitCard}>
        <View>
          <Text style={styles.netProfitLabel}>Net Profit</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[
            styles.netProfitValue,
            dashboard.netProfit >= 0 ? styles.positiveNetProfit : styles.negativeNetProfit,
          ]}>
            {formatRM(dashboard.netProfit)}
          </Text>
        </View>
        <View style={styles.netProfitComparisonBox}>
          <Text style={styles.netProfitComparisonLabel}>vs previous month</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[
            styles.netProfitComparisonValue,
            (netProfitDifference ?? 0) >= 0
              ? styles.positiveNetProfit
              : styles.negativeNetProfit,
          ]}>
            {formatDifference(netProfitDifference)}
          </Text>
        </View>
      </View>

      <View style={styles.metricsCard}>
        <View style={styles.metricItem}>
          <Text style={styles.cardLabel}>Revenue</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.cardValue}>{formatRM(dashboard.revenue)}</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.cardLabel}>Sales Profit</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.cardValue}>
            {formatRM(dashboard.salesProfit)}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.cardLabel}>Expenses</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.cardValue}>
            {formatRM(dashboard.totalExpenses)}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.cardLabel}>Orders</Text>
          <Text style={styles.cardValue}>{dashboard.orderCount}</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.cardLabel}>Items Sold</Text>
          <Text style={styles.cardValue}>{dashboard.itemsSold}</Text>
        </View>
      </View>

      {dashboard.pendingFinanceOrderCount > 0 ? (
        <View style={styles.financePendingCard}>
          <Text style={styles.financePendingText}>
            {dashboard.pendingFinanceOrderCount} completed FULL_TIKTOK
            {dashboard.pendingFinanceOrderCount === 1
              ? " order is"
              : " orders are"} excluded from financial totals while TikTok
            settlement is pending. Orders and units are still counted.
          </Text>
        </View>
      ) : null}

      <View style={styles.highlightSection}>
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

      <Pressable
        style={styles.guideButton}
        onPress={() => router.push("/help/iphone")}
        accessibilityRole="button"
      >
        <Text style={styles.guideButtonText}>How to add app to iPhone</Text>
      </Pressable>
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
    padding: UI.layout.screenPadding,
    paddingTop: 28,
    paddingBottom: 48,
  },
  financePendingCard: {
    backgroundColor: UI.colors.warningSoft,
    borderColor: UI.colors.warning,
    borderWidth: 1,
    borderRadius: UI.radius.small,
    padding: 12,
    marginBottom: 14,
  },
  financePendingText: {
    color: UI.colors.ink,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  pageHeader: {
    marginBottom: 22,
  },
  eyebrow: {
    color: UI.colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  title: {
    color: UI.colors.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: UI.colors.inkMuted,
    marginTop: 4,
  },
  needsItemsCard: {
    flex: 1,
    minWidth: 280,
    minHeight: 92,
    backgroundColor: UI.colors.warningSoft,
    borderWidth: 1,
    borderColor: "#FEC84B",
    borderRadius: UI.radius.large,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    ...UI.shadow,
  },
  activityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  needsItemsLabel: {
    color: UI.colors.warning,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 5,
  },
  needsItemsValue: {
    color: UI.colors.ink,
    fontSize: 28,
    fontWeight: "800",
  },
  needsItemsArrow: {
    color: UI.colors.warning,
    fontSize: 24,
    fontWeight: "700",
  },
  netProfitCard: {
    backgroundColor: UI.colors.ink,
    borderRadius: UI.radius.large,
    padding: 22,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    ...UI.shadow,
  },
  netProfitLabel: { color: "#D0D5DD", fontSize: 13, marginBottom: 8 },
  netProfitValue: { fontSize: 23, fontWeight: "800", letterSpacing: -0.4 },
  netProfitComparisonBox: { alignItems: "flex-end", flexGrow: 1, minWidth: 130 },
  netProfitComparisonLabel: { color: "#D0D5DD", fontSize: 12, marginBottom: 8 },
  netProfitComparisonValue: { fontSize: 23, fontWeight: "800", textAlign: "right" },
  positiveNetProfit: { color: "#6CE9A6" },
  negativeNetProfit: { color: "#FDA29B" },
  metricsCard: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: UI.colors.border,
    ...UI.shadow,
  },
  metricItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: UI.colors.border },
  cardLabel: {
    fontSize: 12,
    color: UI.colors.inkMuted,
    marginBottom: 8,
  },
  cardValue: {
    color: UI.colors.ink,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  section: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: UI.colors.border,
    ...UI.shadow,
  },
  highlightSection: {
    backgroundColor: UI.colors.primarySoft,
    borderRadius: UI.radius.large,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FBC5CF",
  },
  sectionTitle: {
    color: UI.colors.ink,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  sectionValue: {
    color: UI.colors.primary,
    fontSize: 24,
    fontWeight: "800",
  },
  emptyText: {
    fontSize: 14,
    color: UI.colors.inkMuted,
  },
  listItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
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
    color: UI.colors.ink,
    fontWeight: "700",
  },
  itemSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: UI.colors.inkMuted,
  },
  stockText: {
    fontSize: 14,
    fontWeight: "700",
  },
  positiveQty: {
    fontSize: 16,
    fontWeight: "800",
    color: UI.colors.success,
  },
  negativeQty: {
    fontSize: 16,
    fontWeight: "800",
    color: UI.colors.danger,
  },
  linkButton: {
    flex: 1,
    minWidth: 280,
    backgroundColor: UI.colors.ink,
    minHeight: 92,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: UI.radius.large,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...UI.shadow,
  },
  linkEyebrow: {
    color: "#98A2B3",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  linkButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  linkArrow: {
    color: "#FFFFFF",
    fontSize: 24,
  },
  guideButton: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.medium,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  guideButtonText: {
    color: UI.colors.ink,
    fontWeight: "700",
  },
});
