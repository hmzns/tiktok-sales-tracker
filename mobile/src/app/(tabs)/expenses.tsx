import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { apiClient } from "../../api/client";
import {
  Alert,
  Pressable,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { Expense, ExpenseCategory, deleteExpense, getExpenses } from "../../api/expenses";
import { UI } from "../../constants/ui";
import { FloatingBackToTop } from "../../components/FloatingBackToTop";

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

const CATEGORY_FILTERS: (ExpenseCategory | "ALL")[] = [
  "ALL",
  "PACKAGING",
  "ADS",
  "SHIPPING",
  "SUPPLIES",
  "EQUIPMENT",
  "SALARY",
  "OTHER",
];

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState<ExpenseCategory | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadExpenses = async () => {
    try {
      setError(null);

      const result = await getExpenses(1, 20, search, categoryFilter);

      setExpenses(result.expenses);
      setTotal(result.meta.total);

      const amount = result.expenses.reduce(
        (sum, expense) => sum + expense.amount,
        0
      );

      setTotalAmount(amount);
    } catch (err) {
      setError("Failed to load expenses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [categoryFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadExpenses();
  };

  const handleDeleteExpense = async (expenseId: string) => {
    const deleteSelectedExpense = async () => {
      try {
        await deleteExpense(expenseId);
        await loadExpenses();
      } catch (err: any) {
        const message =
          err?.response?.data?.message ?? "Failed to delete expense";

        Alert.alert("Error", message);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Are you sure you want to delete this expense?"
      );

      if (confirmed) {
        await deleteSelectedExpense();
      }

      return;
    }

    Alert.alert(
      "Delete Expense",
      "Are you sure you want to delete this expense?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: deleteSelectedExpense,
        },
      ]
    );
  };

  if (loading) {
    return (
      <LoadingState
        title="Getting all the money you spent..."
        message="Stop spending on ZUS Coffee if you want to earn more profit."
      />
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorState
          title="Failed to load expenses"
          message="Please check your connection or backend API, then try again."
          onRetry={loadExpenses}
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

  const handleExportExpensesCsv = async () => {
    if (Platform.OS !== "web") {
      Alert.alert(
        "Export not available",
        "Expenses CSV export is currently available on the web version only."
      );
      return;
    }

    try {
      const response = await apiClient.get("/expenses", {
        params: {
          page: 1,
          limit: 1000,
        },
      });

      const expenses = response.data.data ?? [];

      if (expenses.length === 0) {
        Alert.alert("No expenses", "There are no expenses to export.");
        return;
      }

      const rows: unknown[][] = [
        ["TikTok Sales Tracker Expenses Export"],
        ["Export Date", new Date().toLocaleString()],
        [],
        ["Title", "Category", "Amount", "Date", "Note"],
        ...expenses.map((expense: any) => [
          expense.title ?? expense.name ?? "-",
          expense.category,
          expense.amount,
          expense.date,
          expense.note ?? expense.description ?? "-",
        ]),
      ];

      const csv = buildCsv(rows);
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      Alert.alert("Export failed", "Unable to export expenses.");
    }
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
        <View style={styles.flexItem}>
          <Text style={styles.title}>Expenses</Text>
          <Text style={styles.subtitle}>
            You might wanna think twice on your spending
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerExportButton} onPress={handleExportExpensesCsv}>
            <Text style={styles.headerExportButtonText}>Export</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.headerAddButton,
              pressed && styles.primaryPressed,
            ]}
            onPress={() => router.push("/add-expense" as any)}
            accessibilityLabel="Add expense"
          >
            <Text style={styles.headerAddButtonText}>+ Add expense</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>Shown total</Text>
          <Text style={styles.summaryValue}>{formatRM(totalAmount)}</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countValue}>{total}</Text>
          <Text style={styles.countLabel}>records</Text>
        </View>
      </View>

      <View style={styles.toolsCard}>
        <View style={styles.searchRow}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search expenses"
            placeholderTextColor={UI.colors.inkSubtle}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={loadExpenses}
            returnKeyType="search"
          />
          <Pressable style={styles.searchButton} onPress={loadExpenses}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>

        <Text style={styles.filterLabel}>FILTER BY CATEGORY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {CATEGORY_FILTERS.map((category) => (
            <Pressable
              key={category}
              style={[
                styles.filterChip,
                categoryFilter === category && styles.activeFilterChip,
              ]}
              onPress={() => {
                setCategoryFilter(category);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  categoryFilter === category && styles.activeFilterChipText,
                ]}
              >
                {category === "ALL" ? "All" : category.toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.toolFooter}>
          <Text style={styles.resultText}>
            Showing {expenses.length} of {total}
          </Text>
        </View>
      </View>

      {expenses.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          message="Add expenses such as packaging, delivery, ads, or supplies."
        />
      ) : (
        expenses.map((expense) => (
          <View key={expense.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.flexItem}>
                <Text style={styles.expenseTitle}>{expense.title}</Text>
                <Text style={styles.expenseDate}>
                  {formatDate(expense.expenseDate)}
                </Text>
              </View>

              <View style={styles.amountBox}>
                <Text style={styles.amount}>{formatRM(expense.amount)}</Text>
              </View>
            </View>

            <Text style={styles.categoryBadge}>
              {expense.category.toLowerCase()}
            </Text>

            {expense.description ? (
              <View style={styles.descriptionBox}>
                <Text style={styles.description}>{expense.description}</Text>
              </View>
            ) : null}

            <View style={styles.cardActions}>
              <Pressable
                style={styles.editButton}
                onPress={() =>
                  router.push({
                    pathname: "/edit-expense" as any,
                    params: { expenseId: expense.id },
                  })
                }
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>

              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteExpense(expense.id)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
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
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
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
  headerActions: { flexDirection: "row", gap: 8 },
  headerExportButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.small,
    paddingHorizontal: 13,
  },
  headerExportButtonText: { color: UI.colors.ink, fontSize: 12, fontWeight: "700" },
  headerAddButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.colors.primary,
    borderRadius: UI.radius.small,
    paddingHorizontal: 16,
    ...UI.shadow,
  },
  headerAddButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryAction: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.small,
  },
  secondaryActionText: {
    color: UI.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  primaryAction: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.colors.primary,
    borderRadius: UI.radius.small,
  },
  primaryPressed: {
    backgroundColor: UI.colors.primaryPressed,
    transform: [{ scale: 0.98 }],
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  summaryCard: {
    minHeight: 128,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: UI.colors.ink,
    borderRadius: UI.radius.large,
    padding: 22,
    marginBottom: 16,
    overflow: "hidden",
    ...UI.shadow,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#D0D5DD",
    marginBottom: 8,
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  countPill: {
    minWidth: 72,
    alignItems: "center",
    backgroundColor: "#FFFFFF14",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  countValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  countLabel: {
    color: "#D0D5DD",
    fontSize: 11,
    marginTop: 2,
  },
  toolsCard: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    padding: 14,
    borderWidth: 1,
    borderColor: UI.colors.border,
    marginBottom: 16,
    ...UI.shadow,
  },
  searchRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: UI.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.medium,
    paddingLeft: 14,
  },
  searchGlyph: {
    color: UI.colors.inkMuted,
    fontSize: 22,
    marginRight: 8,
    transform: [{ rotate: "-15deg" }],
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
    borderRadius: 11,
    backgroundColor: UI.colors.ink,
    paddingHorizontal: 16,
    margin: 4,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  filterLabel: {
    color: UI.colors.inkMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 9,
    marginLeft: 2,
  },
  filterScroll: {
    marginHorizontal: -14,
  },
  filterContent: {
    paddingHorizontal: 14,
  },
  filterChip: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 13,
    marginRight: 7,
  },
  activeFilterChip: {
    backgroundColor: UI.colors.primarySoft,
    borderColor: "#F9A8B8",
  },
  filterChipText: {
    color: UI.colors.inkMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  activeFilterChipText: {
    color: UI.colors.primary,
    fontWeight: "700",
  },
  toolFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
    paddingTop: 12,
    marginTop: 14,
    paddingHorizontal: 2,
  },
  resultText: {
    color: UI.colors.inkMuted,
    fontSize: 12,
  },
  exportLink: {
    paddingVertical: 5,
    paddingLeft: 12,
  },
  exportButtonText: {
    color: UI.colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: UI.colors.border,
    ...UI.shadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  flexItem: {
    flex: 1,
  },
  expenseTitle: {
    color: UI.colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  expenseDate: {
    marginTop: 4,
    fontSize: 12,
    color: UI.colors.inkMuted,
  },
  amountBox: {
    backgroundColor: UI.colors.primarySoft,
    borderRadius: UI.radius.small,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  amount: {
    color: UI.colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  categoryBadge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    color: UI.colors.inkMuted,
    backgroundColor: UI.colors.surfaceMuted,
    borderRadius: UI.radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 9,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  descriptionBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: UI.colors.surfaceMuted,
    borderRadius: UI.radius.small,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: UI.colors.inkMuted,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
    marginTop: 14,
    paddingTop: 12,
  },
  editButton: {
    flex: 1,
    backgroundColor: UI.colors.ink,
    borderRadius: UI.radius.small,
    paddingVertical: 10,
    alignItems: "center",
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  deleteButton: {
    backgroundColor: UI.colors.dangerSoft,
    borderRadius: UI.radius.small,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  deleteButtonText: {
    color: UI.colors.danger,
    fontSize: 13,
    fontWeight: "700",
  },
});
