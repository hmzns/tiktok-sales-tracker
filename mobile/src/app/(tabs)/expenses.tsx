import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Expense, ExpenseCategory, getExpenses } from "../../api/expenses";

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

      {expenses.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No expenses found.</Text>
        </View>
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
});