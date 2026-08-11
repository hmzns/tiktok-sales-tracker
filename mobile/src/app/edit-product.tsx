import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import {
  getProductById,
  updateProduct,
} from "../api/products";
import {
  getProductCategories,
  ProductCategory,
} from "../api/productCategories";
import { FieldError } from "../components/FieldError";
import { LoadingState } from "../components/LoadingState";
import { AppButton } from "../components/ui/AppButton";
import { UI } from "../constants/ui";
import { sharedStyles } from "../constants/sharedStyles";
import {
  getNonNegativeNumberError,
  getWholeNumberNonNegativeError,
} from "../utils/formValidation";
import { showSuccessMessage } from "../utils/showSuccessMessage";

export default function EditProductScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();

  const [categories, setCategories] = useState<ProductCategory[]>([]);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    costPrice: "",
    sellPrice: "",
    stock: "",
  });

  const loadProduct = useCallback(async () => {
    if (!productId) return;

    try {
      setLoading(true);

      const [product, categoryList] = await Promise.all([
        getProductById(productId),
        getProductCategories(),
      ]);

      setCategories(
        categoryList.filter(
          (category) => category.isActive || category.id === product.categoryId
        )
      );

      setName(product.name);
      setSku(product.sku);
      setCostPrice(String(product.costPrice));
      setSellPrice(String(product.sellPrice));
      setStock(String(product.stock));
      setCategoryId(product.categoryId);
      setIsActive(product.isActive);
    } catch {
      Alert.alert("Unable to load product", "Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  const validateProductNumbers = () => {
    const errors = {
      costPrice: getNonNegativeNumberError(
        costPrice,
        "Cost price must be 0 or more."
      ),
      sellPrice: getNonNegativeNumberError(
        sellPrice,
        "Sell price must be 0 or more."
      ),
      stock: getWholeNumberNonNegativeError(stock),
    };

    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleUpdateProduct = async () => {
    if (!productId) return;

    const productNumbersAreValid = validateProductNumbers();

    if (!name.trim() || !sku.trim()) {
      Alert.alert("Error", "Product name and SKU are required.");
      return;
    }

    const parsedCostPrice = Number(costPrice);
    const parsedSellPrice = Number(sellPrice);
    const parsedStock = Number(stock);

    if (!productNumbersAreValid) {
      return;
    }

    try {
      setSaving(true);

      await updateProduct(productId, {
        name: name.trim(),
        sku: sku.trim(),
        costPrice: parsedCostPrice,
        sellPrice: parsedSellPrice,
        stock: parsedStock,
        categoryId,
        isActive,
      });

      showSuccessMessage("Product updated successfully.");

      router.replace("/products" as any);
    } catch {
      Alert.alert("Save failed", "Unable to update this product. Please review the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  if (loading) {
    return <LoadingState title="Loading product" message="Getting the latest product details." />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Text accessibilityRole="header" style={styles.title}>Product details</Text>
      <Text style={styles.subtitle}>Update product details below.</Text>

      <View style={styles.formCard}>

      <Text style={styles.label}>Product Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: Lipmatte Red"
        placeholderTextColor={UI.colors.inkSubtle}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>SKU</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: LM-RED-01"
        placeholderTextColor={UI.colors.inkSubtle}
        value={sku}
        onChangeText={setSku}
      />

      <Text style={styles.label}>Cost Price</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 10"
        placeholderTextColor={UI.colors.inkSubtle}
        value={costPrice}
        onChangeText={(value) => {
          setCostPrice(value);
          setFieldErrors((current) => ({
            ...current,
            costPrice: getNonNegativeNumberError(
              value,
              "Cost price must be 0 or more."
            ),
          }));
        }}
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <FieldError message={fieldErrors.costPrice} />

      <Text style={styles.label}>Sell Price</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 20"
        placeholderTextColor={UI.colors.inkSubtle}
        value={sellPrice}
        onChangeText={(value) => {
          setSellPrice(value);
          setFieldErrors((current) => ({
            ...current,
            sellPrice: getNonNegativeNumberError(
              value,
              "Sell price must be 0 or more."
            ),
          }));
        }}
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <FieldError message={fieldErrors.sellPrice} />

      <Text style={styles.label}>Stock</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 50"
        placeholderTextColor={UI.colors.inkSubtle}
        value={stock}
        onChangeText={(value) => {
          setStock(value);
          setFieldErrors((current) => ({
            ...current,
            stock: getWholeNumberNonNegativeError(value),
          }));
        }}
        keyboardType="numeric"
        inputMode="numeric"
      />
      <FieldError message={fieldErrors.stock} />

      <Text style={styles.label}>Category</Text>

      <Pressable
        style={[
          styles.categoryChip,
          categoryId === null && styles.activeCategoryChip,
        ]}
        onPress={() => setCategoryId(null)}
        accessibilityRole="button"
        accessibilityState={{ selected: categoryId === null }}
      >
        <Text
          style={[
            styles.categoryChipText,
            categoryId === null && styles.activeCategoryChipText,
          ]}
        >
          No Category
        </Text>
      </Pressable>

      {categories.map((category) => (
        <Pressable
          key={category.id}
          style={[
            styles.categoryChip,
            categoryId === category.id && styles.activeCategoryChip,
          ]}
          onPress={() => setCategoryId(category.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: categoryId === category.id }}
        >
          <Text
            style={[
              styles.categoryChipText,
              categoryId === category.id && styles.activeCategoryChipText,
            ]}
          >
            {category.name}
            {!category.isActive ? " (Inactive)" : ""}
          </Text>
        </Pressable>
      ))}

      <Text style={styles.label}>Product Status</Text>

      <View style={styles.statusRow}>
        <Pressable
          style={[
          styles.statusButton,
          isActive && styles.activeStatusButton,
        ]}
        onPress={() => setIsActive(true)}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
      >
        <Text
          style={[
            styles.statusButtonText,
            isActive && styles.activeStatusButtonText,
          ]}
        >
          Active
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.statusButton,
          !isActive && styles.inactiveStatusButton,
        ]}
        onPress={() => setIsActive(false)}
        accessibilityRole="button"
        accessibilityState={{ selected: !isActive }}
      >
        <Text
          style={[
            styles.statusButtonText,
            !isActive && styles.inactiveStatusButtonText,
          ]}
        >
          Inactive
        </Text>
      </Pressable>
    </View>

      <View style={styles.actionStack}>
      <AppButton
        label="Save Changes"
        loadingLabel="Saving..."
        onPress={handleUpdateProduct}
        disabled={saving}
        loading={saving}
      />
      <AppButton label="Cancel" variant="secondary" onPress={() => router.back()} />
      </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { ...sharedStyles.screen },
  container: {
    ...sharedStyles.formContent,
    flexGrow: 1,
  },
  formCard: { ...sharedStyles.card },
  title: {
    ...sharedStyles.pageTitle,
  },
  subtitle: {
    ...sharedStyles.pageSubtitle,
  },
  label: {
    ...sharedStyles.label,
  },
  input: {
    ...sharedStyles.input,
    ...sharedStyles.inputWeb,
    marginBottom: 14,
  },
  categoryChip: {
    ...sharedStyles.chip,
    marginBottom: 10,
  },
  activeCategoryChip: {
    ...sharedStyles.chipSelected,
  },
  categoryChipText: {
    ...sharedStyles.chipText,
  },
  activeCategoryChipText: {
    ...sharedStyles.chipTextSelected,
  },
	actionStack: { gap: UI.spacing.sm, marginTop: UI.spacing.xl },
	statusRow: {
		flexDirection: "row",
		gap: 10,
		marginBottom: 16,
	},
	statusButton: {
		flex: 1,
		backgroundColor: UI.colors.surface,
		borderWidth: 1,
		borderColor: UI.colors.borderStrong,
		borderRadius: 10,
		padding: 12,
		alignItems: "center",
	},
	activeStatusButton: {
		backgroundColor: UI.colors.successSoft,
		borderColor: UI.colors.success,
	},
	inactiveStatusButton: {
		backgroundColor: UI.colors.dangerSoft,
		borderColor: UI.colors.danger,
	},
	statusButtonText: {
		fontSize: 13,
		fontWeight: "800",
		color: UI.colors.ink,
	},
	activeStatusButtonText: {
		color: UI.colors.success,
	},
	inactiveStatusButtonText: {
		color: UI.colors.danger,
	},
});
