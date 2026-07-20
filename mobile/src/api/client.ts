import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const API_KEY = process.env.EXPO_PUBLIC_BACKEND_API_KEY;

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    "X-API-KEY": API_KEY,
  },
});