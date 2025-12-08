import { createClient } from '@supabase/supabase-js';
import { Product, Customer, Transaction, StoreSettings, User, Supplier, SalesReport, CartItem, UserRole } from '../types';

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

// Mock Data for Offline/Demo Mode
const MockAdmin: User = { id: 'demo-admin', username: 'admin', full_name: 'Admin Demo', role: UserRole.ADMIN, pin_code: '1234' };
const MockCashier: User = { id: 'demo-cashier', username: 'kasir', full_name: 'Kasir Demo', role: UserRole.CASHIER, pin_code: '1111' };

export const DataService = {
  // --- UTILS ---
  // Helper to check connection source
  getConnectionStatus: () => config.source,

  // --- AUTH & USERS ---
  login: async (username: string, pin: string): Promise<User | null> => {
    // 1. Coba Login via Supabase jika ada config
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .eq('pin_code', pin)
          .single();

        if (data && !error) return data as User;
      } catch (e) {
        console.warn("Supabase connection failed, falling back to local auth");
      }
    }

    // 2. Fallback / Offline / Demo Login
    // Ini mengizinkan user masuk jika Supabase belum disetup atau error
    if (username === 'admin' && pin === '1234') return MockAdmin;
    if (username === 'kasir' && pin === '1111') return MockCashier;

    return null;
  },

  getUsers: async (): Promise<User[]> => {
    if (!supabase) return [MockAdmin, MockCashier];
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    return (data as User[]) || [];
  },

  saveUser: async (user: Partial<User>): Promise<void> => {
    if (!supabase) return; // Cannot save in demo mode
    const { id, ...payload } = user;
    
    // Check if updating or inserting
    if (id && id.length > 10) { 
       await supabase.from('profiles').update(payload).eq('id', id);
    } else {
       await supabase.from('profiles').insert([payload]);
    }
  },

  deleteUser: async (id: string): Promise<void> => {
    if (!supabase) return;
    await supabase.from('profiles').delete().eq('id', id);
  },

  // --- PRODUCTS ---
  getProducts: async (): Promise<Product[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('products').select('*').order('name');
    return (data as Product[]) || [];
  },

  saveProduct: async (product: Product): Promise<void> => {
    if (!supabase) return;
    const { id, ...payload } = product;
    if (id && id.length > 10) { 
       await supabase.from('products').update(payload).eq('id', id);
    } else {
       await supabase.from('products').insert([payload]);
    }
  },

  deleteProduct: async (id: string): Promise<void> => {
    if (!supabase) return;
    await supabase.from('products').delete().eq('id', id);
  },

  // --- CUSTOMERS ---
  getCustomers: async (): Promise<Customer[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('customers').select('*').order('name');
    return (data as Customer[]) || [];
  },

  saveCustomer: async (customer: Customer): Promise<void> => {
    if (!supabase) return;
    const { id, ...payload } = customer;
    if (id && id.length > 10) {
      await supabase.from('customers').update(payload).eq('id', id);
    } else {
      await supabase.from('customers').insert([payload]);
    }
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
    if (id && id.length > 10) {
      await supabase.from('suppliers').update(payload).eq('id', id);
    } else {
      await supabase.from('suppliers').insert([payload]);
    }
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
    
    // Default fallback
    return {
      name: 'YusaPos Store',
      address: 'Konfigurasi via menu Pengaturan',
      phone: '-',
      footer_message: 'Terima Kasih',
      printer_width: '58mm'
    };
  },

  saveSettings: async (settings: StoreSettings): Promise<void> => {
    if (!supabase) return;
    const { data } = await supabase.from('store_settings').select('id').single();
    if (data) {
      await supabase.from('store_settings').update(settings).eq('id', data.id);
    } else {
      await supabase.from('store_settings').insert([settings]);
    }
  },

  // --- TRANSACTIONS ---
  createTransaction: async (transaction: Transaction): Promise<void> => {
    if (!supabase) {
        console.log("Transaction saved (Mock):", transaction);
        return;
    }

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

    if (txError || !txData) throw new Error("Gagal menyimpan transaksi: " + (txError?.message || 'Unknown error'));

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

    if (transaction.payment_method === 'debt' && transaction.customer_id) {
       const debtAmount = transaction.total_amount - transaction.amount_paid;
       const { data: cust } = await supabase.from('customers').select('debt').eq('id', transaction.customer_id).single();
       if (cust) {
         await supabase.from('customers').update({ debt: (cust.debt || 0) + debtAmount }).eq('id', transaction.customer_id);
       }
    }
  },

  getTransactions: async (): Promise<Transaction[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        items:transaction_items (*)
      `)
      .order('date', { ascending: false });

    if (error || !data) return [];

    return data.map((t: any) => ({
      ...t,
      items: t.items ? t.items.map((i: any) => ({
        id: i.product_id,
        name: i.product_name,
        qty: i.qty,
        selected_price: i.price,
        subtotal: i.subtotal,
        sku: '', category: '', stock: 0, price_general: 0, price_agen: 0, price_distributor: 0, discount: 0
      })) : []
    }));
  },

  getReports: async (period: 'day' | 'month' | 'year'): Promise<SalesReport[]> => {
    const transactions = await DataService.getTransactions();
    const reportMap: Record<string, SalesReport> = {};

    transactions.forEach(t => {
      const date = new Date(t.date);
      let key = '';
      if (period === 'day') key = date.toISOString().split('T')[0];
      if (period === 'month') key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      if (period === 'year') key = `${date.getFullYear()}`;

      if (!reportMap[key]) {
        reportMap[key] = { date: key, total_sales: 0, total_profit: 0, transaction_count: 0 };
      }
      
      reportMap[key].total_sales += t.total_amount;
      reportMap[key].transaction_count += 1;
      
      let profit = 0;
      if (t.items) {
        t.items.forEach(item => {
          const cost = (item as any).cost_price || (item.selected_price * 0.8); 
          profit += (item.selected_price - cost) * item.qty;
        });
      }
      reportMap[key].total_profit += profit;
    });

    return Object.values(reportMap).sort((a, b) => b.date.localeCompare(a.date));
  }
};