import { createClient } from '@supabase/supabase-js';
import { Product, Customer, Transaction, StoreSettings, User, Supplier, SalesReport, CartItem, UserRole, CustomerType } from '../types';

// Safely access environment variables
const getEnv = (key: string) => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key] || '';
    }
  } catch (e) {
    // ignore
  }
  
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      return process.env[key] || '';
    }
  } catch (e) {
    // ignore
  }
  
  return '';
};

// Logic: Prioritize LocalStorage settings (User input), fallback to Env Vars (Vercel config)
const getSupabaseConfig = () => {
  const localUrl = localStorage.getItem('yusa_sb_url');
  const localKey = localStorage.getItem('yusa_sb_key');

  if (localUrl && localKey) {
    return { url: localUrl, key: localKey, source: 'local' };
  }

  return {
    url: getEnv('VITE_SUPABASE_URL'),
    key: getEnv('VITE_SUPABASE_ANON_KEY'),
    source: 'env'
  };
};

const config = getSupabaseConfig();

// Initialize Supabase only if config exists
export const supabase = (config.url && config.key) 
  ? createClient(config.url, config.key)
  : null;

export const isUsingSupabase = !!supabase;

// --- MOCK DATA FOR DEMO/OFFLINE MODE ---
const MockAdmin: User = { id: 'demo-admin', username: 'admin', full_name: 'Admin Demo', role: UserRole.ADMIN, pin_code: '1234' };
const MockCashier: User = { id: 'demo-cashier', username: 'kasir', full_name: 'Kasir Demo', role: UserRole.CASHIER, pin_code: '1111' };

const MockCustomers: Customer[] = [
  { id: 'c1', name: 'Pelanggan Umum', type: CustomerType.GENERAL, phone: '-', debt: 0 },
  { id: 'c2', name: 'Toko Sejahtera (Agen)', type: CustomerType.AGEN, phone: '08123456789', debt: 0 },
  { id: 'c3', name: 'CV. Maju Jaya (Dist)', type: CustomerType.DISTRIBUTOR, phone: '08987654321', debt: 1500000 },
];

const MockProducts: Product[] = [
  { id: 'p1', sku: '899123456', name: 'Kopi Susu Gula Aren', category: 'Minuman', stock: 50, cost_price: 5000, price_general: 12000, price_agen: 10000, price_distributor: 9000 },
  { id: 'p2', sku: '899987654', name: 'Roti Bakar Coklat', category: 'Makanan', stock: 20, cost_price: 8000, price_general: 15000, price_agen: 13000, price_distributor: 12000 },
  { id: 'p3', sku: '123456789', name: 'Air Mineral 600ml', category: 'Minuman', stock: 100, cost_price: 2000, price_general: 5000, price_agen: 4000, price_distributor: 3500 },
];

export const DataService = {
  // --- UTILS ---
  getConnectionStatus: () => config.source,

  // --- AUTH & USERS ---
  login: async (username: string, pin: string): Promise<User | null> => {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('username', username).eq('pin_code', pin).single();
        if (data && !error) return data as User;
      } catch (e) { console.warn("Fallback to local"); }
    }
    // Demo Login
    if (username === 'admin' && pin === '1234') return MockAdmin;
    if (username === 'kasir' && pin === '1111') return MockCashier;
    return null;
  },

  getUsers: async (): Promise<User[]> => {
    if (!supabase) return [MockAdmin, MockCashier];
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    return (data as User[]) || [MockAdmin, MockCashier];
  },

  saveUser: async (user: Partial<User>): Promise<void> => {
    if (!supabase) throw new Error("Fitur simpan user hanya aktif dengan database Supabase.");
    const { id, ...payload } = user;
    if (id && id.length > 10) await supabase.from('profiles').update(payload).eq('id', id);
    else await supabase.from('profiles').insert([payload]);
  },

  deleteUser: async (id: string): Promise<void> => {
    if (!supabase) throw new Error("Fitur hapus user hanya aktif dengan database Supabase.");
    await supabase.from('profiles').delete().eq('id', id);
  },

  // --- PRODUCTS ---
  getProducts: async (): Promise<Product[]> => {
    if (!supabase) return MockProducts;
    const { data } = await supabase.from('products').select('*').order('name');
    return (data && data.length > 0) ? (data as Product[]) : MockProducts;
  },

  saveProduct: async (product: Product): Promise<void> => {
    if (!supabase) return;
    const { id, ...payload } = product;
    if (id && id.length > 10) await supabase.from('products').update(payload).eq('id', id);
    else await supabase.from('products').insert([payload]);
  },

  deleteProduct: async (id: string): Promise<void> => {
    if (!supabase) return;
    await supabase.from('products').delete().eq('id', id);
  },

  // --- CUSTOMERS ---
  getCustomers: async (): Promise<Customer[]> => {
    if (!supabase) return MockCustomers;
    const { data } = await supabase.from('customers').select('*').order('name');
    return (data && data.length > 0) ? (data as Customer[]) : MockCustomers;
  },

  saveCustomer: async (customer: Customer): Promise<void> => {
    if (!supabase) return;
    const { id, ...payload } = customer;
    if (id && id.length > 10) await supabase.from('customers').update(payload).eq('id', id);
    else await supabase.from('customers').insert([payload]);
  },

  deleteCustomer: async (id: string): Promise<void> => {
    if (!supabase) return;
    await supabase.from('customers').delete().eq('id', id);
  },

  // --- SUPPLIERS ---
  getSuppliers: async (): Promise<Supplier[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('suppliers').select('*').order('name');
    return (data as Supplier[]) || [];
  },

  saveSupplier: async (supplier: Supplier): Promise<void> => {
    if (!supabase) return;
    const { id, ...payload } = supplier;
    if (id && id.length > 10) await supabase.from('suppliers').update(payload).eq('id', id);
    else await supabase.from('suppliers').insert([payload]);
  },

  deleteSupplier: async (id: string): Promise<void> => {
    if (!supabase) return;
    await supabase.from('suppliers').delete().eq('id', id);
  },

  // --- SETTINGS ---
  getSettings: async (): Promise<StoreSettings> => {
    if (supabase) {
        const { data } = await supabase.from('store_settings').select('*').single();
        if (data) return data as StoreSettings;
    }
    return { name: 'YusaPos Store', address: 'Mode Demo / Offline', phone: '-', footer_message: 'Terima Kasih', printer_width: '58mm' };
  },

  saveSettings: async (settings: StoreSettings): Promise<void> => {
    if (!supabase) return;
    const { data } = await supabase.from('store_settings').select('id').single();
    if (data) await supabase.from('store_settings').update(settings).eq('id', data.id);
    else await supabase.from('store_settings').insert([settings]);
  },

  // --- TRANSACTIONS ---
  createTransaction: async (transaction: Transaction): Promise<void> => {
    if (!supabase) { console.log("Transaction saved (Mock):", transaction); return; }
    
    const { data: txData, error: txError } = await supabase.from('transactions').insert([{
      invoice_number: transaction.invoice_number,
      date: transaction.date,
      cashier_id: transaction.cashier_id,
      cashier_name: transaction.cashier_name,
      customer_id: transaction.customer_id,
      customer_name: transaction.customer_name,
      customer_type: transaction.customer_type,
      total_amount: transaction.total_amount,
      payment_method: transaction.payment_method,
      amount_paid: transaction.amount_paid,
      change: transaction.change
    }]).select().single();

    if (txError || !txData) throw new Error("Gagal: " + txError?.message);

    const transactionId = txData.id;
    const itemsPayload = transaction.items.map(item => ({
      transaction_id: transactionId,
      product_id: item.id,
      product_name: item.name,
      qty: item.qty,
      cost_price: item.cost_price,
      price: item.selected_price,
      subtotal: item.subtotal
    }));

    await supabase.from('transaction_items').insert(itemsPayload);
    // Stock update logic omitted for brevity in sync but exists in backend logic
  },

  getTransactions: async (): Promise<Transaction[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('transactions').select(`*, items:transaction_items (*)`).order('date', { ascending: false });
    return data ? data.map((t: any) => ({
      ...t,
      items: t.items ? t.items.map((i: any) => ({
        id: i.product_id, name: i.product_name, qty: i.qty, selected_price: i.price, subtotal: i.subtotal,
        sku: '', category: '', stock: 0, price_general: 0, price_agen: 0, price_distributor: 0, discount: 0
      })) : []
    })) : [];
  },

  getReports: async (period: 'day' | 'month' | 'year'): Promise<SalesReport[]> => {
    // Basic mock reporting logic
    const transactions = await DataService.getTransactions();
    return []; 
  }
};