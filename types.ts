
export enum UserRole {
  ADMIN = 'admin',
  CASHIER = 'cashier'
}

export enum CustomerType {
  GENERAL = 'general',
  AGEN = 'agen',
  DISTRIBUTOR = 'distributor'
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  pin_code?: string; // For simulation
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  cost_price: number;
  price_general: number;
  price_agen: number;
  price_distributor: number;
  image_url?: string;
  supplier_id?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  address?: string;
  debt: number;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
}

export interface CartItem extends Product {
  qty: number;
  selected_price: number; // Price based on customer type
  discount: number; // Percentage or Fixed amount logic
  subtotal: number;
}

export interface Transaction {
  id: string;
  invoice_number: string;
  date: string; // ISO string
  cashier_id: string;
  cashier_name: string;
  customer_id?: string;
  customer_name: string;
  customer_type: CustomerType;
  items: CartItem[];
  total_amount: number;
  payment_method: 'cash' | 'qris' | 'debt';
  amount_paid: number;
  change: number;
}

export interface StoreSettings {
  name: string;
  address: string;
  phone: string;
  footer_message: string;
  printer_width: '58mm' | '80mm';
}

export interface SalesReport {
  date: string;
  total_sales: number;
  total_profit: number;
  transaction_count: number;
}

// --- NEW TYPES FOR PURCHASING ---
export interface PurchaseItem {
  product_id: string;
  product_name: string;
  qty: number;
  cost_price: number; // Harga Beli dari supplier
  subtotal: number;
}

export interface Purchase {
  id: string;
  invoice_number: string; // No Nota dari Supplier
  date: string;
  supplier_id: string;
  supplier_name: string;
  admin_id: string;
  items: PurchaseItem[];
  total_amount: number;
}
