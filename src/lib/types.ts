export type Category =
  | "sticks"
  | "skates"
  | "helmets"
  | "gloves"
  | "pads"
  | "jerseys"
  | "pucks"
  | "goalie-gear"
  | "accessories";

export type Position = "player" | "goalie" | "any";
export type Hand = "left" | "right" | "n/a";

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: Category;
  brand: string;
  priceCents: number;
  salePriceCents: number | null;
  position: Position;
  hand: Hand;
  size: string | null;
  flex: number | null;
  stock: number;
  rating: number;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: "customer" | "admin";
  createdAt: string;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface Cart {
  sessionId: string;
  lines: CartLine[];
  updatedAt: string;
}

export interface OrderLine {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

export interface Order {
  id: string;
  userId: string | null;
  guestEmail: string | null;
  lines: OrderLine[];
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  status: OrderStatus;
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  createdAt: string;
}

export type DemoMode = "normal" | "slow" | "flaky" | "broken";
