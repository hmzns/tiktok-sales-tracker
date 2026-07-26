import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { getMonthlyReport, MonthlyReport } from "../../api/reports";
import { useFocusEffect } from "expo-router";
import { UI } from "../../constants/ui";
import { FloatingBackToTop } from "../../components/FloatingBackToTop";

const formatRM = (value: number) => {
  return `RM ${value.toFixed(2)}`;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function ReportsScreen() {
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [netProfitDifference, setNetProfitDifference] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadReport = async () => {
    try {
      setError(null);

      const previousMonth = month === 1 ? 12 : month - 1;
      const previousYear = month === 1 ? year - 1 : year;
      const [result, previousReport] = await Promise.all([
        getMonthlyReport(year, month),
        getMonthlyReport(previousYear, previousMonth),
      ]);
      setReport(result);
      const currentNetProfit = result.summary.netProfit;
      const previousNetProfit = previousReport.summary.netProfit;
      setNetProfitDifference(
        previousNetProfit === 0
          ? currentNetProfit === 0
            ? 0
            : 100
          : ((currentNetProfit - previousNetProfit) / Math.abs(previousNetProfit)) * 100
      );
    } catch (err) {
      setError("Failed to load monthly report");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadReport();
    }, [year, month])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadReport();
  };

  const goPreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
      return;
    }

    setMonth(month - 1);
  };

  const goNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
      return;
    }

    setMonth(month + 1);
  };

  if (loading) {
    return (
      <LoadingState
        title="Generating all the numbers..."
        message="Sit back and relax, make a cup of coffee or layan Aleena."
      />
    );
  }

  if (error || !report) {
    return (
      <View style={styles.screen}>
        <ErrorState
          title="Failed to load report"
          message="Please check your backend connection and try again."
          onRetry={loadReport}
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

  const handleExportCsv = () => {
    if (!report) {
      Alert.alert("Error", "No report data to export.");
      return;
    }

    if (Platform.OS !== "web") {
      Alert.alert(
        "Export not available",
        "CSV export is currently available on the web version only."
      );
      return;
    }

    const rows: unknown[][] = [
      ["TikTok Sales Tracker Monthly Report"],
      ["Year", report.period.year],
      ["Month", report.period.month],
      ["Start Date", report.period.startDate],
      ["End Date", report.period.endDate],
      [],
      ["Summary"],
      ["Total Revenue", report.summary.totalRevenue],
      ["Total Cost", report.summary.totalCost],
      ["Sales Profit", report.summary.salesProfit],
      ["Total Expenses", report.summary.totalExpenses],
      ["Net Profit", report.summary.netProfit],
      ["Total Orders", report.summary.totalOrders],
      ["Total Items Sold", report.summary.totalItemsSold],
      ["Average Order Value", report.summary.averageOrderValue],
      [],
      ["Orders"],
      [
        "Order Number",
        "Customer",
        "Platform",
        "Status",
        "Date",
        "Total",
        "Profit",
      ],
      ...report.orderRows.map((order) => [
        order.orderNumber ?? "-",
        order.customerName ?? "-",
        order.platform,
        order.status,
        order.date,
        order.total,
        order.profit,
      ]),
      [],
      ["Product Summary"],
      ["Product", "SKU", "Category", "Quantity Sold", "Revenue", "Cost", "Profit"],
      ...report.productSummary.map((product) => [
        product.productName,
        product.sku,
        product.category ?? "-",
        product.quantitySold,
        product.revenue,
        product.cost,
        product.profit,
      ]),
      [],
      ["Expenses by Category"],
      ["Category", "Amount"],
      ...report.expensesByCategory.map((expense) => [
        expense.category,
        expense.amount,
      ]),
    ];

    const csv = buildCsv(rows);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `monthly-report-${report.period.year}-${String(
      report.period.month
    ).padStart(2, "0")}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const handleExportOrdersCsv = () => {
    if (!report) {
      Alert.alert("Error", "No report data to export.");
      return;
    }

    if (Platform.OS !== "web") {
      Alert.alert(
        "Export not available",
        "Orders CSV export is currently available on the web version only."
      );
      return;
    }

    const rows: unknown[][] = [
      ["TikTok Sales Tracker Orders Export"],
      ["Year", report.period.year],
      ["Month", report.period.month],
      ["Start Date", report.period.startDate],
      ["End Date", report.period.endDate],
      [],
      [
        "Order Number",
        "Customer",
        "Platform",
        "Status",
        "Date",
        "Total",
        "Profit",
      ],
      ...report.orderRows.map((order) => [
        order.orderNumber ?? "-",
        order.customerName ?? "-",
        order.platform,
        order.status,
        order.date,
        order.total,
        order.profit,
      ]),
    ];

    const csv = buildCsv(rows);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `orders-${report.period.year}-${String(
      report.period.month
    ).padStart(2, "0")}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

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
        <Text style={styles.title}>Monthly report</Text>
        <Text style={styles.subtitle}>Revenue, profit, and operating insights</Text>
      </View>

      <View style={styles.monthControls}>
        <Pressable style={styles.monthButton} onPress={goPreviousMonth}>
          <Text style={styles.monthButtonText}>←</Text>
        </Pressable>
        <View style={styles.monthCurrent}>
          <Text style={styles.monthLabel}>{monthNames[month - 1]}</Text>
          <Text style={styles.yearLabel}>{year}</Text>
        </View>
        <Pressable style={styles.monthButton} onPress={goNextMonth}>
          <Text style={styles.monthButtonText}>→</Text>
        </Pressable>
      </View>

      <View style={styles.exportPanel}>
        <Text style={styles.exportPanelTitle}>Export data</Text>
        <View style={styles.exportActions}>
          <Pressable style={styles.exportButton} onPress={handleExportCsv}>
            <Text style={styles.exportButtonText}>
              Full report · {monthNames[month - 1]} {year}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryExportButton} onPress={handleExportOrdersCsv}>
            <Text style={styles.secondaryExportButtonText}>Orders</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.netProfitCard}>
        <View>
          <Text style={styles.netProfitLabel}>Net Profit</Text>
          <Text
            style={
              report.summary.netProfit >= 0
                ? styles.positiveValue
                : styles.negativeValue
            }
          >
            {formatRM(report.summary.netProfit)}
          </Text>
        </View>
        <View style={styles.netProfitComparisonBox}>
          <Text style={styles.netProfitComparisonLabel}>vs previous month</Text>
          <Text style={[
            styles.netProfitComparisonValue,
            (netProfitDifference ?? 0) >= 0
              ? styles.positiveComparison
              : styles.negativeComparison,
          ]}>
            {netProfitDifference === null
              ? "—"
              : `${netProfitDifference >= 0 ? "↑" : "↓"} ${Math.abs(netProfitDifference).toFixed(1)}%`}
          </Text>
        </View>
      </View>

      <View style={styles.metricsCard}>
        <View style={styles.metricItem}>
          <Text style={styles.cardLabel}>Revenue</Text>
          <Text style={styles.cardValue}>
            {formatRM(report.summary.totalRevenue)}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.cardLabel}>Sales Profit</Text>
          <Text style={styles.cardValue}>
            {formatRM(report.summary.salesProfit)}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.cardLabel}>Expenses</Text>
          <Text style={styles.cardValue}>
            {formatRM(report.summary.totalExpenses)}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.cardLabel}>Orders</Text>
          <Text style={styles.cardValue}>{report.summary.totalOrders}</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.cardLabel}>Items Sold</Text>
          <Text style={styles.cardValue}>{report.summary.totalItemsSold}</Text>
        </View>
      </View>

      <View style={styles.highlightSection}>
        <Text style={styles.sectionTitle}>Average Order Value</Text>
        <Text style={styles.sectionValue}>
          {formatRM(report.summary.averageOrderValue)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Products</Text>

        {report.productSummary.length === 0 ? (
          <Text style={styles.emptyText}>No product sales for this month.</Text>
        ) : (
          report.productSummary.slice(0, 10).map((product) => (
            <View key={product.productId} style={styles.listItem}>
              <View style={styles.flexItem}>
                <Text style={styles.itemTitle}>{product.productName}</Text>
                <Text style={styles.itemSubtitle}>
                  SKU: {product.sku} | Sold: {product.quantitySold}
                </Text>
                <Text style={styles.itemSubtitle}>
                  Category: {product.category ?? "No category"}
                </Text>
              </View>

              <View style={styles.rightBox}>
                <Text style={styles.moneyText}>{formatRM(product.revenue)}</Text>
                <Text
                  style={
                    product.profit >= 0
                      ? styles.smallProfitText
                      : styles.smallLossText
                  }
                >
                  Profit {formatRM(product.profit)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Orders</Text>

        {report.orderRows.length === 0 ? (
          <Text style={styles.emptyText}>No orders for this month.</Text>
        ) : (
          report.orderRows.slice(0, 10).map((order) => (
            <View key={order.orderId} style={styles.listItem}>
              <View style={styles.flexItem}>
                <Text style={styles.itemTitle}>
                  {order.orderNumber ?? order.orderId}
                </Text>
                <Text style={styles.itemSubtitle}>
                  {order.customerName ?? "No customer"} | {order.status}
                </Text>
              </View>
              <View style={styles.rightBox}>
                <Text style={styles.moneyText}>{formatRM(order.total)}</Text>
                <Text style={order.profit >= 0 ? styles.smallProfitText : styles.smallLossText}>
                  Profit {formatRM(order.profit)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expenses by Category</Text>

        {report.expensesByCategory.length === 0 ? (
          <Text style={styles.emptyText}>No expenses for this month.</Text>
        ) : (
          report.expensesByCategory.map((expense) => (
            <View key={expense.category} style={styles.listItem}>
              <Text style={styles.itemTitle}>{expense.category}</Text>
              <Text style={styles.moneyText}>{formatRM(expense.amount)}</Text>
            </View>
          ))
        )}
      </View>
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
  pageHeader: { marginBottom: 22 },
  eyebrow: { color: UI.colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 5 },
  monthControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    backgroundColor: UI.colors.ink,
    borderRadius: UI.radius.large,
    padding: 10,
    ...UI.shadow,
  },
  monthButton: {
    width: 44,
    height: 44,
    backgroundColor: "#FFFFFF14",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  monthButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  monthCurrent: { flex: 1, alignItems: "center" },
  monthLabel: { color: "#fff", fontSize: 17, fontWeight: "700" },
  yearLabel: { color: "#98A2B3", fontSize: 12, marginTop: 2 },
  exportPanel: { backgroundColor: UI.colors.surface, borderWidth: 1, borderColor: UI.colors.border, borderRadius: UI.radius.large, padding: 14, marginBottom: 16, ...UI.shadow },
  exportPanelTitle: { color: UI.colors.inkMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 10 },
  exportActions: { flexDirection: "row", gap: 8 },
  netProfitCard: {
    backgroundColor: UI.colors.ink,
    borderRadius: UI.radius.large,
    padding: 22,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    ...UI.shadow,
  },
  netProfitLabel: { color: "#D0D5DD", fontSize: 13, marginBottom: 8 },
  netProfitComparisonBox: { alignItems: "flex-end" },
  netProfitComparisonLabel: { color: "#D0D5DD", fontSize: 12, marginBottom: 8 },
  netProfitComparisonValue: { fontSize: 24, fontWeight: "800", textAlign: "right" },
  positiveComparison: { color: "#6CE9A6" },
  negativeComparison: { color: "#FDA29B" },
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
    fontSize: 14,
    color: UI.colors.inkMuted,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 24,
    color: UI.colors.ink,
    fontWeight: "800",
  },
  positiveValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#6CE9A6",
  },
  negativeValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FDA29B",
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
  highlightSection: { backgroundColor: UI.colors.primarySoft, borderRadius: UI.radius.large, padding: 20, marginTop: 16, borderWidth: 1, borderColor: "#FBC5CF" },
  sectionTitle: {
    fontSize: 18,
    color: UI.colors.ink,
    fontWeight: "700",
    marginBottom: 12,
  },
  sectionValue: {
    fontSize: 22,
    color: UI.colors.primary,
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
  rightBox: {
    alignItems: "flex-end",
  },
  moneyText: {
    fontSize: 14,
    color: UI.colors.ink,
    fontWeight: "800",
  },
  smallProfitText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: UI.colors.success,
  },
  smallLossText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: UI.colors.danger,
  },
  exportButton: {
    flex: 1,
    backgroundColor: UI.colors.primary,
    borderRadius: UI.radius.small,
    paddingVertical: 11,
    alignItems: "center",
  },
  exportButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryExportButton: {
    flex: 1,
    backgroundColor: UI.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.small,
    paddingVertical: 11,
    alignItems: "center",
  },
  secondaryExportButtonText: {
    color: UI.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  backupButton: {
    flex: 1,
    backgroundColor: UI.colors.ink,
    borderRadius: UI.radius.small,
    paddingVertical: 11,
    alignItems: "center",
  },
  backupButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
