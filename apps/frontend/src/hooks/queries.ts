import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { MenuCategory, RestaurantTable, Order, Reservation, DashboardStats, AiInsight } from "../types";

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
