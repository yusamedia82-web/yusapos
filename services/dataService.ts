import { createClient } from '@supabase/supabase-js';
import { Product, Customer, Transaction, StoreSettings, User, Supplier, SalesReport, CartItem, UserRole, CustomerType, Purchase } from '../types';

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
// Updated Mock IDs to be valid UUIDs to prevent confusion, though only used in offline mode.
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
  // --- UTILS ---
  getConnectionStatus: () => config.source,

  // --- AUTH & USERS ---
  login: async (username: string, pin: string): Promise<User | null> => {
    // 1. Jika terkoneksi database (Supabase), PRIORITASKAN Database
    if (supabase) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('username', username).eq('pin_code', pin).single();
        
        // Jika error atau data tidak ditemukan, return NULL (Login Gagal).
        // Jangan lanjut ke fallback akun demo agar password database dihormati.
        if (error || !data) {
           return null;
        }
        
        return data as User;
      } catch (e) { 
        console.warn("Database error", e);
        // Jika terjadi error koneksi fatal, barulah return null (gagal)
        return null;
      }
    }

    // 2. Hanya jalankan Mode Demo/Offline JIKA Supabase TIDAK aktif
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
    
    // Auto-Seed: If DB is empty, fill with default products so user doesn't get errors
    if (!data || data.length === 0) {
        console.log("Seeding Products...");
        // Remove ID so DB generates UUIDs
        const seedData = MockProducts.map(({ id, ...rest }) => rest);
        const { data: newData } = await supabase.from('products').insert(seedData).select();
        return (newData as Product[]) || [];
    }
    
    return data as Product[];
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
    
    // Auto-Seed: If DB is empty, create 'Pelanggan Umum' with valid UUID
    if (!data || data.length === 0) {
        console.log("Seeding Customers...");
        const defaultCust = { name: 'Pelanggan Umum', type: CustomerType.GENERAL, phone: '-', debt: 0 };
        const { data: newData } = await supabase.from('customers').insert([defaultCust]).select();
        return (newData as Customer[]) || [];
    }

    return data as Customer[];
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

  // --- TRANSACTIONS (SALES) ---
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
    
    // Reduce Stock Logic
    for (const item of transaction.items) {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.id).single();
      if (prod) {
        await supabase.from('products').update({ stock: prod.stock - item.qty }).eq('id', item.id);
      }
    }
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
  },

  // --- PURCHASES (RESTOCK) ---
  createPurchase: async (purchase: Purchase): Promise<void> => {
    if (!supabase) { console.log("Purchase saved (Mock):", purchase); return; }

    // 1. Insert Purchase Header
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

    // 2. Insert Items & Update Stock
    const itemsPayload = purchase.items.map(item => ({
        purchase_id: purchaseId,
        product_id: item.product_id,
        product_name: item.product_name,
        qty: item.qty,
        cost_price: item.cost_price,
        subtotal: item.subtotal
    }));

    await supabase.from('purchase_items').insert(itemsPayload);

    // 3. Update Stock & Cost Price in Product Master
    for (const item of purchase.items) {
        const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
        if (prod) {
            await supabase.from('products').update({ 
                stock: prod.stock + item.qty,
                cost_price: item.cost_price // Update HPP terbaru
            }).eq('id', item.product_id);
        }
    }
  }
};