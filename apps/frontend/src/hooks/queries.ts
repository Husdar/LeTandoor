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
  MarketingContact,
  MarketingCampaign,
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

export function useMarketingContacts() {
  return useQuery({
    queryKey: ["marketing-contacts"],
    queryFn: () => api.get<MarketingContact[]>("/marketing/contacts"),
  });
}

export function useMarketingCampaigns() {
  return useQuery({
    queryKey: ["marketing-campaigns"],
    queryFn: () => api.get<MarketingCampaign[]>("/marketing/campaigns"),
  });
}
