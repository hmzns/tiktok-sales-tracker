import { StyleSheet, Text } from "react-native";
import { UI } from "../constants/ui";

type FieldErrorProps = {
  message?: string;
};

export function FieldError({ message }: FieldErrorProps) {
  if (!message) {
    return null;
  }

  return <Text style={styles.errorText}>{message}</Text>;
}

const styles = StyleSheet.create({
  errorText: {
    color: UI.colors.danger,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 6,
  },
});
