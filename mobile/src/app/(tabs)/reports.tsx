import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { getMonthlyReport, MonthlyReport } from "../../api/reports";
import { EmptyState } from "../../components/EmptyState";
import { useFocusEffect } from "expo-router";
import { UI } from "../../constants/ui";
import { FloatingBackToTop } from "../../components/FloatingBackToTop";

const formatRM = (value: number) => {
  return Number.isFinite(value) ? `RM ${value.toFixed(2)}` : "—";
};

const formatPercentage = (value: number | null) => {
  return value !== null && Number.isFinite(value)
    ? `${value.toFixed(1)}%`
    : "—";
};

type ReportSection = "overview" | "product-performance";
type ProductSort =
  | "best-selling"
  | "highest-revenue"
  | "most-profitable"
  | "lowest-selling";

const productSortOptions: { key: ProductSort; label: string }[] = [
  { key: "best-selling", label: "Best Selling" },
  { key: "highest-revenue", label: "Highest Revenue" },
  { key: "most-profitable", label: "Most Profitable" },
  { key: "lowest-selling", label: "Lowest Selling" },
];

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
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 720;

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [section, setSection] = useState<ReportSection>("overview");
  const [productSort, setProductSort] =
    useState<ProductSort>("best-selling");
  const [netProfitDifference, setNetProfitDifference] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadReport = useCallback(async () => {
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
    } catch {
      setError("Failed to load monthly report");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadReport();
    }, [loadReport])
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

  const sortedProducts = useMemo(() => {
    const products = [...(report?.productPerformance.products ?? [])];

    return products.sort((a, b) => {
      if (productSort === "highest-revenue") {
        return (
          b.netRevenue - a.netRevenue ||
          b.unitsSold - a.unitsSold ||
          a.name.localeCompare(b.name)
        );
      }

      if (productSort === "most-profitable") {
        return (
          b.grossProfit - a.grossProfit ||
          b.netRevenue - a.netRevenue ||
          a.name.localeCompare(b.name)
        );
      }

      if (productSort === "lowest-selling") {
        return (
          a.unitsSold - b.unitsSold ||
          a.netRevenue - b.netRevenue ||
          a.name.localeCompare(b.name)
        );
      }

      return (
        b.unitsSold - a.unitsSold ||
        b.netRevenue - a.netRevenue ||
        a.name.localeCompare(b.name)
      );
    });
  }, [productSort, report]);

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

  const handleExportProductPerformanceCsv = () => {
    if (!report) {
      Alert.alert("Error", "No report data to export.");
      return;
    }

    if (Platform.OS !== "web") {
      Alert.alert(
        "Export not available",
        "Product Performance CSV export is currently available on the web version only."
      );
      return;
    }

    const rows: unknown[][] = [
      ["TikTok Sales Tracker Product Performance Report"],
      ["Year", report.period.year],
      ["Month", report.period.month],
      ["Start Date", report.period.startDate],
      ["End Date", report.period.endDate],
      ["Profit basis", "Historical cost stored on each order item"],
      [],
      [
        "Product name",
        "SKU",
        "Units sold",
        "Order count",
        "Gross revenue",
        "Discount amount",
        "Net revenue",
        "Average selling price",
        "Gross profit",
        "Profit margin (%)",
      ],
      ...sortedProducts.map((product) => [
        product.name,
        product.sku,
        product.unitsSold,
        product.orderCount,
        product.grossRevenue.toFixed(2),
        product.discountAmount.toFixed(2),
        product.netRevenue.toFixed(2),
        product.averageSellingPrice.toFixed(2),
        product.grossProfit.toFixed(2),
        product.profitMargin?.toFixed(2) ?? "",
      ]),
    ];

    const csv = buildCsv(rows);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `product-performance-${report.period.year}-${String(
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

      <View style={styles.sectionControls} accessibilityRole="tablist">
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: section === "overview" }}
          style={[
            styles.sectionControl,
            section === "overview" && styles.sectionControlActive,
          ]}
          onPress={() => setSection("overview")}
        >
          <Text
            style={[
              styles.sectionControlText,
              section === "overview" && styles.sectionControlTextActive,
            ]}
          >
            Overview
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{
            selected: section === "product-performance",
          }}
          style={[
            styles.sectionControl,
            section === "product-performance" && styles.sectionControlActive,
          ]}
          onPress={() => setSection("product-performance")}
        >
          <Text
            style={[
              styles.sectionControlText,
              section === "product-performance" &&
                styles.sectionControlTextActive,
            ]}
          >
            Product Performance
          </Text>
        </Pressable>
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

      {section === "overview" ? (
      <>
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
      </>
      ) : (
      <>
        <View style={styles.exportPanel}>
          <Text style={styles.exportPanelTitle}>Export data</Text>
          <Pressable
            style={styles.exportButton}
            onPress={handleExportProductPerformanceCsv}
          >
            <Text style={styles.exportButtonText}>
              Product performance · {monthNames[month - 1]} {year}
            </Text>
          </Pressable>
        </View>

        <View style={styles.productIntroCard}>
          <Text style={styles.sectionTitle}>Product Performance</Text>
          <Text style={styles.productIntroText}>
            Line-item sales and gross profit for {monthNames[month - 1]} {year}.
          </Text>

          <View style={styles.productSummaryGrid}>
            <View
              style={[
                styles.productSummaryMetric,
                isWideLayout && styles.productSummaryMetricWide,
              ]}
            >
              <Text style={styles.productMetricLabel}>Total products sold</Text>
              <Text style={styles.productMetricValue}>
                {report.productPerformance.summary.productCount}
              </Text>
            </View>
            <View
              style={[
                styles.productSummaryMetric,
                isWideLayout && styles.productSummaryMetricWide,
              ]}
            >
              <Text style={styles.productMetricLabel}>Total units sold</Text>
              <Text style={styles.productMetricValue}>
                {report.productPerformance.summary.unitsSold}
              </Text>
            </View>
            <View
              style={[
                styles.productSummaryMetric,
                isWideLayout && styles.productSummaryMetricWide,
              ]}
            >
              <Text style={styles.productMetricLabel}>Gross revenue</Text>
              <Text style={styles.productMetricValueSmall}>
                {formatRM(report.productPerformance.summary.grossRevenue)}
              </Text>
            </View>
            <View
              style={[
                styles.productSummaryMetric,
                isWideLayout && styles.productSummaryMetricWide,
              ]}
            >
              <Text style={styles.productMetricLabel}>Discounts</Text>
              <Text style={styles.productMetricValueSmall}>
                {formatRM(report.productPerformance.summary.discountAmount)}
              </Text>
            </View>
            <View
              style={[
                styles.productSummaryMetric,
                isWideLayout && styles.productSummaryMetricWide,
              ]}
            >
              <Text style={styles.productMetricLabel}>Net revenue</Text>
              <Text style={styles.productMetricValueSmall}>
                {formatRM(report.productPerformance.summary.netRevenue)}
              </Text>
            </View>
            <View
              style={[
                styles.productSummaryMetric,
                isWideLayout && styles.productSummaryMetricWide,
              ]}
            >
              <Text style={styles.productMetricLabel}>Gross profit</Text>
              <Text style={styles.productMetricValueSmall}>
                {formatRM(report.productPerformance.summary.grossProfit)}
              </Text>
            </View>
          </View>

          {report.productPerformance.highlights.bestSellingProduct &&
          report.productPerformance.highlights.highestRevenueProduct ? (
            <View style={styles.productHighlights}>
              <View style={styles.productHighlightItem}>
                <Text style={styles.productHighlightLabel}>Best-selling product</Text>
                <Text style={styles.productHighlightName}>
                  {report.productPerformance.highlights.bestSellingProduct.name}
                </Text>
                <Text style={styles.itemSubtitle}>
                  {report.productPerformance.highlights.bestSellingProduct.unitsSold} units
                </Text>
              </View>
              <View style={styles.productHighlightItem}>
                <Text style={styles.productHighlightLabel}>Highest-revenue product</Text>
                <Text style={styles.productHighlightName}>
                  {report.productPerformance.highlights.highestRevenueProduct.name}
                </Text>
                <Text style={styles.itemSubtitle}>
                  {formatRM(
                    report.productPerformance.highlights.highestRevenueProduct
                      .netRevenue
                  )}
                </Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.profitAccuracyText}>
            Discounts are allocated proportionally to gross line revenue. Gross
            profit uses historical item cost; shipping fees are not allocated to
            products.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Products</Text>
          <View style={styles.sortControls}>
            {productSortOptions.map((option) => (
              <Pressable
                key={option.key}
                style={[
                  styles.sortButton,
                  productSort === option.key && styles.sortButtonActive,
                ]}
                onPress={() => setProductSort(option.key)}
              >
                <Text
                  style={[
                    styles.sortButtonText,
                    productSort === option.key && styles.sortButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {sortedProducts.length === 0 ? (
            <EmptyState
              title="No product sales were recorded for this period."
              message="Choose another month to review product performance."
            />
          ) : (
            <View style={styles.productGrid}>
              {sortedProducts.map((product) => (
                <View
                  key={product.productId}
                  style={[
                    styles.productCard,
                    isWideLayout && styles.productCardWide,
                  ]}
                >
                  <View style={styles.productCardHeader}>
                    <View style={styles.flexItem}>
                      <Text style={styles.itemTitle}>{product.name}</Text>
                      <Text style={styles.itemSubtitle}>SKU: {product.sku}</Text>
                    </View>
                    {!product.isActive ? (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveBadgeText}>Inactive</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.productPrimaryMetrics}>
                    <View style={styles.productPrimaryMetric}>
                      <Text style={styles.productMetricLabel}>Units sold</Text>
                      <Text style={styles.productMetricValue}>
                        {product.unitsSold}
                      </Text>
                    </View>
                    <View style={styles.productPrimaryMetric}>
                      <Text style={styles.productMetricLabel}>Net revenue</Text>
                      <Text style={styles.productMetricValueSmall}>
                        {formatRM(product.netRevenue)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.productDetailGrid}>
                    <View style={styles.productDetailMetric}>
                      <Text style={styles.productDetailLabel}>Orders</Text>
                      <Text style={styles.productDetailValue}>{product.orderCount}</Text>
                    </View>
                    <View style={styles.productDetailMetric}>
                      <Text style={styles.productDetailLabel}>Avg. net price</Text>
                      <Text style={styles.productDetailValue}>
                        {formatRM(product.averageSellingPrice)}
                      </Text>
                    </View>
                    <View style={styles.productDetailMetric}>
                      <Text style={styles.productDetailLabel}>Gross revenue</Text>
                      <Text style={styles.productDetailValue}>
                        {formatRM(product.grossRevenue)}
                      </Text>
                    </View>
                    <View style={styles.productDetailMetric}>
                      <Text style={styles.productDetailLabel}>Discounts</Text>
                      <Text style={styles.productDetailValue}>
                        {formatRM(product.discountAmount)}
                      </Text>
                    </View>
                    <View style={styles.productDetailMetric}>
                      <Text style={styles.productDetailLabel}>Gross profit</Text>
                      <Text
                        style={
                          product.grossProfit >= 0
                            ? styles.productProfitValue
                            : styles.productLossValue
                        }
                      >
                        {formatRM(product.grossProfit)}
                      </Text>
                    </View>
                    <View style={styles.productDetailMetric}>
                      <Text style={styles.productDetailLabel}>Margin</Text>
                      <Text style={styles.productDetailValue}>
                        {formatPercentage(product.profitMargin)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </>
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
  pageHeader: { marginBottom: 22 },
  sectionControls: {
    flexDirection: "row",
    padding: 4,
    marginBottom: 14,
    borderRadius: UI.radius.medium,
    backgroundColor: UI.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: UI.colors.border,
  },
  sectionControl: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: UI.radius.small,
  },
  sectionControlActive: {
    backgroundColor: UI.colors.surface,
    ...UI.shadow,
  },
  sectionControlText: {
    color: UI.colors.inkMuted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  sectionControlTextActive: { color: UI.colors.primary },
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
  productIntroCard: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    padding: 18,
    borderWidth: 1,
    borderColor: UI.colors.border,
    ...UI.shadow,
  },
  productIntroText: {
    marginTop: -6,
    marginBottom: 16,
    color: UI.colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  productSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  productSummaryMetric: {
    width: "48%",
    minWidth: 130,
    flexGrow: 1,
    backgroundColor: UI.colors.surfaceMuted,
    borderRadius: UI.radius.medium,
    padding: 14,
  },
  productSummaryMetricWide: {
    width: "23%",
    minWidth: 140,
  },
  productMetricLabel: {
    color: UI.colors.inkMuted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 5,
  },
  productMetricValue: {
    color: UI.colors.ink,
    fontSize: 22,
    fontWeight: "800",
  },
  productMetricValueSmall: {
    color: UI.colors.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  productHighlights: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  productHighlightItem: {
    flex: 1,
    minWidth: 220,
    padding: 14,
    borderRadius: UI.radius.medium,
    borderWidth: 1,
    borderColor: "#FBC5CF",
    backgroundColor: UI.colors.primarySoft,
  },
  productHighlightLabel: {
    color: UI.colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  productHighlightName: {
    color: UI.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  profitAccuracyText: {
    color: UI.colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  sortControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  sortButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: UI.radius.pill,
    backgroundColor: UI.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: UI.colors.border,
  },
  sortButtonActive: {
    backgroundColor: UI.colors.ink,
    borderColor: UI.colors.ink,
  },
  sortButtonText: {
    color: UI.colors.inkMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  sortButtonTextActive: { color: "#fff" },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
  },
  productCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.medium,
    padding: 15,
    backgroundColor: UI.colors.surfaceMuted,
  },
  productCardWide: {
    width: "48%",
    flexGrow: 1,
  },
  productCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  inactiveBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: UI.radius.pill,
    backgroundColor: UI.colors.warningSoft,
  },
  inactiveBadgeText: {
    color: UI.colors.warning,
    fontSize: 10,
    fontWeight: "800",
  },
  productPrimaryMetrics: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  productPrimaryMetric: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    borderRadius: UI.radius.small,
    backgroundColor: UI.colors.surface,
  },
  productDetailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  productDetailMetric: {
    width: "50%",
    paddingVertical: 7,
    paddingRight: 8,
  },
  productDetailLabel: {
    color: UI.colors.inkMuted,
    fontSize: 11,
    marginBottom: 3,
  },
  productDetailValue: {
    color: UI.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  productProfitValue: {
    color: UI.colors.success,
    fontSize: 13,
    fontWeight: "800",
  },
  productLossValue: {
    color: UI.colors.danger,
    fontSize: 13,
    fontWeight: "800",
  },
});
