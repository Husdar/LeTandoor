import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  MenuCategory,
  RestaurantTable,
  Order,
  Reservation,
  DashboardStats,
  AiInsight,
  ManualRevenueEntry,
  CustomerProfile,
} from "../types";

export function useMenu() {
  return useQuery({
    queryKey: ["menu"],
    queryFn: () => api.get<MenuCategory[]>("/menu/categories"),
  });
}

export function useTables() {
  return useQuery({
    queryKey: ["tables"],
    queryFn: () => api.get<RestaurantTable[]>("/tables"),
  });
}

export function useActiveOrders() {
  return useQuery({
    queryKey: ["orders", "active"],
    queryFn: () => api.get<Order[]>("/orders/active"),
    refetchInterval: 15000,
  });
}

export function useReservations() {
  return useQuery({
    queryKey: ["reservations"],
    queryFn: () => api.get<Reservation[]>("/reservations"),
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => api.get<DashboardStats>("/analytics/dashboard"),
  });
}

export function useAiInsights() {
  return useQuery({
    queryKey: ["ai-insights"],
    queryFn: () => api.get<AiInsight[]>("/ai-insights"),
  });
}

export function useManualRevenue(from: string, to: string) {
  return useQuery({
    queryKey: ["manual-revenue", from, to],
    queryFn: () => api.get<ManualRevenueEntry[]>(`/manual-revenue?from=${from}&to=${to}`),
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<CustomerProfile[]>("/customers"),
  });
}

export interface OrderHistoryFilters {
  search?: string;
  from?: string;
  to?: string;
}

export function useOrderHistory(filters: OrderHistoryFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();

  return useQuery({
    queryKey: ["orders", "history", filters.search, filters.from, filters.to],
    queryFn: () => api.get<Order[]>(`/orders/history${qs ? `?${qs}` : ""}`),
  });
}
