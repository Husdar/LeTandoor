import type {
  OrderType,
  OrderStatus,
  OrderItemStatus,
  TableStatus,
  ReservationStatus,
  PaymentMethod,
  OrderSource,
} from "@le-tandoor/shared";

export interface MenuItemOption {
  id: string;
  name: string;
  priceDelta: string;
  groupName?: string | null;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  price: string;
  active: boolean;
  options: MenuItemOption[];
}

export interface MenuCategory {
  id: string;
  name: string;
  position: number;
  items: MenuItem[];
}

export interface RestaurantTable {
  id: string;
  name: string;
  seats: number;
  posX: number;
  posY: number;
  shape: "RONDE" | "CARREE" | "RECTANGLE";
  zone?: string | null;
  status: TableStatus;
}

export interface OrderItemOptionEntry {
  id: string;
  name: string;
  priceDelta: string;
}

export interface OrderItem {
  id: string;
  menuItemId?: string | null;
  nameSnapshot: string;
  unitPriceSnapshot: string;
  quantity: number;
  notes?: string | null;
  status: OrderItemStatus;
  cancelReason?: string | null;
  options: OrderItemOptionEntry[];
}

export interface OrderTableLink {
  id: string;
  tableId: string;
  table: RestaurantTable;
}

export interface Payment {
  id: string;
  amount: string;
  method: PaymentMethod;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  type: OrderType;
  status: OrderStatus;
  source: OrderSource;
  externalRef?: string | null;
  serverId?: string | null;
  server?: { id: string; name: string } | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  requestedFor?: string | null;
  prepMinutes?: number | null;
  subtotal: string;
  discountAmount: string;
  discountReason?: string | null;
  total: string;
  cancelReason?: string | null;
  createdAt: string;
  closedAt?: string | null;
  items: OrderItem[];
  orderTables: OrderTableLink[];
  payments: Payment[];
}

export interface Reservation {
  id: string;
  customerName: string;
  customerPhone?: string | null;
  partySize?: number | null;
  dateTime: string;
  notes?: string | null;
  status: ReservationStatus;
  tableId?: string | null;
  table?: RestaurantTable | null;
}

export interface ItemStat {
  name: string;
  quantity: number;
  revenue: number;
}

export interface DashboardStats {
  revenue: {
    today: number;
    yesterday: number;
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    lastMonth: number;
    thisYear: number;
    lastYear: number;
  };
  orderCounts: { today: number; thisWeek: number; thisMonth: number; thisYear: number };
  averageBasket: number;
  peakHours: { hour: number; count: number }[];
  topItems: ItemStat[];
  bottomItems: ItemStat[];
  channelSplit: Record<string, { count: number; revenue: number }>;
  cancellations: { count: number; itemsLoss: number };
  discounts: number;
  dailySeries: { date: string; revenue: number; count: number }[];
  generatedAt: string;
}

export interface AiInsight {
  id: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  content: string;
  createdAt: string;
}
