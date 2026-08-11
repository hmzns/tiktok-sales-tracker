import { Alert, Platform } from "react-native";

export const showSuccessMessage = (message: string) => {
  if (Platform.OS === "web") {
    window.alert(message);
    return;
  }

  Alert.alert("Success", message);
};