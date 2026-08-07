import { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SalesTrendDay,
  SalesTrendsReport,
} from "../../api/reports";
import { UI } from "../../constants/ui";
import { EmptyState } from "../EmptyState";
import { ErrorState } from "../ErrorState";
import { LoadingState } from "../LoadingState";

type TrendMetric = "netRevenue" | "grossProfit" | "netProfit" | "orderCount";

type Props = {
  report: SalesTrendsReport | null;
  loading: boolean;
  error: string | null;
  isWideLayout: boolean;
  monthLabel: string;
  year: number;
  onRetry: () => void;
};

const metricOptions: {
  key: TrendMetric;
  label: string;
  isCurrency: boolean;
}[] = [
  { key: "netRevenue", label: "Net Revenue", isCurrency: true },
  { key: "grossProfit", label: "Gross Profit", isCurrency: true },
  { key: "netProfit", label: "Net Profit", isCurrency: true },
  { key: "orderCount", label: "Orders", isCurrency: false },
];

const formatRM = (value: number) =>
  Number.isFinite(value) ? `RM ${value.toFixed(2)}` : "—";

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
};

const escapeCsvValue = (value: unknown) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

const buildCsv = (rows: unknown[][]) =>
  rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");

const getHighestDay = (
  days: SalesTrendDay[],
  value: (day: SalesTrendDay) => number
) =>
  days.reduce<SalesTrendDay | null>((highest, day) => {
    if (!highest || value(day) > value(highest)) {
      return day;
    }

    return highest;
  }, null);

export function SalesTrendsSection({
  report,
  loading,
  error,
  isWideLayout,
  monthLabel,
  year,
  onRetry,
}: Props) {
  const [metric, setMetric] = useState<TrendMetric>("netRevenue");

  const insights = useMemo(() => {
    const activeDays = (report?.trends ?? []).filter(
      (day) => day.orderCount > 0
    );

    if (!report || activeDays.length === 0) {
      return null;
    }

    return {
      highestSalesDay: getHighestDay(activeDays, (day) => day.netRevenue),
      highestProfitDay: getHighestDay(activeDays, (day) => day.netProfit),
      highestOrderDay: getHighestDay(activeDays, (day) => day.orderCount),
      activeDayCount: activeDays.length,
      averageRevenuePerActiveDay:
        report.summary.netRevenue / activeDays.length,
    };
  }, [report]);

  const chart = useMemo(() => {
    const values = (report?.trends ?? []).map((day) => {
      const value = day[metric];
      return Number.isFinite(value) ? value : 0;
    });
    const maxAbsolute = Math.max(1, ...values.map((value) => Math.abs(value)));

    return {
      values,
      maxAbsolute,
      hasNegative: values.some((value) => value < 0),
    };
  }, [metric, report]);

  if (loading) {
    return (
      <View style={styles.sectionState}>
        <LoadingState
          title="Building sales trends"
          message="Grouping sales and expenses by business day."
          compact
        />
      </View>
    );
  }

  if (error || !report) {
    return (
      <ErrorState
        title="Failed to load sales trends"
        message="The other report sections are still available. Please try again."
        onRetry={onRetry}
      />
    );
  }

  const selectedMetric =
    metricOptions.find((option) => option.key === metric) ?? metricOptions[0];
  const middleTrend = report.trends[Math.floor(report.trends.length / 2)];

  const handleExportCsv = () => {
    if (Platform.OS !== "web") {
      Alert.alert(
        "Export not available",
        "Sales Trends CSV export is currently available on the web version only."
      );
      return;
    }

    const rows: unknown[][] = [
      ["TikTok Sales Tracker Sales Trends Report"],
      ["Start Date", report.period.startDate],
      ["End Date", report.period.endDate],
      ["Business timezone", report.timezone],
      ["Profit basis", "Historical cost stored on each order item"],
      [],
      [
        "Date",
        "Order count",
        "Units sold",
        "Gross revenue",
        "Discount amount",
        "Net revenue",
        "Product cost",
        "Gross profit",
        "Expenses",
        "Net profit",
      ],
      ...report.trends.map((day) => [
        day.date,
        day.orderCount,
        day.unitsSold,
        day.grossRevenue.toFixed(2),
        day.discountAmount.toFixed(2),
        day.netRevenue.toFixed(2),
        day.productCost.toFixed(2),
        day.grossProfit.toFixed(2),
        day.expenses.toFixed(2),
        day.netProfit.toFixed(2),
      ]),
    ];
    const blob = new Blob([buildCsv(rows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `sales-trends-${report.period.startDate}-${report.period.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <View style={styles.exportPanel}>
        <Text style={styles.exportPanelTitle}>Export data</Text>
        <Pressable accessibilityRole="button" style={styles.exportButton} onPress={handleExportCsv}>
          <Text style={styles.exportButtonText}>
            Sales trends · {monthLabel} {year}
          </Text>
        </Pressable>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeading}>
          <View style={styles.flexItem}>
            <Text style={styles.sectionTitle}>Sales Trends</Text>
            <Text style={styles.introText}>
              Daily net sales and profit.
            </Text>
          </View>
          <View style={styles.timezoneBadge}>
            <Text style={styles.timezoneText}>MYT · UTC+8</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          {[
            ["Total orders", String(report.summary.orderCount)],
            ["Units sold", String(report.summary.unitsSold)],
            ["Net revenue", formatRM(report.summary.netRevenue)],
            ["Discounts given", formatRM(report.summary.discountAmount)],
            ["Gross profit", formatRM(report.summary.grossProfit)],
            ["Expenses", formatRM(report.summary.expenses)],
            ["Net profit", formatRM(report.summary.netProfit)],
          ].map(([label, value]) => (
            <View
              key={label}
              style={[
                styles.summaryMetric,
                isWideLayout && styles.summaryMetricWide,
              ]}
            >
              <Text style={styles.metricLabel}>{label}</Text>
              <Text style={styles.metricValue}>{value}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.accuracyText}>
          Revenue excludes allocated discounts. Profit uses historical item cost;
          daily net profit also deducts expenses stored on that date.
        </Text>
        {report.summary.pendingFinanceOrderCount > 0 ? (
          <Text style={styles.accuracyText}>
            {report.summary.pendingFinanceOrderCount} FULL_TIKTOK
            {report.summary.pendingFinanceOrderCount === 1
              ? " order is"
              : " orders are"} excluded from financial totals while settlement is pending.
          </Text>
        ) : null}
      </View>

      {report.summary.orderCount === 0 ? (
        <EmptyState
          title="No completed sales were recorded for this period."
          message="Choose another month to review daily sales trends."
        />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Daily trend</Text>
            <View style={styles.metricControls}>
              {metricOptions.map((option) => (
                <Pressable
                  key={option.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: metric === option.key }}
                  style={[
                    styles.metricButton,
                    metric === option.key && styles.metricButtonActive,
                  ]}
                  onPress={() => setMetric(option.key)}
                >
                  <Text
                    style={[
                      styles.metricButtonText,
                      metric === option.key && styles.metricButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View
              style={styles.chart}
              accessibilityRole="image"
              accessibilityLabel={`${selectedMetric.label} by day for ${monthLabel} ${year}`}
            >
              <View style={styles.chartScaleRow}>
                <Text style={styles.chartScaleText}>
                  {selectedMetric.isCurrency
                    ? formatRM(chart.maxAbsolute)
                    : Math.ceil(chart.maxAbsolute)}
                </Text>
                <Text style={styles.chartScaleText}>{selectedMetric.label}</Text>
              </View>
              <View style={styles.chartBars}>
                {report.trends.map((day, index) => {
                  const value = chart.values[index];
                  const height = `${Math.max(
                    value === 0 ? 0 : 3,
                    (Math.abs(value) / chart.maxAbsolute) * 100
                  )}%` as `${number}%`;
                  const accessibleValue = selectedMetric.isCurrency
                    ? formatRM(value)
                    : String(value);

                  return (
                    <View
                      key={day.date}
                      style={styles.chartColumn}
                      accessible
                      accessibilityLabel={`${formatDate(day.date)}, ${selectedMetric.label}: ${accessibleValue}`}
                    >
                      <View
                        style={[
                          styles.positiveRegion,
                          !chart.hasNegative && styles.fullHeightRegion,
                        ]}
                      >
                        {value > 0 ? (
                          <View style={[styles.positiveBar, { height }]} />
                        ) : null}
                      </View>
                      <View style={styles.chartBaseline} />
                      {chart.hasNegative ? (
                        <View style={styles.negativeRegion}>
                          {value < 0 ? (
                            <View style={[styles.negativeBar, { height }]} />
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <View style={styles.chartDateLabels}>
                <Text style={styles.chartDateText}>
                  {report.trends[0]?.date.slice(-2)}
                </Text>
                <Text style={styles.chartDateText}>{middleTrend?.date.slice(-2)}</Text>
                <Text style={styles.chartDateText}>
                  {report.trends.at(-1)?.date.slice(-2)}
                </Text>
              </View>
            </View>
          </View>

          {insights ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Period insights</Text>
              <View style={styles.insightGrid}>
                <View style={styles.insightItem}>
                  <Text style={styles.insightLabel}>Highest sales day</Text>
                  <Text style={styles.insightValue}>
                    {formatDate(insights.highestSalesDay?.date ?? "")}
                  </Text>
                  <Text style={styles.insightDetail}>
                    {formatRM(insights.highestSalesDay?.netRevenue ?? 0)} net revenue
                  </Text>
                </View>
                <View style={styles.insightItem}>
                  <Text style={styles.insightLabel}>Highest profit day</Text>
                  <Text style={styles.insightValue}>
                    {formatDate(insights.highestProfitDay?.date ?? "")}
                  </Text>
                  <Text style={styles.insightDetail}>
                    {formatRM(insights.highestProfitDay?.netProfit ?? 0)} net profit
                  </Text>
                </View>
                <View style={styles.insightItem}>
                  <Text style={styles.insightLabel}>Highest order volume</Text>
                  <Text style={styles.insightValue}>
                    {formatDate(insights.highestOrderDay?.date ?? "")}
                  </Text>
                  <Text style={styles.insightDetail}>
                    {insights.highestOrderDay?.orderCount ?? 0} orders
                  </Text>
                </View>
                <View style={styles.insightItem}>
                  <Text style={styles.insightLabel}>Days with sales</Text>
                  <Text style={styles.insightValue}>{insights.activeDayCount}</Text>
                  <Text style={styles.insightDetail}>
                    {formatRM(insights.averageRevenuePerActiveDay)} average revenue
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Daily breakdown</Text>
            {isWideLayout ? (
              <View>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableHeaderText, styles.dateCell]}>Date</Text>
                  <Text style={[styles.tableHeaderText, styles.smallCell]}>Orders</Text>
                  <Text style={[styles.tableHeaderText, styles.smallCell]}>Units</Text>
                  <Text style={[styles.tableHeaderText, styles.moneyCell]}>Net revenue</Text>
                  <Text style={[styles.tableHeaderText, styles.moneyCell]}>Discounts</Text>
                  <Text style={[styles.tableHeaderText, styles.moneyCell]}>Net profit</Text>
                  <Text style={[styles.tableHeaderText, styles.moneyCell]}>Expenses</Text>
                </View>
                {report.trends.map((day) => (
                  <View key={day.date} style={styles.tableRow}>
                    <Text style={[styles.tableText, styles.dateCell]}>
                      {formatDate(day.date)}
                    </Text>
                    <Text style={[styles.tableText, styles.smallCell]}>{day.orderCount}</Text>
                    <Text style={[styles.tableText, styles.smallCell]}>{day.unitsSold}</Text>
                    <Text style={[styles.tableText, styles.moneyCell]}>{formatRM(day.netRevenue)}</Text>
                    <Text style={[styles.tableText, styles.moneyCell]}>{formatRM(day.discountAmount)}</Text>
                    <Text style={[styles.tableText, styles.moneyCell]}>{formatRM(day.netProfit)}</Text>
                    <Text style={[styles.tableText, styles.moneyCell]}>{formatRM(day.expenses)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.dailyCards}>
                {report.trends.map((day) => (
                  <View key={day.date} style={styles.dailyCard}>
                    <View style={styles.dailyHeader}>
                      <Text style={styles.dailyDate}>{formatDate(day.date)}</Text>
                      <Text style={styles.dailyOrders}>
                        {day.orderCount} orders · {day.unitsSold} units
                      </Text>
                    </View>
                    <View style={styles.dailyMetrics}>
                      <View style={styles.dailyMetric}>
                        <Text style={styles.metricLabel}>Net revenue</Text>
                        <Text style={styles.dailyValue}>{formatRM(day.netRevenue)}</Text>
                      </View>
                      <View style={styles.dailyMetric}>
                        <Text style={styles.metricLabel}>Discounts</Text>
                        <Text style={styles.dailyValue}>{formatRM(day.discountAmount)}</Text>
                      </View>
                      <View style={styles.dailyMetric}>
                        <Text style={styles.metricLabel}>Net profit</Text>
                        <Text style={styles.dailyValue}>{formatRM(day.netProfit)}</Text>
                      </View>
                      <View style={styles.dailyMetric}>
                        <Text style={styles.metricLabel}>Expenses</Text>
                        <Text style={styles.dailyValue}>{formatRM(day.expenses)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionState: { minHeight: 360 },
  flexItem: { flex: 1 },
  exportPanel: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.large,
    padding: 14,
    marginBottom: 16,
    ...UI.shadow,
  },
  exportPanelTitle: {
    color: UI.colors.inkMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 10,
  },
  exportButton: {
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
    backgroundColor: UI.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.small,
    paddingVertical: 11,
    alignItems: "center",
  },
  exportButtonText: { color: UI.colors.ink, fontSize: 12, fontWeight: "700" },
  summaryCard: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    padding: 18,
    borderWidth: 1,
    borderColor: UI.colors.border,
    ...UI.shadow,
  },
  summaryHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    color: UI.colors.ink,
    fontWeight: "700",
    marginBottom: 12,
  },
  introText: {
    color: UI.colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: -7,
    marginBottom: 15,
  },
  timezoneBadge: {
    borderRadius: UI.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: UI.colors.primarySoft,
  },
  timezoneText: { color: UI.colors.primary, fontSize: 10, fontWeight: "800" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryMetric: {
    width: "47%",
    minWidth: 125,
    flexGrow: 1,
    backgroundColor: UI.colors.surfaceMuted,
    borderRadius: UI.radius.small,
    padding: 12,
  },
  summaryMetricWide: { width: "23%", minWidth: 140 },
  metricLabel: {
    color: UI.colors.inkMuted,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  metricValue: { color: UI.colors.ink, fontSize: 16, fontWeight: "800" },
  accuracyText: {
    color: UI.colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 13,
  },
  card: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: UI.colors.border,
    ...UI.shadow,
  },
  metricControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 16,
  },
  metricButton: {
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderRadius: UI.radius.pill,
    backgroundColor: UI.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: UI.colors.border,
  },
  metricButtonActive: { backgroundColor: UI.colors.ink, borderColor: UI.colors.ink },
  metricButtonText: { color: UI.colors.inkMuted, fontSize: 11, fontWeight: "700" },
  metricButtonTextActive: { color: "#fff" },
  chart: {
    backgroundColor: UI.colors.surfaceMuted,
    borderRadius: UI.radius.medium,
    padding: 12,
  },
  chartScaleRow: { flexDirection: "row", justifyContent: "space-between" },
  chartScaleText: { color: UI.colors.inkMuted, fontSize: 10, fontWeight: "700" },
  chartBars: {
    height: 152,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 2,
    marginTop: 9,
  },
  chartColumn: { flex: 1, minWidth: 0 },
  positiveRegion: { height: 72, justifyContent: "flex-end", alignItems: "center" },
  fullHeightRegion: { height: 145 },
  negativeRegion: { height: 72, justifyContent: "flex-start", alignItems: "center" },
  chartBaseline: { height: 1, backgroundColor: UI.colors.inkSubtle },
  positiveBar: {
    width: "72%",
    minWidth: 2,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: UI.colors.primary,
  },
  negativeBar: {
    width: "72%",
    minWidth: 2,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: UI.colors.danger,
  },
  chartDateLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
  },
  chartDateText: { color: UI.colors.inkMuted, fontSize: 10 },
  insightGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  insightItem: {
    flexGrow: 1,
    width: "47%",
    minWidth: 145,
    padding: 13,
    borderRadius: UI.radius.medium,
    backgroundColor: UI.colors.primarySoft,
    borderWidth: 1,
    borderColor: "#FBC5CF",
  },
  insightLabel: { color: UI.colors.primary, fontSize: 10, fontWeight: "800" },
  insightValue: { color: UI.colors.ink, fontSize: 15, fontWeight: "800", marginTop: 5 },
  insightDetail: { color: UI.colors.inkMuted, fontSize: 11, marginTop: 3 },
  tableHeader: { backgroundColor: UI.colors.surfaceMuted },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: UI.colors.border,
    minHeight: 45,
    paddingHorizontal: 7,
  },
  tableHeaderText: { color: UI.colors.inkMuted, fontSize: 10, fontWeight: "800" },
  tableText: { color: UI.colors.ink, fontSize: 11 },
  dateCell: { flex: 1.45, minWidth: 0 },
  smallCell: { flex: 0.68, minWidth: 0, textAlign: "right" },
  moneyCell: { flex: 1.18, minWidth: 0, textAlign: "right" },
  dailyCards: { gap: 10 },
  dailyCard: {
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.medium,
    padding: 13,
    backgroundColor: UI.colors.surfaceMuted,
  },
  dailyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: UI.colors.border,
  },
  dailyDate: { color: UI.colors.ink, fontSize: 14, fontWeight: "800" },
  dailyOrders: { color: UI.colors.inkMuted, fontSize: 11 },
  dailyMetrics: { flexDirection: "row", flexWrap: "wrap", marginTop: 7 },
  dailyMetric: { width: "50%", paddingVertical: 6, paddingRight: 5 },
  dailyValue: { color: UI.colors.ink, fontSize: 13, fontWeight: "700" },
});
