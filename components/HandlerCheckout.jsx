'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { apiFetch } from '../lib/supabaseClient';

const PAYMENT_METHODS = [
  { id: 'cash', label: '💵 Cash' },
  { id: 'card', label: '💳 Card' },
  { id: 'qr', label: '📱 UPI / QR Payment' },
];

export default function HandlerCheckout() {
  const [services, setServices] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]); // [{ service_id, name, price, quantity, is_custom_price }]
  const [customPrice, setCustomPrice] = useState('');
  const [customName, setCustomName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState('');
  const [stage, setStage] = useState('building'); // building | awaiting-qr | done
  const [completedTxn, setCompletedTxn] = useState(null);
  const [pendingTxn, setPendingTxn] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [error, setError] = useState('');
  const [loadingServices, setLoadingServices] = useState(true);

  useEffect(() => {
    setLoadingServices(true);
    apiFetch('/api/services')
      .then((data) => setServices(data || []))
      .catch((e) => setError('Failed to load services: ' + e.message))
      .finally(() => setLoadingServices(false));
    refreshLedger();
  }, []);

  const refreshLedger = () => {
    apiFetch('/api/transactions/today')
      .then((data) => setLedger(data || []))
      .catch(() => {});
  };

  const categories = useMemo(() => {
    const cats = ['All', ...new Set(services.map((s) => s.category).filter(Boolean))];
    return cats;
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchCat = selectedCategory === 'All' || s.category === selectedCategory;
      const matchQuery = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [services, selectedCategory, searchQuery]);

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0),
    [cart]
  );

  const total = useMemo(
    () => Math.max(subtotal - Number(discount || 0), 0),
    [subtotal, discount]
  );

  const addService = (service) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.service_id === service.id);
      if (existing) {
        return prev.map((i) =>
          i.service_id === service.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { service_id: service.id, name: service.name, price: Number(service.base_price), quantity: 1 }];
    });
  };

  const updateQuantity = (idx, delta) => {
    setCart((prev) =>
      prev
        .map((item, i) => {
          if (i === idx) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const addCustomItem = (e) => {
    e.preventDefault();
    if (!customName || !customPrice) return;
    setCart((prev) => [
      ...prev,
      { service_id: null, name: customName, price: Number(customPrice), quantity: 1, is_custom_price: true },
    ]);
    setCustomName('');
    setCustomPrice('');
  };

  const removeItem = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx));

  const startCheckout = useCallback(async () => {
    if (cart.length === 0) return;
    setError('');
    try {
      const txn = await apiFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          items: cart,
          discount: Number(discount || 0),
          payment_method: paymentMethod,
          customer_name: customerName,
          customer_phone: customerPhone,
        }),
      });
      if (paymentMethod === 'qr') {
        setPendingTxn(txn);
        setStage('awaiting-qr');
      } else {
        setCompletedTxn(txn);
        setStage('done');
        refreshLedger();
      }
    } catch (e) {
      setError(e.message);
    }
  }, [cart, discount, paymentMethod, customerName, customerPhone]);

  const confirmQrPayment = async () => {
    try {
      const updated = await apiFetch(`/api/transactions/${pendingTxn.id}/confirm`, { method: 'POST' });
      setCompletedTxn(updated || pendingTxn);
      setStage('done');
      refreshLedger();
    } catch (e) {
      setError(e.message);
    }
  };

  const startNewBill = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscount('');
    setPaymentMethod('cash');
    setPendingTxn(null);
    setCompletedTxn(null);
    setStage('building');
  };

  // ---------------------------------------------------------------- UI ---
  if (stage === 'awaiting-qr' && pendingTxn) {
    return (
      <div className="min-h-screen bg-[#2E1620] flex flex-col items-center justify-center px-6 py-12 text-[#FAF4F0]">
        <div className="bg-[#3B2530] border border-[#523543] rounded-3xl p-8 max-w-sm w-full flex flex-col items-center text-center shadow-xl">
          <span className="uppercase tracking-widest text-[11px] text-[#A63D5B] font-bold mb-1">
            Dynamic UPI QR Payment
          </span>
          <h1 className="font-serif text-4xl text-white mb-2">₹{Number(pendingTxn.total_amount).toFixed(2)}</h1>
          <p className="text-xs text-[#C9A9B4] mb-6">
            Customer: <strong className="text-white">{pendingTxn.customer_name || 'Guest'}</strong>
          </p>

          <div className="bg-white p-4 rounded-2xl shadow-inner border-4 border-[#FAF4F0] mb-6">
            <QRCodeCanvas value={pendingTxn.qr_payload || `upi://pay?am=${pendingTxn.total_amount}`} size={200} />
          </div>

          <p className="text-xs text-[#C9A9B4] mb-6 leading-relaxed">
            Scan using any GPay, PhonePe, Paytm, or BHIM app. Tap below once the payment lands.
          </p>

          <button
            onClick={confirmQrPayment}
            className="w-full bg-[#A63D5B] hover:bg-[#8f3450] text-white font-medium text-sm py-3 rounded-full transition-all shadow-md active:scale-98 mb-3"
          >
            ✓ Confirm Payment Received
          </button>
          <button
            onClick={() => setStage('building')}
            className="text-xs text-[#C9A9B4] hover:text-white underline transition-colors"
          >
            Cancel and edit bill
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="min-h-screen bg-[#FAF4F0] flex flex-col items-center justify-center px-6 py-12">
        <div className="bg-white border border-[#EBDFD9] rounded-3xl p-8 max-w-sm w-full text-center shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-[#DFF0DF] border border-[#B3DEB3] flex items-center justify-center mb-4 text-[#3d7a44]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 12l5 5L20 6" />
            </svg>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#A63D5B] mb-1">Success</span>
          <h1 className="font-serif text-3xl text-[#2E1620] mb-1">Payment Recorded</h1>
          <p className="text-xl font-bold text-[#2E1620] mb-4">₹{(completedTxn?.total_amount || total).toFixed(2)}</p>

          <div className="w-full bg-[#FAF4F0] rounded-2xl p-4 text-xs text-[#6b5a61] space-y-2 mb-6 text-left border border-[#EBDFD9]">
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="font-medium text-[#2E1620]">{completedTxn?.customer_name || customerName || 'Walk-in Guest'}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment Method:</span>
              <span className="font-semibold text-[#2E1620] uppercase">{completedTxn?.payment_method || paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span>Time:</span>
              <span className="text-[#2E1620]">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          <button
            onClick={startNewBill}
            className="w-full bg-[#2E1620] hover:bg-[#3B2530] text-white font-medium text-sm py-3 rounded-full transition-all shadow-sm"
          >
            Start Next Bill
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF4F0] pb-48">
      {/* Header */}
      <header className="px-6 pt-6 pb-4 bg-white border-b border-[#EBDFD9]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#A63D5B] font-bold uppercase tracking-wider">Skyline Beauty Parlour</p>
            <h1 className="font-serif text-3xl text-[#2E1620]">Checkout &amp; Billing Station</h1>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="🔍 Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3.5 py-2 text-xs w-full sm:w-64 focus:outline-none focus:border-[#A63D5B]"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pt-4 pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                selectedCategory === cat
                  ? 'bg-[#2E1620] text-white border-[#2E1620]'
                  : 'bg-[#FAF4F0] text-[#6b5a61] border-[#EBDFD9] hover:border-[#A63D5B]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 bg-[#F4D8DE] border border-[#E5B8C2] text-[#8f3450] text-xs px-4 py-2.5 rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold">✕</button>
        </div>
      )}

      <div className="px-6 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Services & Custom items */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[#8a767d] mb-3">
              Services ({filteredServices.length})
            </h2>
            {loadingServices ? (
              <div className="text-center py-12 text-xs text-[#8a767d]">Loading services catalog…</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredServices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => addService(s)}
                    className="text-left bg-white border border-[#EBDFD9] hover:border-[#A63D5B] rounded-2xl p-4 active:scale-95 transition-all shadow-xs flex flex-col justify-between group"
                  >
                    <div>
                      <span className="text-[10px] text-[#A63D5B] font-semibold uppercase tracking-wider">{s.category}</span>
                      <p className="font-semibold text-sm text-[#2E1620] group-hover:text-[#A63D5B] transition-colors leading-snug mt-0.5">
                        {s.name}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-bold text-sm text-[#2E1620]">₹{Number(s.base_price).toFixed(0)}</span>
                      <span className="text-[10px] bg-[#FAF4F0] text-[#6b5a61] px-2 py-0.5 rounded-md border border-[#EBDFD9]">
                        +{s.duration_mins}m
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Custom Price Override */}
          <section className="bg-white border border-[#EBDFD9] rounded-2xl p-4">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[#8a767d] mb-3">
              Custom Item / Manual Override
            </h2>
            <form onSubmit={addCustomItem} className="flex flex-col sm:flex-row gap-2">
              <input
                placeholder="Item name (e.g. Special Hair Treatment)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="flex-1 bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#A63D5B]"
              />
              <input
                placeholder="Amount ₹"
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-28 bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#A63D5B]"
              />
              <button
                type="submit"
                className="bg-[#2E1620] hover:bg-[#3B2530] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                Add Item
              </button>
            </form>
          </section>
        </div>

        {/* Current Order Summary */}
        <div className="space-y-6">
          <section className="bg-white border border-[#EBDFD9] rounded-2xl p-5 shadow-xs">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[#8a767d] mb-3 flex items-center justify-between">
              <span>Selected Items ({cart.length})</span>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-[10px] text-[#A63D5B] hover:underline">Clear all</button>
              )}
            </h2>

            {cart.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-[#EBDFD9] rounded-xl text-xs text-[#8a767d]">
                Tap services on the left to build the bill
              </div>
            ) : (
              <div className="divide-y divide-[#EBDFD9] max-h-80 overflow-y-auto pr-1">
                {cart.map((item, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between">
                    <div className="flex-1 pr-2">
                      <p className="text-xs font-semibold text-[#2E1620]">{item.name}</p>
                      <p className="text-[11px] text-[#8a767d]">₹{item.price} each</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-[#EBDFD9] rounded-lg bg-[#FAF4F0]">
                        <button
                          onClick={() => updateQuantity(idx, -1)}
                          className="px-2 py-0.5 text-xs text-[#2E1620] hover:bg-[#EBDFD9] rounded-l-lg"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-bold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(idx, 1)}
                          className="px-2 py-0.5 text-xs text-[#2E1620] hover:bg-[#EBDFD9] rounded-r-lg"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs font-bold text-[#2E1620] w-12 text-right">
                        ₹{(item.price * item.quantity).toFixed(0)}
                      </span>
                      <button onClick={() => removeItem(idx)} className="text-[#A63D5B] text-xs font-bold hover:text-red-700">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Today's Completed Bills Ledger */}
          <section className="bg-white border border-[#EBDFD9] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase tracking-wider font-semibold text-[#8a767d]">
                Today's Bills ({ledger.length})
              </h2>
              <button onClick={refreshLedger} className="text-[11px] text-[#A63D5B] hover:underline">
                Refresh
              </button>
            </div>
            <div className="divide-y divide-[#EBDFD9] max-h-60 overflow-y-auto pr-1">
              {ledger.length === 0 && (
                <p className="py-4 text-xs text-center text-[#8a767d]">No transactions recorded today.</p>
              )}
              {ledger.map((t) => (
                <div key={t.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-[#2E1620]">{t.customer_name || 'Walk-in Customer'}</p>
                    <p className="text-[10px] text-[#8a767d]">
                      {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {t.payment_method.toUpperCase()}
                    </p>
                  </div>
                  <span className="font-bold text-[#2E1620]">₹{Number(t.total_amount).toFixed(0)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Sticky Bottom Checkout Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EBDFD9] p-4 shadow-xl z-20">
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3 py-1.5 text-xs text-[#2E1620]"
              />
              <input
                placeholder="Mobile Number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3 py-1.5 text-xs text-[#2E1620]"
              />
              <input
                placeholder="Discount Amount ₹"
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3 py-1.5 text-xs text-[#2E1620]"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              <div className="flex gap-2 w-full sm:w-auto">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      paymentMethod === m.id
                        ? 'bg-[#2E1620] text-white border-[#2E1620] shadow-xs'
                        : 'bg-[#FAF4F0] text-[#2E1620] border-[#EBDFD9] hover:border-[#A63D5B]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                <div className="text-right">
                  <span className="text-[10px] text-[#8a767d] uppercase tracking-wider block">Total Pay</span>
                  <span className="font-serif text-2xl text-[#2E1620] font-bold">₹{total.toFixed(2)}</span>
                </div>

                <button
                  onClick={startCheckout}
                  className="bg-[#A63D5B] hover:bg-[#8f3450] text-white font-medium text-sm px-8 py-3 rounded-full transition-all shadow-md active:scale-98"
                >
                  {paymentMethod === 'qr' ? 'Generate UPI QR' : 'Complete Checkout'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
