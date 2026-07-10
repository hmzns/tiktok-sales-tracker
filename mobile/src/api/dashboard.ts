import { apiClient } from "./client";

export const getDashboardSummary = async (year: number, month: number) => {
  const response = await apiClient.get("/dashboard/summary", {
    params: {
      year,
      month,
    },
  });

  return response.data.data;
};