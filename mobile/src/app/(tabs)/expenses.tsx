import { router } from "expo-router";
import { useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import {
  ActivityIndicator,
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
import { Expense, ExpenseCategory, deleteExpense, getExpenses } from "../../api/expenses";

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
  }, []);

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
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading expenses...</Text>
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Expenses</Text>
      <Text style={styles.subtitle}>Total expenses: {total}</Text>

      <Pressable style={styles.exportButton} onPress={handleExportExpensesCsv}>
        <Text style={styles.exportButtonText}>Export Expenses CSV</Text>
      </Pressable>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Shown Total</Text>
        <Text style={styles.summaryValue}>{formatRM(totalAmount)}</Text>
      </View>

      <Pressable
        style={styles.addButton}
        onPress={() => router.push("/add-expense" as any)}
      >
        <Text style={styles.addButtonText}>Add Expense</Text>
      </Pressable>

      <TextInput
        style={styles.searchInput}
        placeholder="Search expense title..."
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={loadExpenses}
      />

      <Pressable style={styles.searchButton} onPress={loadExpenses}>
        <Text style={styles.searchButtonText}>Search</Text>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
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
              {category}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable style={styles.searchButton} onPress={loadExpenses}>
        <Text style={styles.searchButtonText}>Apply Filter</Text>
      </Pressable>

      {!loading && expenses.length === 0 ? (
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

              <Text style={styles.amount}>{formatRM(expense.amount)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Category</Text>
              <Text style={styles.value}>{expense.category}</Text>
            </View>

            {expense.description ? (
              <View style={styles.descriptionBox}>
                <Text style={styles.description}>{expense.description}</Text>
              </View>
            ) : null}

            <Pressable
              style={styles.editButton}
              onPress={() =>
                router.push({
                  pathname: "/edit-expense" as any,
                  params: { expenseId: expense.id },
                })
              }
            >
              <Text style={styles.editButtonText}>Edit Expense</Text>
            </Pressable>

            <Pressable
              style={styles.deleteButton}
              onPress={() => handleDeleteExpense(expense.id)}
            >
              <Text style={styles.deleteButtonText}>Delete Expense</Text>
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
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "900",
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
  expenseTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  expenseDate: {
    marginTop: 4,
    fontSize: 13,
    color: "#666",
  },
  amount: {
    fontSize: 16,
    fontWeight: "900",
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
  descriptionBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#f7f7f7",
    borderRadius: 10,
  },
  description: {
    fontSize: 13,
    color: "#555",
  },
  searchInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  searchButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  filterScroll: {
    marginBottom: 10,
  },
  filterChip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  activeFilterChip: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  filterChipText: {
    color: "#333",
    fontSize: 12,
    fontWeight: "700",
  },
  activeFilterChipText: {
    color: "#fff",
  },
  editButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
  },
  editButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  deleteButton: {
    backgroundColor: "#ffecec",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 8,
  },
  deleteButtonText: {
    color: "#cc3333",
    fontWeight: "800",
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