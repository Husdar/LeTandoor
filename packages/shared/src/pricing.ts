import { OrderType } from "./enums.js";

/**
 * Le Tandoor's menu prices (MenuItem.price) are the "à emporter" reference prices —
 * the sur-place price already has 20% subtracted to get there. So going the other way,
 * sur-place = emporter / (1 - 0.20) = emporter / 0.8, confirmed against the restaurant's
 * real price list (not a flat +20%, which would undercharge).
 */
export const EMPORTER_DISCOUNT = 0.2;

export function applyChannelPricing(basePrice: number, type: OrderType): number {
  if (type === OrderType.SUR_PLACE) {
    return Math.round((basePrice / (1 - EMPORTER_DISCOUNT)) * 100) / 100;
  }
  return basePrice;
}
