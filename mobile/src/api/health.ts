import { apiClient } from "./client";

export const checkApiHealth = async () => {
  const response = await apiClient.get("/health");
  return response.data;
};