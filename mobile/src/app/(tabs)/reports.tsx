import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getMonthlyReport, MonthlyReport } from "../../api/reports";
import { useFocusEffect } from "expo-router";

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    try {
      setError(null);

      const result = await getMonthlyReport(year, month);
      setReport(result);
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
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading report...</Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.smallText}>
          Make sure your backend is running and API URL is correct.
        </Text>
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Monthly Report</Text>
      <Text style={styles.subtitle}>
        {monthNames[month - 1]} {year}
      </Text>

      <Pressable style={styles.exportButton} onPress={handleExportCsv}>
        <Text style={styles.exportButtonText}>Export CSV</Text>
      </Pressable>

      <View style={styles.monthControls}>
        <Pressable style={styles.monthButton} onPress={goPreviousMonth}>
          <Text style={styles.monthButtonText}>Previous</Text>
        </Pressable>

        <Pressable style={styles.monthButton} onPress={goNextMonth}>
          <Text style={styles.monthButtonText}>Next</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Revenue</Text>
          <Text style={styles.cardValue}>
            {formatRM(report.summary.totalRevenue)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sales Profit</Text>
          <Text style={styles.cardValue}>
            {formatRM(report.summary.salesProfit)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Expenses</Text>
          <Text style={styles.cardValue}>
            {formatRM(report.summary.totalExpenses)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Net Profit</Text>
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

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Orders</Text>
          <Text style={styles.cardValue}>{report.summary.totalOrders}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Items Sold</Text>
          <Text style={styles.cardValue}>{report.summary.totalItemsSold}</Text>
        </View>
      </View>

      <View style={styles.section}>
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
                <Text
                  style={
                    order.profit >= 0
                      ? styles.smallProfitText
                      : styles.smallLossText
                  }
                >
                  Profit {formatRM(order.profit)}
                </Text>
              </View>
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
    marginBottom: 16,
  },
  monthControls: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  monthButton: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  monthButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
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
    fontWeight: "900",
  },
  positiveValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "green",
  },
  negativeValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "red",
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
    fontWeight: "900",
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
    justifyContent: "space-between",
    gap: 12,
  },
  flexItem: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  itemSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: "#666",
  },
  rightBox: {
    alignItems: "flex-end",
  },
  moneyText: {
    fontSize: 14,
    fontWeight: "900",
  },
  smallProfitText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "green",
  },
  smallLossText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "red",
  },
  exportButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  exportButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
});