import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Product, Customer, CartItem, Transaction, StoreSettings, CustomerType, Supplier, SalesReport } from './types';
import { DataService, isUsingSupabase } from './services/dataService';
import { formatRupiah, formatDate } from './utils/format';

// --- SQL SCHEMA CONSTANT ---
const SQL_SCHEMA = `-- COPY KODE INI KE SUPABASE SQL EDITOR --

-- 1. Table Profiles (Admin/Kasir)
create table profiles (
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
create table store_settings (
  id uuid default gen_random_uuid() primary key,
  name text default 'YusaPos Store',
  address text,
  phone text,
  footer_message text default 'Terima Kasih',
  printer_width text default '58mm'
);

-- 3. Table Suppliers
create table suppliers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  contact text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Table Customers
create table customers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text,
  type text default 'general', -- 'general', 'agen', 'distributor'
  address text,
  debt numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Table Products
create table products (
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
create table transactions (
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
create table transaction_items (
  id uuid default gen_random_uuid() primary key,
  transaction_id uuid references transactions(id),
  product_id uuid references products(id),
  product_name text,
  qty integer default 1,
  cost_price numeric default 0,
  price numeric default 0,
  subtotal numeric default 0
);

-- Enable RLS (Optional for simplicity, we keep it public for now or you can enable it)
alter table profiles enable row level security;
create policy "Public access" on profiles for all using (true);

alter table products enable row level security;
create policy "Public access" on products for all using (true);
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
  Settings: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Truck: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
  Cart: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Database: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
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
        <div className="mt-6 text-xs text-center text-slate-400">
          <p>Demo Admin: <span className="font-mono bg-slate-100 px-1 rounded">admin</span> | <span className="font-mono bg-slate-100 px-1 rounded">1234</span></p>
          <p className="mt-1">Demo Kasir: <span className="font-mono bg-slate-100 px-1 rounded">kasir</span> | <span className="font-mono bg-slate-100 px-1 rounded">1111</span></p>
        </div>
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const p = await DataService.getProducts();
      const c = await DataService.getCustomers();
      setProducts(p);
      setCustomers(c);
      setSelectedCustomer(c.find(x => x.type === CustomerType.GENERAL) || c[0]);
    };
    init();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement !== searchInputRef.current && e.key.length === 1) {
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getPrice = (product: Product, customer: Customer) => {
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
      if (existing) {
        return prev.map(item => item.id === product.id 
          ? { ...item, qty: item.qty + 1, subtotal: (item.qty + 1) * item.selected_price } 
          : item);
      }
      const price = getPrice(product, selectedCustomer!);
      return [...prev, { ...product, qty: 1, selected_price: price, discount: 0, subtotal: price }];
    });
    setSearch(''); 
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const grandTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const handleCheckout = async () => {
    const paid = parseInt(amountPaid.replace(/\D/g, '')) || 0;
    const isDebt = paid < grandTotal;
    
    if (isDebt && selectedCustomer?.type === CustomerType.GENERAL) {
      return alert('Pelanggan Umum tidak boleh hutang!');
    }

    const tx: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      invoice_number: `INV-${Date.now()}`,
      date: new Date().toISOString(),
      cashier_id: user.id,
      cashier_name: user.full_name,
      customer_id: selectedCustomer?.id,
      customer_name: selectedCustomer?.name || 'Umum',
      customer_type: selectedCustomer?.type || CustomerType.GENERAL,
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
  };

  useEffect(() => {
    const exactMatch = products.find(p => p.sku === search);
    if (exactMatch) {
      addToCart(exactMatch);
    }
  }, [search]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.includes(search)
  );

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
          </select>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
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
                  {formatRupiah(getPrice(p, selectedCustomer!))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Bottom Bar for Cart */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white border-t p-3 shadow-lg flex items-center justify-between z-10" onClick={() => setShowMobileCart(true)}>
             <div className="flex items-center gap-3">
               <div className="bg-indigo-600 text-white p-2 rounded-full relative">
                 <Icons.Cart />
                 {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{cart.reduce((a,b)=>a+b.qty,0)}</span>}
               </div>
               <div>
                 <div className="text-xs text-slate-500">Total Belanja</div>
                 <div className="font-bold text-indigo-700">{formatRupiah(grandTotal)}</div>
               </div>
             </div>
             <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Lihat</button>
        </div>
      </div>

      {/* Cart Area (Desktop: Sidebar, Mobile: Modal/Sheet) */}
      <div className={`fixed inset-0 z-40 bg-black/50 transition-opacity md:static md:bg-transparent md:w-96 md:flex md:flex-col md:border-l md:shadow-xl md:z-auto ${showMobileCart ? 'opacity-100' : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto'}`}>
         <div className={`absolute bottom-0 left-0 right-0 top-20 bg-white rounded-t-xl shadow-2xl flex flex-col md:static md:h-full md:rounded-none transition-transform duration-300 ${showMobileCart ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}>
            <div className="p-4 bg-indigo-700 text-white flex justify-between items-center rounded-t-xl md:rounded-none shrink-0">
              <div>
                <h2 className="text-xl font-bold">Keranjang</h2>
                <div className="text-xs opacity-75">{selectedCustomer?.name} - {selectedCustomer?.type}</div>
              </div>
              <button className="md:hidden" onClick={() => setShowMobileCart(false)}><Icons.Close /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {cart.length === 0 && <div className="text-center text-slate-400 mt-10">Keranjang Kosong</div>}
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-start bg-white p-3 rounded shadow-sm border border-slate-100">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-slate-800">{item.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {item.qty} x {formatRupiah(item.selected_price)}
                    </div>
                  </div>
                  <div className="text-right pl-2">
                    <div className="font-bold text-sm text-slate-800">{formatRupiah(item.subtotal)}</div>
                    <button onClick={() => removeFromCart(item.id)} className="text-xs text-red-500 mt-2 hover:bg-red-50 px-2 py-1 rounded transition">Hapus</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border-t shrink-0">
              <div className="flex justify-between text-lg font-bold mb-4 text-slate-800">
                <span>Total:</span>
                <span>{formatRupiah(grandTotal)}</span>
              </div>
              <button 
                disabled={cart.length === 0}
                onClick={() => setPaymentModal(true)}
                className="w-full bg-green-600 text-white py-3.5 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 text-lg shadow-lg shadow-green-200"
              >
                BAYAR SEKARANG
              </button>
            </div>
         </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-4">Pembayaran</h3>
            <div className="mb-4 p-4 bg-slate-50 rounded-lg text-center border border-slate-100">
              <label className="block text-xs uppercase text-slate-500 mb-1 tracking-wider">Total Tagihan</label>
              <div className="text-3xl font-bold text-slate-800">{formatRupiah(grandTotal)}</div>
            </div>
            <div className="mb-6">
              <label className="block text-sm mb-2 font-medium">Jumlah Uang Diterima</label>
              <input 
                autoFocus
                type="number" 
                className="w-full text-xl p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                placeholder="0"
              />
              <div className="grid grid-cols-3 gap-2 mt-3">
                <button onClick={() => setAmountPaid(grandTotal.toString())} className="text-xs bg-slate-100 border px-2 py-2 rounded hover:bg-slate-200 font-medium">Uang Pas</button>
                <button onClick={() => setAmountPaid('50000')} className="text-xs bg-slate-100 border px-2 py-2 rounded hover:bg-slate-200 font-medium">50.000</button>
                <button onClick={() => setAmountPaid('100000')} className="text-xs bg-slate-100 border px-2 py-2 rounded hover:bg-slate-200 font-medium">100.000</button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPaymentModal(false)} className="flex-1 py-3 border rounded-lg hover:bg-slate-50 font-medium">Batal</button>
              <button onClick={handleCheckout} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md">Proses Bayar</button>
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

      {/* Hidden Print Receipt */}
      <div className="print-only">
        {lastTransaction && (
          <div className="p-2 text-xs font-mono" style={{ width: settings.printer_width }}>
             <div className="text-center font-bold mb-1 text-sm">{settings.name}</div>
             <div className="text-center mb-1">{settings.address}</div>
             <div className="text-center mb-2">{settings.phone}</div>
             <div className="border-b border-dashed border-black mb-2"></div>
             <div>No: {lastTransaction.invoice_number}</div>
             <div>Tgl: {formatDate(lastTransaction.date)}</div>
             <div>Kasir: {lastTransaction.cashier_name}</div>
             <div className="border-b border-dashed border-black my-2"></div>
             {lastTransaction.items.map(item => (
               <div key={item.id} className="flex justify-between mb-1">
                 <div>{item.name}<br/>{item.qty} x {formatRupiah(item.selected_price)}</div>
                 <div className="text-right">{formatRupiah(item.subtotal)}</div>
               </div>
             ))}
             <div className="border-b border-dashed border-black my-2"></div>
             <div className="flex justify-between font-bold">
               <span>Total</span>
               <span>{formatRupiah(lastTransaction.total_amount)}</span>
             </div>
             <div className="flex justify-between">
               <span>Bayar</span>
               <span>{formatRupiah(lastTransaction.amount_paid)}</span>
             </div>
             <div className="flex justify-between">
               <span>{lastTransaction.amount_paid < lastTransaction.total_amount ? 'Sisa Hutang' : 'Kembali'}</span>
               <span>{formatRupiah(Math.abs(lastTransaction.change || (lastTransaction.total_amount - lastTransaction.amount_paid)))}</span>
             </div>
             <div className="text-center mt-4 italic">{settings.footer_message}</div>
          </div>
        )}
      </div>
    </div>
  );
};

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

// --- SETTINGS COMPONENT ---
const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<StoreSettings>({ name: '', address: '', phone: '', footer_message: '', printer_width: '58mm' });
  const [dbConfig, setDbConfig] = useState({ url: '', key: '' });
  
  useEffect(() => { 
    DataService.getSettings().then(setSettings); 
    setDbConfig({
      url: localStorage.getItem('yusa_sb_url') || '',
      key: localStorage.getItem('yusa_sb_key') || ''
    });
  }, []);

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

  return (
    <div className="p-4 md:p-6">
        <h2 className="text-2xl font-bold mb-6">Pengaturan</h2>
        
        <div className="bg-white rounded-lg shadow overflow-hidden max-w-3xl">
          <div className="flex border-b">
            <button 
              onClick={() => setActiveTab('general')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition ${activeTab === 'general' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Identitas Toko & Printer
            </button>
            <button 
              onClick={() => setActiveTab('database')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition ${activeTab === 'database' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
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
    DataService.getSettings().then(setSettings);
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