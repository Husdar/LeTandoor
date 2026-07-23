import { z } from "zod";
import {
  OrderType,
  OrderStatus,
  OrderItemStatus,
  TableStatus,
  ReservationStatus,
  PaymentMethod,
  Role,
} from "./enums.js";

const roleValues = Object.values(Role) as [Role, ...Role[]];
const orderTypeValues = Object.values(OrderType) as [OrderType, ...OrderType[]];
const orderStatusValues = Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]];
const orderItemStatusValues = Object.values(OrderItemStatus) as [OrderItemStatus, ...OrderItemStatus[]];
const tableStatusValues = Object.values(TableStatus) as [TableStatus, ...TableStatus[]];
const reservationStatusValues = Object.values(ReservationStatus) as [ReservationStatus, ...ReservationStatus[]];
const paymentMethodValues = Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]];

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(roleValues),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const menuItemOptionSchema = z.object({
  name: z.string().min(1),
  priceDelta: z.number().default(0),
  groupName: z.string().optional(),
});

export const createMenuItemSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  active: z.boolean().default(true),
  options: z.array(menuItemOptionSchema).default([]),
});
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;

export const createMenuCategorySchema = z.object({
  name: z.string().min(1),
  position: z.number().int().default(0),
});
export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;

export const orderItemInputSchema = z.object({
  menuItemId: z.string(),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
  selectedOptionIds: z.array(z.string()).default([]),
});
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const createOrderSchema = z
  .object({
    type: z.enum(orderTypeValues),
    tableId: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    deliveryAddress: z.string().optional(),
    items: z.array(orderItemInputSchema).min(1),
  })
  .superRefine((data, ctx) => {
    if (data.type === OrderType.SUR_PLACE && !data.tableId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Une table est requise pour une commande sur place",
        path: ["tableId"],
      });
    }
    if (data.type === OrderType.LIVRAISON && !data.deliveryAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "L'adresse de livraison est requise",
        path: ["deliveryAddress"],
      });
    }
  });
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const addOrderItemSchema = orderItemInputSchema;

export const advanceOrderItemsSchema = z.object({
  status: z.enum(
    orderItemStatusValues.filter((s) => s !== OrderItemStatus.ANNULE) as [OrderItemStatus, ...OrderItemStatus[]]
  ),
});
export type AdvanceOrderItemsInput = z.infer<typeof advanceOrderItemsSchema>;

export const updateOrderItemStatusSchema = z
  .object({
    status: z.enum(orderItemStatusValues),
    reason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === OrderItemStatus.ANNULE && !data.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Un motif est requis pour annuler un article",
        path: ["reason"],
      });
    }
  });

export const updateOrderStatusSchema = z
  .object({
    status: z.enum(orderStatusValues),
    reason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === OrderStatus.ANNULEE && !data.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Un motif est requis pour annuler une commande",
        path: ["reason"],
      });
    }
  });

export const closeOrderSchema = z.object({
  paymentMethod: z.enum(paymentMethodValues),
  discountAmount: z.number().min(0).default(0),
  discountReason: z.string().optional(),
});
export type CloseOrderInput = z.infer<typeof closeOrderSchema>;

export const createTableSchema = z.object({
  name: z.string().min(1),
  seats: z.number().int().positive(),
  posX: z.number().default(0),
  posY: z.number().default(0),
  shape: z.enum(["RONDE", "CARREE", "RECTANGLE"]).default("CARREE"),
  zone: z.string().optional(),
});
export type CreateTableInput = z.infer<typeof createTableSchema>;

export const updateTableStatusSchema = z.object({
  status: z.enum(tableStatusValues),
});

export const createReservationSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  partySize: z.number().int().positive().optional(),
  dateTime: z.string().datetime(),
  notes: z.string().optional(),
  tableId: z.string().optional(),
});
export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const updateReservationStatusSchema = z.object({
  status: z.enum(reservationStatusValues),
});

export const createPrinterSchema = z.object({
  name: z.string().min(1),
  ip: z.string().min(1),
  port: z.number().int().default(9100),
  target: z.enum(["CUISINE", "CAISSE", "BAR"]),
});
export type CreatePrinterInput = z.infer<typeof createPrinterSchema>;

export const testPrinterSchema = z.object({
  ip: z.string().min(1),
  port: z.number().int().default(9100),
});
export type TestPrinterInput = z.infer<typeof testPrinterSchema>;

export const createManualRevenueSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ requise"),
  amount: z.number().positive(),
  label: z.string().max(200).optional(),
});
export type CreateManualRevenueInput = z.infer<typeof createManualRevenueSchema>;
