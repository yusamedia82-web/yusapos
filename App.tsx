import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Product, Customer, CartItem, Transaction, StoreSettings, CustomerType, Supplier, SalesReport, Purchase, PurchaseItem } from './types';
import { DataService, isUsingSupabase } from './services/dataService';
import { formatRupiah, formatDate } from './utils/format';

// --- SQL SCHEMA CONSTANT ---
const SQL_SCHEMA = `-- COPY KODE INI KE SUPABASE SQL EDITOR DAN KLIK RUN --

-- 1. Table Profiles (Admin/Kasir)
create table if not exists profiles (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  pin_code text not null,
  full_name text not null,
  role text not null default 'cashier', -- 'admin' or 'cashier'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Insert Default Admin (PIN: 1234)
insert into profiles (username, pin_code, full_name, role)
values ('admin', '1234', 'Administrator', 'admin')
on conflict (username) do nothing;

-- Insert Default Kasir (PIN: 1111)
insert into profiles (username, pin_code, full_name, role)
values ('kasir', '1111', 'Kasir Toko', 'cashier')
on conflict (username) do nothing;

-- 2. Table Store Settings
create table if not exists store_settings (
  id uuid default gen_random_uuid() primary key,
  name text default 'YusaPos Store',
  address text,
  phone text,
  footer_message text default 'Terima Kasih',
  printer_width text default '58mm'
);

-- 3. Table Suppliers
create table if not exists suppliers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  contact text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Table Customers
create table if not exists customers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text,
  type text default 'general', -- 'general', 'agen', 'distributor'
  address text,
  debt numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Table Products
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  sku text,
  name text not null,
  category text,
  stock integer default 0,
  cost_price numeric default 0,
  price_general numeric default 0,
  price_agen numeric default 0,
  price_distributor numeric default 0,
  image_url text,
  supplier_id uuid references suppliers(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Table Transactions
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  invoice_number text not null,
  date timestamp with time zone default timezone('utc'::text, now()),
  cashier_id text,
  cashier_name text,
  customer_id uuid references customers(id),
  customer_name text,
  customer_type text,
  total_amount numeric default 0,
  payment_method text default 'cash', -- 'cash', 'qris', 'debt'
  amount_paid numeric default 0,
  change numeric default 0
);

-- 7. Table Transaction Items
create table if not exists transaction_items (
  id uuid default gen_random_uuid() primary key,
  transaction_id uuid references transactions(id),
  product_id uuid references products(id),
  product_name text,
  qty integer default 1,
  cost_price numeric default 0,
  price numeric default 0,
  subtotal numeric default 0
);

-- 8. Table Purchases (Restock)
create table if not exists purchases (
  id uuid default gen_random_uuid() primary key,
  invoice_number text, -- Dari supplier
  date timestamp with time zone default timezone('utc'::text, now()),
  supplier_id uuid references suppliers(id),
  supplier_name text,
  admin_id text,
  total_amount numeric default 0
);

-- 9. Table Purchase Items
create table if not exists purchase_items (
  id uuid default gen_random_uuid() primary key,
  purchase_id uuid references purchases(id),
  product_id uuid references products(id),
  product_name text,
  qty integer default 1,
  cost_price numeric default 0,
  subtotal numeric default 0
);

-- Enable RLS & Policies (Aman dijalankan berulang)
alter table profiles enable row level security;
drop policy if exists "Public access profiles" on profiles;
create policy "Public access profiles" on profiles for all using (true);

alter table products enable row level security;
drop policy if exists "Public access products" on products;
create policy "Public access products" on products for all using (true);

alter table transactions enable row level security;
drop policy if exists "Public access transactions" on transactions;
create policy "Public access transactions" on transactions for all using (true);

alter table transaction_items enable row level security;
drop policy if exists "Public access transaction_items" on transaction_items;
create policy "Public access transaction_items" on transaction_items for all using (true);

alter table customers enable row level security;
drop policy if exists "Public access customers" on customers;
create policy "Public access customers" on customers for all using (true);

alter table suppliers enable row level security;
drop policy if exists "Public access suppliers" on suppliers;
create policy "Public access suppliers" on suppliers for all using (true);

alter table store_settings enable row level security;
drop policy if exists "Public access settings" on store_settings;
create policy "Public access settings" on store_settings for all using (true);

alter table purchases enable row level security;
drop policy if exists "Public access purchases" on purchases;
create policy "Public access purchases" on purchases for all using (true);

alter table purchase_items enable row level security;
drop policy if exists "Public access purchase_items" on purchase_items;
create policy "Public access purchase_items" on purchase_items for all using (true);
`;

// --- ICONS ---
const Icons = {
  Menu: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
  Close: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Dashboard: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  POS: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  Product: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Report: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Settings: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Truck: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
  Cart: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Database: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>,
  Purchase: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
};

// --- LOGIN COMPONENT ---
const Login = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await DataService.login(username, pin);
      if (user) onLogin(user);
      else setError('Username atau PIN salah');
    } catch (err) {
      setError('Terjadi kesalahan koneksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="text-center mb-6">
           <h1 className="text-3xl font-bold text-indigo-700">YusaPos</h1>
           <p className="text-slate-500 text-sm">Sistem Kasir Pintar</p>
           {!isUsingSupabase && <span className="inline-block mt-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded font-medium">Mode Demo / Offline</span>}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Username</label>
            <input type="text" className="mt-1 w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin / kasir" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">PIN Code</label>
            <input type="password" className="mt-1 w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500" value={pin} onChange={e => setPin(e.target.value)} placeholder="1234 / 1111" required />
          </div>
          {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-100">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-bold">
            {loading ? 'Memproses...' : 'MASUK APLIKASI'}
          </button>
        </form>
        {!isUsingSupabase && (
          <div className="mt-6 text-xs text-center text-slate-400">
            <p>Demo Admin: <span className="font-mono bg-slate-100 px-1 rounded">admin</span> | <span className="font-mono bg-slate-100 px-1 rounded">1234</span></p>
            <p className="mt-1">Demo Kasir: <span className="font-mono bg-slate-100 px-1 rounded">kasir</span> | <span className="font-mono bg-slate-100 px-1 rounded">1111</span></p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- DASHBOARD COMPONENT ---
const Dashboard = () => {
  const [stats, setStats] = useState<any>({ todaySales: 0, transactions: 0, lowStock: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const txs = await DataService.getTransactions();
      const products = await DataService.getProducts();
      
      const todayStr = new Date().toISOString().split('T')[0];
      const todayTxs = txs.filter(t => t.date.startsWith(todayStr));
      
      setStats({
        todaySales: todayTxs.reduce((sum, t) => sum + t.total_amount, 0),
        transactions: todayTxs.length,
        lowStock: products.filter(p => p.stock < 10).length
      });
    };
    fetchStats();
  }, []);

  return (
    <div className="p-4 md:p-6">
      <h2 className="text-2xl font-bold mb-6 text-slate-800">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
          <div className="text-sm text-slate-500 font-medium">Penjualan Hari Ini</div>
          <div className="text-2xl font-bold text-green-700 mt-1">{formatRupiah(stats.todaySales)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
          <div className="text-sm text-slate-500 font-medium">Jumlah Transaksi</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{stats.transactions}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-red-500">
          <div className="text-sm text-slate-500 font-medium">Stok Menipis</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{stats.lowStock} Item</div>
        </div>
      </div>
    </div>
  );
};

// --- POS COMPONENT ---
const POS = ({ user, settings }: { user: User, settings: StoreSettings }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [paymentModal, setPaymentModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [paymentError, setPaymentError] = useState(''); // Error state for modal
  const [processing, setProcessing] = useState(false); // New Processing State
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const p = await DataService.getProducts();
      const c = await DataService.getCustomers();
      setProducts(p);
      setCustomers(c);
      // Ensure we always have a valid customer to avoid crash
      setSelectedCustomer(c.find(x => x.type === CustomerType.GENERAL) || c[0] || null);
    };
    init();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement !== searchInputRef.current && e.key.length === 1 && !paymentModal && !successModal) {
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paymentModal, successModal]);

  const getPrice = (product: Product, customer: Customer) => {
    if (!customer) return product.price_general;
    switch (customer.type) {
      case CustomerType.AGEN: return product.price_agen;
      case CustomerType.DISTRIBUTOR: return product.price_distributor;
      default: return product.price_general;
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return alert('Stok habis!');
    
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const cust = selectedCustomer || { type: CustomerType.GENERAL } as Customer;
      
      if (existing) {
        return prev.map(item => item.id === product.id 
          ? { ...item, qty: item.qty + 1, subtotal: (item.qty + 1) * item.selected_price } 
          : item);
      }
      const price = getPrice(product, cust);
      return [...prev, { ...product, qty: 1, selected_price: price, discount: 0, subtotal: price }];
    });
    setSearch(''); 
  };

  // --- NEW FUNCTION: Manual Qty Update ---
  const updateCartQty = (id: string, val: string) => {
     const product = products.find(p => p.id === id);
     if (!product) return;

     let qty = parseInt(val);
     // Handle empty string or invalid input gracefully
     if (isNaN(qty) || qty < 1) qty = 1;

     if (qty > product.stock) {
          alert(`Maksimal stok: ${product.stock}`);
          qty = product.stock;
     }

     setCart(prev => prev.map(item => item.id === id ? { ...item, qty, subtotal: qty * item.selected_price } : item));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const grandTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const formatInputCurrency = (val: string) => {
     // Remove non-digit characters
     const num = parseInt(val.replace(/\D/g, '') || '0', 10);
     return new Intl.NumberFormat('id-ID').format(num);
  };

  const handleSetAmountPaid = (val: string) => {
    // Only allow digits to be set (will be formatted)
    setAmountPaid(formatInputCurrency(val));
    setPaymentError('');
  };

  const handleCheckout = async () => {
    if (processing) return;

    setPaymentError('');
    // Remove dots/commas before parsing
    const paid = parseInt(amountPaid.replace(/\./g, '').replace(/,/g, '') || '0', 10);
    const isDebt = paid < grandTotal;
    
    // Fallback if no customer selected
    const cust = selectedCustomer || { id: 'guest', name: 'Umum', type: CustomerType.GENERAL, debt: 0, phone: '-' } as Customer;

    if (isDebt && cust.type === CustomerType.GENERAL) {
      setPaymentError('Pelanggan Umum tidak boleh hutang! Mohon bayar lunas.');
      return;
    }

    setProcessing(true); // Start processing
    try {
        const tx: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        invoice_number: `INV-${Date.now()}`,
        date: new Date().toISOString(),
        cashier_id: user.id,
        cashier_name: user.full_name,
        customer_id: cust.id,
        customer_name: cust.name,
        customer_type: cust.type,
        items: cart,
        total_amount: grandTotal,
        amount_paid: paid,
        change: Math.max(0, paid - grandTotal),
        payment_method: isDebt ? 'debt' : 'cash'
        };

        await DataService.createTransaction(tx);
        setLastTransaction(tx);
        setCart([]);
        setPaymentModal(false);
        setShowMobileCart(false);
        setAmountPaid('');
        setSuccessModal(true);
    } catch(err: any) {
        console.error(err);
        setPaymentError('Gagal memproses transaksi: ' + (err.message || 'Error Database'));
    } finally {
        setProcessing(false); // End processing
    }
  };

  useEffect(() => {
    if (!products.length) return;
    const exactMatch = products.find(p => (p.sku || '').toString() === search);
    if (exactMatch) {
      addToCart(exactMatch);
    }
  }, [search]);

  // Robust filtering to prevent blank screen
  const filteredProducts = products.filter(p => {
    if(!p) return false;
    const s = search.toLowerCase();
    const name = (p.name || '').toLowerCase();
    const sku = (p.sku || '').toString().toLowerCase();
    return name.includes(s) || sku.includes(s);
  });

  return (
    <div className="flex h-full overflow-hidden bg-slate-100 flex-col md:flex-row relative">
      {/* Product Area */}
      <div className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden relative">
        <div className="bg-white p-3 rounded-lg shadow mb-3 flex flex-col md:flex-row gap-3">
          <input 
            ref={searchInputRef}
            autoFocus
            type="text" 
            placeholder="Cari Produk / Scan..." 
            className="flex-1 border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select 
            className="border p-2 rounded bg-indigo-50 text-indigo-700 font-medium w-full md:w-auto"
            value={selectedCustomer?.id || ''}
            onChange={e => {
              const cust = customers.find(c => c.id === e.target.value);
              setSelectedCustomer(cust || null);
              if (cust) {
                setCart(prev => prev.map(item => {
                  const newPrice = getPrice(products.find(p => p.id === item.id)!, cust);
                  return { ...item, selected_price: newPrice, subtotal: item.qty * newPrice };
                }));
              }
            }}
          >
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
            {customers.length === 0 && <option value="">Umum (Default)</option>}
          </select>
        </div>

        {/* Product List */}
        {/* pb-36 for mobile to ensure last items are visible above the floating cart button */}
        <div className="flex-1 overflow-y-auto pb-36 md:pb-0 no-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => addToCart(p)} className="bg-white p-3 rounded-lg shadow cursor-pointer active:scale-95 transition relative">
                <div className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded ${p.stock < 5 ? 'bg-red-100 text-red-600' : 'bg-slate-200'}`}>
                  Stok: {p.stock}
                </div>
                <div className="h-20 bg-slate-100 mb-2 rounded flex items-center justify-center text-slate-400 text-xs">
                  {p.image_url ? <img src={p.image_url} alt="" className="h-full object-cover rounded" /> : 'No IMG'}
                </div>
                <h3 className="font-semibold text-sm line-clamp-2 leading-tight min-h-[2.5rem]">{p.name}</h3>
                <div className="text-indigo-600 font-bold mt-1">
                  {formatRupiah(getPrice(p, selectedCustomer || {type: CustomerType.GENERAL} as Customer))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Bottom Bar for Cart (FIXED POSITION) */}
        {/* Added z-30 to ensure it floats above product list */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex items-center justify-between z-30" onClick={() => setShowMobileCart(true)}>
             <div className="flex items-center gap-3">
               <div className="bg-indigo-600 text-white p-2 rounded-full relative">
                 <Icons.Cart />
                 {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center border border-white">{cart.reduce((a,b)=>a+b.qty,0)}</span>}
               </div>
               <div>
                 <div className="text-xs text-slate-500">Total Belanja</div>
                 <div className="font-bold text-indigo-700 text-lg">{formatRupiah(grandTotal)}</div>
               </div>
             </div>
             <button className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-indigo-200">Lihat</button>
        </div>
      </div>

      {/* Cart Area / Modal */}
      {/* Changed mobile layout to be a bottom sheet style with proper z-index and height */}
      <div className={`fixed inset-0 z-50 bg-black/50 transition-opacity md:static md:bg-transparent md:w-96 md:flex md:flex-col md:border-l md:shadow-xl md:z-auto ${showMobileCart ? 'opacity-100' : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto'}`}>
         {/* Mobile: h-[85vh] absolute bottom to act as a bottom sheet. Desktop: static h-full */}
         <div className={`absolute bottom-0 left-0 right-0 h-[85vh] bg-white rounded-t-xl shadow-2xl flex flex-col md:static md:h-full md:rounded-none transition-transform duration-300 ${showMobileCart ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}>
            <div className="p-4 bg-indigo-700 text-white flex justify-between items-center rounded-t-xl md:rounded-none shrink-0">
              <div>
                <h2 className="text-xl font-bold">Keranjang</h2>
                <div className="text-xs opacity-75">{selectedCustomer?.name || 'Umum'}</div>
              </div>
              <button className="md:hidden" onClick={() => setShowMobileCart(false)}><Icons.Close /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {cart.length === 0 && <div className="text-center text-slate-400 mt-10">Keranjang Kosong</div>}
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded shadow-sm border border-slate-100">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-slate-800">{item.name}</div>
                    {/* MODIFIED: Input for Quantity */}
                    <div className="flex items-center mt-2 gap-2">
                         <input 
                            type="number" 
                            min="1"
                            className="w-16 p-1 border rounded text-center text-sm font-bold text-indigo-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={item.qty}
                            onChange={(e) => updateCartQty(item.id, e.target.value)}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                         />
                         <span className="text-xs text-slate-500">x {formatRupiah(item.selected_price)}</span>
                    </div>
                  </div>
                  <div className="text-right pl-2">
                    <div className="font-bold text-sm text-slate-800">{formatRupiah(item.subtotal)}</div>
                    <button onClick={() => removeFromCart(item.id)} className="text-xs text-red-500 mt-2 hover:bg-red-50 px-2 py-1 rounded transition">Hapus</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Added pb-8 for mobile to prevent button being too close to bottom edge */}
            <div className="p-4 bg-white border-t shrink-0 pb-8 md:pb-4">
              <div className="flex justify-between text-lg font-bold mb-4 text-slate-800">
                <span>Total:</span>
                <span>{formatRupiah(grandTotal)}</span>
              </div>
              <button 
                disabled={cart.length === 0}
                onClick={() => {
                  setAmountPaid(formatInputCurrency(grandTotal.toString())); // Auto-fill amount for easier checkout
                  setPaymentError('');
                  setPaymentModal(true);
                }}
                className="w-full bg-green-600 text-white py-3.5 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 text-lg shadow-lg shadow-green-200"
              >
                BAYAR SEKARANG
              </button>
            </div>
         </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 my-auto">
            <h3 className="text-xl font-bold mb-4">Pembayaran</h3>
            <div className="mb-4 p-4 bg-slate-50 rounded-lg text-center border border-slate-100">
              <label className="block text-xs uppercase text-slate-500 mb-1 tracking-wider">Total Tagihan</label>
              <div className="text-3xl font-bold text-slate-800">{formatRupiah(grandTotal)}</div>
            </div>
            
            {/* Validation Message */}
            {paymentError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-xs font-bold border border-red-100 text-center">{paymentError}</div>}
            
            <div className="mb-6">
              <label className="block text-sm mb-2 font-medium">Jumlah Uang Diterima</label>
              <input 
                autoFocus
                type="tel" // Changed to tel for better mobile keypad
                className="w-full text-xl p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                value={amountPaid}
                onChange={e => handleSetAmountPaid(e.target.value)}
                placeholder="0"
                disabled={processing}
              />
              <div className="grid grid-cols-3 gap-2 mt-3">
                <button disabled={processing} onClick={() => handleSetAmountPaid(grandTotal.toString())} className="text-xs bg-slate-100 border px-2 py-2 rounded hover:bg-slate-200 font-medium">Uang Pas</button>
                <button disabled={processing} onClick={() => handleSetAmountPaid('50000')} className="text-xs bg-slate-100 border px-2 py-2 rounded hover:bg-slate-200 font-medium">50.000</button>
                <button disabled={processing} onClick={() => handleSetAmountPaid('100000')} className="text-xs bg-slate-100 border px-2 py-2 rounded hover:bg-slate-200 font-medium">100.000</button>
              </div>
            </div>
            <div className="flex gap-3">
              <button disabled={processing} onClick={() => setPaymentModal(false)} className="flex-1 py-3 border rounded-lg hover:bg-slate-50 font-medium">Batal</button>
              <button disabled={processing} onClick={handleCheckout} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2">
                {processing && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                {processing ? 'Memproses...' : 'Proses Bayar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Change Modal */}
      {successModal && lastTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl w-full max-w-sm shadow-2xl text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-1 text-slate-800">Transaksi Berhasil!</h3>
            
            <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-100 mt-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{lastTransaction.change > 0 ? 'Kembalian' : 'Status'}</div>
              <div className={`text-3xl font-bold ${lastTransaction.change > 0 ? 'text-indigo-600' : 'text-slate-700'}`}>
                {lastTransaction.change > 0 ? formatRupiah(lastTransaction.change) : 'LUNAS'}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setSuccessModal(false)} className="py-3 px-4 border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition">
                Tutup
              </button>
              <button onClick={() => { window.print(); }} className="flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Cetak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Receipt for Thermal Printer */}
      <div className="print-only flex justify-center p-0 m-0">
        {lastTransaction && (
          <div className="receipt-container p-2 font-receipt text-black" style={{ width: settings.printer_width }}>
             {/* Header */}
             <div className="text-center mb-2 leading-tight">
               <h2 className="font-bold text-lg uppercase mb-1">{settings.name}</h2>
               <p className="text-[10px] break-words px-2">{settings.address}</p>
               <p className="text-[10px] mt-0.5">{settings.phone}</p>
             </div>

             {/* Separator */}
             <div className="border-b-2 border-dashed border-black my-1"></div>

             {/* Meta Info */}
             <div className="text-[10px] leading-tight mb-2">
               <div className="flex justify-between">
                 <span>{formatDate(lastTransaction.date)}</span>
               </div>
               <div className="flex justify-between mt-0.5">
                 <span>Inv: {lastTransaction.invoice_number}</span>
               </div>
               <div className="flex justify-between mt-0.5">
                 <span>Ksr: {lastTransaction.cashier_name}</span>
               </div>
               {lastTransaction.customer_name !== 'Umum' && (
                 <div className="flex justify-between mt-0.5 border-t border-dashed border-black pt-0.5">
                    <span>Plg: {lastTransaction.customer_name}</span>
                 </div>
               )}
             </div>

             <div className="border-b border-dashed border-black my-1"></div>

             {/* Items List */}
             <div className="text-[11px] leading-snug">
               {lastTransaction.items.map((item, idx) => (
                 <div key={idx} className="mb-1.5">
                   <div className="font-bold truncate">{item.name}</div>
                   <div className="flex justify-between">
                     <span>{item.qty} x {formatRupiah(item.selected_price)}</span>
                     <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                   </div>
                 </div>
               ))}
             </div>

             <div className="border-b border-dashed border-black my-2"></div>

             {/* Totals & Calculations */}
             <div className="text-[11px] font-bold leading-snug">
               <div className="flex justify-between mb-1">
                 <span>Total</span>
                 <span className="text-sm">{formatRupiah(lastTransaction.total_amount)}</span>
               </div>
               <div className="flex justify-between mb-1">
                 <span>Bayar ({lastTransaction.payment_method === 'debt' ? 'Hutang' : 'Tunai'})</span>
                 <span>{formatRupiah(lastTransaction.amount_paid)}</span>
               </div>
               <div className="flex justify-between">
                 <span>{lastTransaction.change >= 0 ? 'Kembali' : 'Sisa Hutang'}</span>
                 <span>{formatRupiah(Math.abs(lastTransaction.change || (lastTransaction.total_amount - lastTransaction.amount_paid)))}</span>
               </div>
             </div>

             <div className="border-b-2 border-dashed border-black my-2"></div>

             {/* Footer */}
             <div className="text-center text-[10px] leading-tight mt-2">
               <p className="italic">{settings.footer_message}</p>
               <p className="mt-2 font-bold">*** TERIMA KASIH ***</p>
               <p className="mt-1 text-[9px]">Powered by YusaPos</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- PURCHASE MANAGER (NEW) ---
const PurchaseManager = ({ user }: { user: User }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    DataService.getSuppliers().then(setSuppliers);
    DataService.getProducts().then(setProducts);
  }, []);

  const addToCart = (product: Product) => {
    const existing = cart.find(i => i.product_id === product.id);
    if (existing) return; // Prevent duplicate rows for simplicity, allow editing qty instead
    
    setCart(prev => [...prev, {
        product_id: product.id,
        product_name: product.name,
        qty: 1,
        cost_price: product.cost_price, // Default to current cost price
        subtotal: product.cost_price * 1
    }]);
    setSearch('');
  };

  const updateItem = (productId: string, field: 'qty' | 'cost_price', value: number) => {
    setCart(prev => prev.map(item => {
        if (item.product_id === productId) {
            const newVal = Math.max(0, value);
            const newSubtotal = field === 'qty' ? newVal * item.cost_price : item.qty * newVal;
            return { ...item, [field]: newVal, subtotal: newSubtotal };
        }
        return item;
    }));
  };

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.product_id !== productId));
  };

  const handleProcessPurchase = async () => {
    if (!selectedSupplier) return alert('Pilih Supplier terlebih dahulu');
    if (!invoiceNumber) return alert('Masukkan Nomor Nota dari Supplier');
    if (cart.length === 0) return alert('Keranjang pembelian kosong');

    if (!confirm('Proses pembelian ini? Stok produk akan bertambah dan harga modal akan diperbarui.')) return;

    setLoading(true);
    try {
        const supplierName = suppliers.find(s => s.id === selectedSupplier)?.name || 'Unknown';
        await DataService.createPurchase({
            id: '',
            invoice_number: invoiceNumber,
            date: new Date().toISOString(),
            supplier_id: selectedSupplier,
            supplier_name: supplierName,
            admin_id: user.id,
            items: cart,
            total_amount: cart.reduce((sum, i) => sum + i.subtotal, 0)
        });
        alert('Pembelian berhasil disimpan!');
        setCart([]);
        setInvoiceNumber('');
        setSearch('');
        // Refresh products to see updated stock
        DataService.getProducts().then(setProducts);
    } catch (e: any) {
        alert(e.message);
    } finally {
        setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && !cart.find(c => c.product_id === p.id));

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
        <h2 className="text-2xl font-bold mb-6">Pembelian Stok (Restock)</h2>
        
        <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="bg-white p-4 rounded shadow flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                <select className="border w-full p-2 rounded" value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                    <option value="">-- Pilih Supplier --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
            <div className="bg-white p-4 rounded shadow flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">No. Nota Supplier</label>
                <input className="border w-full p-2 rounded" placeholder="Contoh: INV-SUP-001" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
            </div>
        </div>

        <div className="bg-white p-4 rounded shadow flex-1 flex flex-col min-h-0">
            <div className="relative mb-4">
                <input 
                    className="border w-full p-2 rounded pl-10" 
                    placeholder="Cari produk untuk ditambahkan..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div className="absolute left-3 top-2.5 text-slate-400"><Icons.Product /></div>
                
                {search && filteredProducts.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border shadow-lg mt-1 max-h-60 overflow-y-auto rounded-b">
                        {filteredProducts.map(p => (
                            <div key={p.id} onClick={() => addToCart(p)} className="p-2 hover:bg-indigo-50 cursor-pointer border-b last:border-0 flex justify-between">
                                <span>{p.name}</span>
                                <span className="text-xs text-slate-500">Stok: {p.stock}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto border rounded">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 sticky top-0">
                        <tr>
                            <th className="p-3">Produk</th>
                            <th className="p-3 w-24">Qty Masuk</th>
                            <th className="p-3 w-40">Harga Beli (Satuan)</th>
                            <th className="p-3 w-40 text-right">Subtotal</th>
                            <th className="p-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {cart.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Belum ada item dipilih</td></tr>}
                        {cart.map(item => (
                            <tr key={item.product_id}>
                                <td className="p-3">{item.product_name}</td>
                                <td className="p-3"><input type="number" min="1" className="border w-full p-1 rounded text-center" value={item.qty} onChange={e => updateItem(item.product_id, 'qty', parseInt(e.target.value))} /></td>
                                <td className="p-3"><input type="number" min="0" className="border w-full p-1 rounded" value={item.cost_price} onChange={e => updateItem(item.product_id, 'cost_price', parseInt(e.target.value))} /></td>
                                <td className="p-3 text-right font-medium">{formatRupiah(item.subtotal)}</td>
                                <td className="p-3 text-center"><button onClick={() => removeItem(item.product_id)} className="text-red-500 hover:text-red-700"><Icons.Close /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t">
                 <div className="text-xl font-bold">Total: {formatRupiah(cart.reduce((a,b) => a + b.subtotal, 0))}</div>
                 <button onClick={handleProcessPurchase} disabled={loading || cart.length === 0} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50">
                    {loading ? 'Menyimpan...' : 'PROSES PEMBELIAN'}
                 </button>
            </div>
        </div>
    </div>
  );
};

// --- PRODUCT MANAGER ---
const ProductManager = () => {
  const [data, setData] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const refresh = async () => setData(await DataService.getProducts());
  useEffect(() => { refresh(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await DataService.saveProduct(editing as Product);
      setEditing(null);
      refresh();
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold">Manajemen Produk</h2>
        <button onClick={() => setEditing({ sku: '', name: '', stock: 0, price_general: 0 })} className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 self-start">Tambah Produk</button>
      </div>
      
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="bg-white p-6 rounded shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold mb-4 text-lg">Editor Produk</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs text-slate-500">SKU/Barcode</label><input required className="border w-full p-2 rounded" value={editing.sku} onChange={e => setEditing({...editing, sku: e.target.value})} /></div>
              <div><label className="block text-xs text-slate-500">Nama Produk</label><input required className="border w-full p-2 rounded" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} /></div>
              <div><label className="block text-xs text-slate-500">Kategori</label><input className="border w-full p-2 rounded" value={editing.category || ''} onChange={e => setEditing({...editing, category: e.target.value})} /></div>
              <div><label className="block text-xs text-slate-500">Stok</label><input type="number" className="border w-full p-2 rounded" value={editing.stock} onChange={e => setEditing({...editing, stock: parseInt(e.target.value)})} /></div>
              <div><label className="block text-xs font-bold text-red-600">Harga Modal (HPP)</label><input type="number" className="border w-full p-2 rounded" value={editing.cost_price || 0} onChange={e => setEditing({...editing, cost_price: parseInt(e.target.value)})} /></div>
              <div><label className="block text-xs font-bold text-green-600">Harga Umum</label><input type="number" className="border w-full p-2 rounded" value={editing.price_general || 0} onChange={e => setEditing({...editing, price_general: parseInt(e.target.value)})} /></div>
              <div><label className="block text-xs font-bold text-blue-600">Harga Agen</label><input type="number" className="border w-full p-2 rounded" value={editing.price_agen || 0} onChange={e => setEditing({...editing, price_agen: parseInt(e.target.value)})} /></div>
              <div><label className="block text-xs font-bold text-orange-600">Harga Distributor</label><input type="number" className="border w-full p-2 rounded" value={editing.price_distributor || 0} onChange={e => setEditing({...editing, price_distributor: parseInt(e.target.value)})} /></div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">Batal</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Simpan</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 uppercase font-medium">
            <tr>
              <th className="px-6 py-3">SKU</th>
              <th className="px-6 py-3">Nama</th>
              <th className="px-6 py-3">Stok</th>
              <th className="px-6 py-3">Harga</th>
              <th className="px-6 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-mono text-xs">{p.sku}</td>
                <td className="px-6 py-4">{p.name}</td>
                <td className={`px-6 py-4 font-bold ${p.stock < 10 ? 'text-red-600' : 'text-green-600'}`}>{p.stock}</td>
                <td className="px-6 py-4">{formatRupiah(p.price_general)}</td>
                <td className="px-6 py-4">
                  <button onClick={() => setEditing(p)} className="text-blue-600 hover:underline mr-4 font-medium">Edit</button>
                  <button onClick={async () => { if(window.confirm('Hapus produk ini?')) { await DataService.deleteProduct(p.id); refresh(); } }} className="text-red-600 hover:underline font-medium">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- CUSTOMER MANAGER ---
const CustomerManager = () => {
  const [data, setData] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const refresh = async () => setData(await DataService.getCustomers());
  useEffect(() => { refresh(); }, []);
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) { await DataService.saveCustomer(editing as Customer); setEditing(null); refresh(); }
  };
  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold">Pelanggan</h2>
        <button onClick={() => setEditing({ name: '', phone: '', type: CustomerType.GENERAL, debt: 0 })} className="bg-indigo-600 text-white px-4 py-2 rounded">Tambah</button>
      </div>
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h3 className="font-bold mb-4">Form Pelanggan</h3>
            <div className="space-y-3">
              <input required placeholder="Nama" className="border w-full p-2 rounded" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} />
              <input placeholder="No HP" className="border w-full p-2 rounded" value={editing.phone} onChange={e => setEditing({...editing, phone: e.target.value})} />
              <select className="border w-full p-2 rounded" value={editing.type} onChange={e => setEditing({...editing, type: e.target.value as CustomerType})}>
                <option value={CustomerType.GENERAL}>Umum</option>
                <option value={CustomerType.AGEN}>Agen</option>
                <option value={CustomerType.DISTRIBUTOR}>Distributor</option>
              </select>
              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded mt-4">Simpan</button>
              <button type="button" onClick={() => setEditing(null)} className="w-full bg-slate-200 py-2 rounded mt-2">Batal</button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
           <thead className="bg-slate-50 text-slate-500 uppercase"><tr><th className="p-4">Nama</th><th className="p-4">Tipe</th><th className="p-4">Hutang</th><th className="p-4">Aksi</th></tr></thead>
           <tbody className="divide-y divide-slate-100">{data.map(c => (<tr key={c.id}><td className="p-4">{c.name}</td><td className="p-4">{c.type}</td><td className="p-4">{formatRupiah(c.debt)}</td><td className="p-4"><button onClick={() => setEditing(c)} className="text-blue-600">Edit</button></td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
};

// --- SUPPLIER MANAGER ---
const SupplierManager = () => {
    const [data, setData] = useState<Supplier[]>([]);
    const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
    const refresh = async () => setData(await DataService.getSuppliers());
    useEffect(() => { refresh(); }, []);
    const handleSave = async (e: React.FormEvent) => { e.preventDefault(); if (editing) { await DataService.saveSupplier(editing as Supplier); setEditing(null); refresh(); } };
    return (
      <div className="p-4 md:p-6">
        <div className="flex justify-between mb-6">
          <h2 className="text-2xl font-bold">Supplier</h2>
          <button onClick={() => setEditing({ name: '' })} className="bg-indigo-600 text-white px-4 py-2 rounded">Tambah</button>
        </div>
        {editing && <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"><form onSubmit={handleSave} className="bg-white p-6 rounded shadow-lg w-full max-w-md"><input required placeholder="Nama" className="border w-full p-2 mb-2 rounded" value={editing.name} onChange={e=>setEditing({...editing, name: e.target.value})} /><button className="bg-indigo-600 text-white w-full py-2 rounded">Simpan</button><button type="button" onClick={()=>setEditing(null)} className="bg-slate-200 w-full py-2 rounded mt-2">Batal</button></form></div>}
        <div className="bg-white rounded shadow overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap"><thead className="bg-slate-50 uppercase"><tr><th className="p-4">Nama</th><th className="p-4">Aksi</th></tr></thead><tbody>{data.map(s=><tr key={s.id}><td className="p-4">{s.name}</td><td className="p-4"><button onClick={()=>setEditing(s)} className="text-blue-600">Edit</button></td></tr>)}</tbody></table>
        </div>
      </div>
    );
};

// --- REPORT PAGE ---
const ReportPage = () => {
    const [data, setData] = useState<SalesReport[]>([]);
    useEffect(() => { DataService.getReports('day').then(setData); }, []);
    return (
        <div className="p-4 md:p-6">
            <h2 className="text-2xl font-bold mb-4">Laporan</h2>
            <div className="bg-white rounded shadow overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap"><thead className="bg-slate-50 uppercase"><tr><th className="p-4">Tanggal</th><th className="p-4 text-right">Omzet</th><th className="p-4 text-right">Laba</th></tr></thead><tbody>{data.map((r,i)=><tr key={i}><td className="p-4">{r.date}</td><td className="p-4 text-right">{formatRupiah(r.total_sales)}</td><td className="p-4 text-right">{formatRupiah(r.total_profit)}</td></tr>)}</tbody></table>
            </div>
        </div>
    );
};

// --- SETTINGS (COMPLETE) ---
const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<StoreSettings>({ name: '', address: '', phone: '', footer_message: '', printer_width: '58mm' });
  const [dbConfig, setDbConfig] = useState({ url: '', key: '' });
  
  // User Management State
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);

  useEffect(() => { 
    DataService.getSettings().then(setSettings); 
    setDbConfig({
      url: localStorage.getItem('yusa_sb_url') || '',
      key: localStorage.getItem('yusa_sb_key') || ''
    });
  }, []);
  
  const loadUsers = async () => {
    if (activeTab === 'users') {
        setUsers(await DataService.getUsers());
    }
  }

  useEffect(() => {
    loadUsers();
  }, [activeTab]);

  const handleSaveSettings = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    await DataService.saveSettings(settings); 
    alert('Pengaturan Toko Tersimpan!'); 
  };

  const handleSaveDB = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('yusa_sb_url', dbConfig.url);
    localStorage.setItem('yusa_sb_key', dbConfig.key);
    if(confirm('Aplikasi perlu dimuat ulang untuk menerapkan database baru. Reload sekarang?')) {
      window.location.reload();
    }
  };

  const handleResetDB = () => {
    if(confirm('Hapus konfigurasi database? Aplikasi akan kembali ke mode Demo.')) {
      localStorage.removeItem('yusa_sb_url');
      localStorage.removeItem('yusa_sb_key');
      window.location.reload();
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
        await DataService.saveUser(editingUser);
        setEditingUser(null);
        loadUsers();
    } catch(e) {
        alert('Gagal menyimpan user. Pastikan Database terhubung.');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('Hapus user ini?')) {
        await DataService.deleteUser(id);
        loadUsers();
    }
  };

  return (
    <div className="p-4 md:p-6">
        <h2 className="text-2xl font-bold mb-6">Pengaturan</h2>
        
        <div className="bg-white rounded-lg shadow overflow-hidden max-w-4xl">
          <div className="flex border-b overflow-x-auto">
            <button 
              onClick={() => setActiveTab('general')}
              className={`flex-1 py-4 px-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'general' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Identitas Toko & Printer
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-4 px-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Manajemen Pengguna
            </button>
            <button 
              onClick={() => setActiveTab('database')}
              className={`flex-1 py-4 px-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'database' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Database & Schema
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'general' && (
              <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Nama Toko</label><input className="border w-full p-2 rounded focus:ring-2 focus:ring-indigo-500" value={settings.name} onChange={e=>setSettings({...settings, name:e.target.value})}/></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Alamat</label><textarea className="border w-full p-2 rounded focus:ring-2 focus:ring-indigo-500" value={settings.address} onChange={e=>setSettings({...settings, address:e.target.value})}/></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Telepon</label><input className="border w-full p-2 rounded focus:ring-2 focus:ring-indigo-500" value={settings.phone} onChange={e=>setSettings({...settings, phone:e.target.value})}/></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Pesan di Struk (Footer)</label><input className="border w-full p-2 rounded focus:ring-2 focus:ring-indigo-500" value={settings.footer_message} onChange={e=>setSettings({...settings, footer_message:e.target.value})}/></div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ukuran Kertas Printer</label>
                    <select className="border w-full p-2 rounded focus:ring-2 focus:ring-indigo-500" value={settings.printer_width} onChange={(e:any) => setSettings({...settings, printer_width: e.target.value})}>
                      <option value="58mm">58mm (Thermal Standar)</option>
                      <option value="80mm">80mm (Lebar)</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded w-full font-bold hover:bg-indigo-700">Simpan Perubahan</button>
              </form>
            )}

            {activeTab === 'users' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg">Daftar Admin & Kasir</h3>
                        <button onClick={() => setEditingUser({role: UserRole.CASHIER, username: '', full_name: '', pin_code: ''})} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700">Tambah User</button>
                    </div>
                    {!isUsingSupabase && <div className="mb-4 bg-yellow-50 text-yellow-800 text-sm p-3 rounded">Fitur edit user hanya tersedia jika Database Supabase terhubung. Dalam mode demo, data ini statis.</div>}
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 uppercase text-xs font-bold text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Nama Lengkap</th>
                                    <th className="px-4 py-3">Username</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">PIN</th>
                                    <th className="px-4 py-3">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">{u.full_name}</td>
                                        <td className="px-4 py-3 font-mono">{u.username}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {u.role.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono">****</td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => setEditingUser(u)} className="text-blue-600 hover:underline mr-3">Edit</button>
                                            <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:underline">Hapus</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Modal Edit User */}
                    {editingUser && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                            <form onSubmit={handleSaveUser} className="bg-white p-6 rounded shadow-lg w-full max-w-sm">
                                <h3 className="font-bold mb-4">{editingUser.id ? 'Edit User' : 'Tambah User'}</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Nama Lengkap</label>
                                        <input required className="border w-full p-2 rounded" value={editingUser.full_name} onChange={e => setEditingUser({...editingUser, full_name: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Username (Login)</label>
                                        <input required className="border w-full p-2 rounded" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Role / Hak Akses</label>
                                        <select className="border w-full p-2 rounded bg-white" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}>
                                            <option value={UserRole.CASHIER}>Kasir</option>
                                            <option value={UserRole.ADMIN}>Admin</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">PIN Code (Angka)</label>
                                        <input required type="text" className="border w-full p-2 rounded" value={editingUser.pin_code} onChange={e => setEditingUser({...editingUser, pin_code: e.target.value})} placeholder="Contoh: 1234" />
                                    </div>
                                    <div className="pt-2 flex gap-2">
                                        <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded">Simpan</button>
                                        <button type="button" onClick={() => setEditingUser(null)} className="flex-1 bg-slate-200 py-2 rounded">Batal</button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'database' && (
              <div>
                 <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded mb-6 text-sm">
                    <strong>Perhatian:</strong> Masukkan URL dan Key dari Project Supabase Anda. Data ini akan disimpan di browser (LocalStorage).
                 </div>
                 <form onSubmit={handleSaveDB} className="space-y-4 mb-8">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Supabase URL</label>
                      <input className="border w-full p-2 rounded font-mono text-sm" placeholder="https://xyz.supabase.co" value={dbConfig.url} onChange={e=>setDbConfig({...dbConfig, url:e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Supabase Anon Key</label>
                      <input className="border w-full p-2 rounded font-mono text-sm" type="password" placeholder="eyJh..." value={dbConfig.key} onChange={e=>setDbConfig({...dbConfig, key:e.target.value})}/>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700">Simpan & Koneksikan</button>
                      <button type="button" onClick={handleResetDB} className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300 text-slate-700">Reset</button>
                    </div>
                 </form>

                 <div className="border-t pt-6">
                    <h3 className="font-bold mb-2">Schema SQL Database</h3>
                    <p className="text-xs text-slate-500 mb-2">Salin kode ini dan jalankan di menu <strong>SQL Editor</strong> pada dashboard Supabase Anda untuk membuat tabel.</p>
                    <div className="relative">
                      <pre className="bg-slate-800 text-slate-100 p-4 rounded text-xs font-mono h-64 overflow-y-auto whitespace-pre-wrap">{SQL_SCHEMA}</pre>
                      <button 
                        onClick={() => { navigator.clipboard.writeText(SQL_SCHEMA); alert('Schema SQL berhasil disalin!'); }}
                        className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded text-xs border border-white/20"
                      >
                        Copy SQL
                      </button>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
};

// --- MAIN APP LAYOUT ---
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('dashboard');
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    DataService.getSettings()
      .then(setSettings)
      // Prevent app from getting stuck on 'Loading...' if DB fails
      .catch(() => setSettings({ 
        name: 'YusaPos Store', 
        address: 'Offline Mode / Error', 
        phone: '-', 
        footer_message: 'System Error', 
        printer_width: '58mm' 
      }));
  }, []);

  if (!user) return <Login onLogin={setUser} />;
  if (!settings) return <div className="flex h-screen items-center justify-center text-indigo-600">Loading System...</div>;

  const MenuItem = ({ id, label, icon: Icon }: any) => (
    <button 
      onClick={() => { setView(id); setSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${view === id ? 'bg-indigo-700 text-white shadow-lg' : 'text-slate-300 hover:bg-indigo-800'}`}
    >
      <Icon /> {label}
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-300 transform md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight">YusaPos <span className="text-indigo-400">App</span></h1>
            <div className="text-xs text-slate-400 mt-1 truncate max-w-[150px]">{settings.name}</div>
            {isUsingSupabase ? <span className="text-[10px] text-green-400 flex items-center gap-1 mt-1">● Online DB</span> : <span className="text-[10px] text-yellow-400 flex items-center gap-1 mt-1">● Demo Mode</span>}
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400"><Icons.Close /></button>
        </div>
        
        <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
          {user.role === UserRole.ADMIN && <MenuItem id="dashboard" label="Dashboard" icon={Icons.Dashboard} />}
          <MenuItem id="pos" label="Kasir (POS)" icon={Icons.POS} />
          {user.role === UserRole.ADMIN && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase mt-4">Transaksi</div>
              <MenuItem id="purchasing" label="Pembelian" icon={Icons.Purchase} />

              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase mt-4">Master Data</div>
              <MenuItem id="products" label="Produk" icon={Icons.Product} />
              <MenuItem id="customers" label="Pelanggan" icon={Icons.Users} />
              <MenuItem id="suppliers" label="Supplier" icon={Icons.Truck} />
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase mt-4">Laporan</div>
              <MenuItem id="reports" label="Laporan" icon={Icons.Report} />
              <MenuItem id="settings" label="Pengaturan" icon={Icons.Settings} />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm shrink-0">
              {user.username[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium truncate">{user.full_name}</div>
              <div className="text-xs text-slate-400 capitalize">{user.role}</div>
            </div>
          </div>
          <button onClick={() => setUser(null)} className="mt-4 w-full text-xs text-red-400 hover:text-red-300 border border-slate-700 rounded py-2 hover:bg-slate-800 transition">Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        {/* Mobile Header */}
        <div className="bg-white shadow-sm p-4 flex items-center gap-3 md:hidden shrink-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-700"><Icons.Menu /></button>
          <h1 className="font-bold text-lg text-indigo-700">YusaPos</h1>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100">
            {view === 'dashboard' && <Dashboard />}
            {view === 'pos' && <POS user={user} settings={settings} />}
            {view === 'purchasing' && <PurchaseManager user={user} />}
            {view === 'products' && <ProductManager />}
            {view === 'customers' && <CustomerManager />}
            {view === 'suppliers' && <SupplierManager />}
            {view === 'reports' && <ReportPage />}
            {view === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}

export default App;