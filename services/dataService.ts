import { createClient } from '@supabase/supabase-js';
import { Product, Customer, Transaction, StoreSettings, User, Supplier, SalesReport, CartItem, UserRole, CustomerType, Purchase } from '../types';

// Safely access environment variables with multiple fallbacks
const getEnv = (key: string) => {
  let val = '';
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      val = import.meta.env[key] || '';
    }
  } catch (e) {}
  
  if (!val) {
    try {
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env) {
        // @ts-ignore
        val = process.env[key] || '';
      }
    } catch (e) {}
  }
  return val;
};

// Robust config retrieval that won't crash on LocalStorage errors
const getSupabaseConfig = () => {
  let localUrl = null;
  let localKey = null;

  try {
    localUrl = localStorage.getItem('yusa_sb_url');
    localKey = localStorage.getItem('yusa_sb_key');
  } catch (e) {
    console.warn("LocalStorage unavailable:", e);
  }

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

// Initialize Supabase safely
// prevent crash if URL is malformed or missing
export let supabase: any = null;
export let isUsingSupabase = false;

try {
  if (config.url && config.key && config.url.startsWith('http')) {
    supabase = createClient(config.url, config.key);
    isUsingSupabase = true;
  }
} catch (e) {
  console.error("Supabase initialization failed:", e);
  supabase = null;
  isUsingSupabase = false;
}

// --- MOCK DATA FOR DEMO/OFFLINE MODE ---
const MockAdmin: User = { id: '00000000-0000-0000-0000-000000000001', username: 'admin', full_name: 'Admin Demo', role: UserRole.ADMIN, pin_code: '1234' };
const MockCashier: User = { id: '00000000-0000-0000-0000-000000000002', username: 'kasir', full_name: 'Kasir Demo', role: UserRole.CASHIER, pin_code: '1111' };

const MockCustomers: Customer[] = [
  { id: '10000000-0000-0000-0000-000000000001', name: 'Pelanggan Umum', type: CustomerType.GENERAL, phone: '-', debt: 0 },
  { id: '10000000-0000-0000-0000-000000000002', name: 'Toko Sejahtera (Agen)', type: CustomerType.AGEN, phone: '08123456789', debt: 0 },
  { id: '10000000-0000-0000-0000-000000000003', name: 'CV. Maju Jaya (Dist)', type: CustomerType.DISTRIBUTOR, phone: '08987654321', debt: 1500000 },
];

const MockProducts: Product[] = [
  { id: '20000000-0000-0000-0000-000000000001', sku: '899123456', name: 'Kopi Susu Gula Aren', category: 'Minuman', stock: 50, cost_price: 5000, price_general: 12000, price_agen: 10000, price_distributor: 9000 },
  { id: '20000000-0000-0000-0000-000000000002', sku: '899987654', name: 'Roti Bakar Coklat', category: 'Makanan', stock: 20, cost_price: 8000, price_general: 15000, price_agen: 13000, price_distributor: 12000 },
  { id: '20000000-0000-0000-0000-000000000003', sku: '123456789', name: 'Air Mineral 600ml', category: 'Minuman', stock: 100, cost_price: 2000, price_general: 5000, price_agen: 4000, price_distributor: 3500 },
];

export const DataService = {
  getConnectionStatus: () => config.source,

  // --- AUTH & USERS ---
  login: async (username: string, pin: string): Promise<User | null> => {
    // 1. Jika terkoneksi Supabase, HANYA cek database.
    if (isUsingSupabase && supabase) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('username', username).eq('pin_code', pin).single();
        if (error || !data) return null;
        return data as User;
      } catch (e) {
        console.warn("Auth Error:", e);
        return null;
      }
    }

    // 2. Mode Demo (Fallback hanya jika Supabase OFF)
    if (!isUsingSupabase) {
       if (username === 'admin' && pin === '1234') return MockAdmin;
       if (username === 'kasir' && pin === '1111') return MockCashier;
    }
    
    return null;
  },

  getUsers: async (): Promise<User[]> => {
    if (!isUsingSupabase) return [MockAdmin, MockCashier];
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    return (data as User[]) || [];
  },

  saveUser: async (user: Partial<User>): Promise<void> => {
    if (!isUsingSupabase) throw new Error("Fitur ini perlu Database.");
    const { id, ...payload } = user;
    if (id && id.length > 10) await supabase.from('profiles').update(payload).eq('id', id);
    else await supabase.from('profiles').insert([payload]);
  },

  deleteUser: async (id: string): Promise<void> => {
    if (!isUsingSupabase) throw new Error("Fitur ini perlu Database.");
    await supabase.from('profiles').delete().eq('id', id);
  },

  // --- PRODUCTS ---
  getProducts: async (): Promise<Product[]> => {
    if (!isUsingSupabase) return MockProducts;
    try {
      const { data } = await supabase.from('products').select('*').order('name');
      
      // Auto-Seed if empty
      if (!data || data.length === 0) {
          const seedData = MockProducts.map(({ id, ...rest }) => rest);
          const { data: newData } = await supabase.from('products').insert(seedData).select();
          return (newData as Product[]) || [];
      }
      return data as Product[];
    } catch(e) {
      console.warn("Product fetch error", e);
      return [];
    }
  },

  saveProduct: async (product: Product): Promise<void> => {
    if (!isUsingSupabase) return;
    const { id, ...payload } = product;
    if (id && id.length > 10) await supabase.from('products').update(payload).eq('id', id);
    else await supabase.from('products').insert([payload]);
  },

  deleteProduct: async (id: string): Promise<void> => {
    if (!isUsingSupabase) return;
    await supabase.from('products').delete().eq('id', id);
  },

  // --- CUSTOMERS ---
  getCustomers: async (): Promise<Customer[]> => {
    if (!isUsingSupabase) return MockCustomers;
    try {
      const { data } = await supabase.from('customers').select('*').order('name');
      if (!data || data.length === 0) {
          const defaultCust = { name: 'Pelanggan Umum', type: CustomerType.GENERAL, phone: '-', debt: 0 };
          const { data: newData } = await supabase.from('customers').insert([defaultCust]).select();
          return (newData as Customer[]) || [];
      }
      return data as Customer[];
    } catch (e) { return []; }
  },

  saveCustomer: async (customer: Customer): Promise<void> => {
    if (!isUsingSupabase) return;
    const { id, ...payload } = customer;
    if (id && id.length > 10) await supabase.from('customers').update(payload).eq('id', id);
    else await supabase.from('customers').insert([payload]);
  },

  deleteCustomer: async (id: string): Promise<void> => {
    if (!isUsingSupabase) return;
    await supabase.from('customers').delete().eq('id', id);
  },

  // --- SUPPLIERS ---
  getSuppliers: async (): Promise<Supplier[]> => {
    if (!isUsingSupabase) return [];
    try {
      const { data } = await supabase.from('suppliers').select('*').order('name');
      return (data as Supplier[]) || [];
    } catch(e) { return []; }
  },

  saveSupplier: async (supplier: Supplier): Promise<void> => {
    if (!isUsingSupabase) return;
    const { id, ...payload } = supplier;
    if (id && id.length > 10) await supabase.from('suppliers').update(payload).eq('id', id);
    else await supabase.from('suppliers').insert([payload]);
  },

  deleteSupplier: async (id: string): Promise<void> => {
    if (!isUsingSupabase) return;
    await supabase.from('suppliers').delete().eq('id', id);
  },

  // --- SETTINGS ---
  getSettings: async (): Promise<StoreSettings> => {
    if (isUsingSupabase) {
        try {
          const { data } = await supabase.from('store_settings').select('*').single();
          if (data) return data as StoreSettings;
        } catch (e) {
          console.warn("Error fetching settings:", e);
        }
    }
    // Always return default to prevent infinite loading
    return { name: 'YusaPos Store', address: 'Mode Demo / Offline', phone: '-', footer_message: 'Terima Kasih', printer_width: '58mm' };
  },

  saveSettings: async (settings: StoreSettings): Promise<void> => {
    if (!isUsingSupabase) return;
    const { data } = await supabase.from('store_settings').select('id').single();
    if (data) await supabase.from('store_settings').update(settings).eq('id', data.id);
    else await supabase.from('store_settings').insert([settings]);
  },

  // --- TRANSACTIONS ---
  createTransaction: async (transaction: Transaction): Promise<void> => {
    if (!isUsingSupabase) { console.log("Transaction saved (Mock):", transaction); return; }
    
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

    if (txError || !txData) throw new Error("Gagal: " + (txError?.message || 'Unknown error'));

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
    
    for (const item of transaction.items) {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.id).single();
      if (prod) {
        await supabase.from('products').update({ stock: prod.stock - item.qty }).eq('id', item.id);
      }
    }
  },

  getTransactions: async (): Promise<Transaction[]> => {
    if (!isUsingSupabase) return [];
    try {
      const { data } = await supabase.from('transactions').select(`*, items:transaction_items (*)`).order('date', { ascending: false });
      return data ? data.map((t: any) => ({
        ...t,
        items: t.items ? t.items.map((i: any) => ({
          id: i.product_id, name: i.product_name, qty: i.qty, selected_price: i.price, subtotal: i.subtotal,
          sku: '', category: '', stock: 0, price_general: 0, price_agen: 0, price_distributor: 0, discount: 0
        })) : []
      })) : [];
    } catch (e) { return []; }
  },

  getReports: async (period: 'day' | 'month' | 'year'): Promise<SalesReport[]> => {
    return []; 
  },

  createPurchase: async (purchase: Purchase): Promise<void> => {
    if (!isUsingSupabase) { console.log("Purchase saved (Mock):", purchase); return; }

    const { data: pData, error: pError } = await supabase.from('purchases').insert([{
        invoice_number: purchase.invoice_number,
        date: purchase.date,
        supplier_id: purchase.supplier_id,
        supplier_name: purchase.supplier_name,
        admin_id: purchase.admin_id,
        total_amount: purchase.total_amount
    }]).select().single();

    if (pError || !pData) throw new Error("Gagal menyimpan pembelian: " + pError?.message);

    const purchaseId = pData.id;

    const itemsPayload = purchase.items.map(item => ({
        purchase_id: purchaseId,
        product_id: item.product_id,
        product_name: item.product_name,
        qty: item.qty,
        cost_price: item.cost_price,
        subtotal: item.subtotal
    }));

    await supabase.from('purchase_items').insert(itemsPayload);

    for (const item of purchase.items) {
        const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
        if (prod) {
            await supabase.from('products').update({ 
                stock: prod.stock + item.qty,
                cost_price: item.cost_price 
            }).eq('id', item.product_id);
        }
    }
  }
};