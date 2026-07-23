import { StyleSheet, Text } from "react-native";

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
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 8,
  },
});