'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { apiFetch } from '../lib/supabaseClient';

const TABS = [
  { id: 'Overview', icon: '📊' },
  { id: 'Transactions', icon: '🧾' },
  { id: 'Services', icon: '💅' },
  { id: 'Staff', icon: '👥' },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('Overview');
  const [summary, setSummary] = useState({ today: 0, week: 0, month: 0 });
  const [period, setPeriod] = useState('daily');
  const [series, setSeries] = useState([]);
  const [breakdown, setBreakdown] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [filters, setFilters] = useState({ payment_method: '', status: '', q: '' });
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newService, setNewService] = useState({ name: '', category: 'Hair', base_price: '', duration_mins: '30' });
  const [newStaff, setNewStaff] = useState({ full_name: '', role: 'handler', phone: '' });
  const [showAddService, setShowAddService] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);

  useEffect(() => {
    apiFetch('/api/dashboard/summary').then(setSummary).catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch(`/api/dashboard/revenue?period=${period}`).then(setSeries).catch(() => {});
    apiFetch(`/api/dashboard/payment-breakdown?period=${period}`).then(setBreakdown).catch(() => {});
  }, [period]);

  useEffect(() => {
    if (tab !== 'Transactions') return;
    setLoading(true);
    const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
    apiFetch(`/api/transactions?${params}`)
      .then(setTransactions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab, filters]);

  useEffect(() => {
    if (tab === 'Services') apiFetch('/api/services').then(setServices).catch(() => {});
    if (tab === 'Staff') apiFetch('/api/staff').then(setStaff).catch(() => {});
  }, [tab]);

  const voidTransaction = async (id) => {
    const reason = prompt('Reason for voiding this transaction:');
    if (!reason) return;
    try {
      await apiFetch(`/api/transactions/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
      setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'voided', void_reason: reason } : t)));
    } catch (e) {
      alert('Error voiding transaction: ' + e.message);
    }
  };

  const updateServicePrice = async (id, base_price) => {
    try {
      await apiFetch('/api/services', { method: 'PATCH', body: JSON.stringify({ id, base_price }) });
    } catch (e) {
      alert('Failed to update service: ' + e.message);
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      const created = await apiFetch('/api/services', { method: 'POST', body: JSON.stringify(newService) });
      setServices((prev) => [...prev, created]);
      setNewService({ name: '', category: 'Hair', base_price: '', duration_mins: '30' });
      setShowAddService(false);
    } catch (e) {
      alert('Error creating service: ' + e.message);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      const created = await apiFetch('/api/staff', { method: 'POST', body: JSON.stringify(newStaff) });
      setStaff((prev) => [created, ...prev]);
      setNewStaff({ full_name: '', role: 'handler', phone: '' });
      setShowAddStaff(false);
    } catch (e) {
      alert('Error adding staff: ' + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF4F0] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#2E1620] text-[#FAF4F0] p-6 flex flex-col shrink-0 border-r border-[#3B2530]">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-3 h-3 rounded-full bg-[#A63D5B]" />
          <span className="font-serif text-xl text-white font-bold">Skyline Beauty Parlour</span>
        </div>
        <nav className="space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                tab === t.id
                  ? 'bg-[#A63D5B] text-white shadow-xs'
                  : 'text-[#C9A9B4] hover:bg-[#3B2530] hover:text-white'
              }`}
            >
              <span className="text-base">{t.icon}</span>
              <span>{t.id}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        {tab === 'Overview' && (
          <>
            <header className="mb-8">
              <p className="text-xs text-[#A63D5B] font-bold uppercase tracking-wider">Financial Intelligence</p>
              <h1 className="font-serif text-3xl text-[#2E1620]">Revenue &amp; Analytics</h1>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <SummaryCard label="Today's Revenue" value={summary.today} />
              <SummaryCard label="This Week" value={summary.week} />
              <SummaryCard label="This Month" value={summary.month} />
            </div>

            <div className="bg-white border border-[#EBDFD9] rounded-3xl p-6 mb-8 shadow-xs">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-serif text-xl text-[#2E1620]">Revenue Trend</h2>
                <div className="flex gap-2 bg-[#FAF4F0] p-1 rounded-full border border-[#EBDFD9]">
                  {['daily', 'weekly', 'monthly'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        period === p
                          ? 'bg-[#2E1620] text-white shadow-xs'
                          : 'text-[#6b5a61] hover:text-[#2E1620]'
                      }`}
                    >
                      {p[0].toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}>
                    <CartesianGrid stroke="#FAF4F0" vertical={false} />
                    <XAxis
                      dataKey="period"
                      tickFormatter={(v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      stroke="#8a767d"
                      fontSize={11}
                    />
                    <YAxis stroke="#8a767d" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      formatter={(v) => [`₹${Number(v).toFixed(0)}`, 'Revenue']}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Bar dataKey="revenue" fill="#A63D5B" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <h2 className="font-serif text-xl text-[#2E1620] mb-4">Payment Method Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-[#EBDFD9] rounded-2xl p-5 shadow-xs">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#8a767d]">💵 Cash</span>
                <p className="font-serif text-3xl text-[#2E1620] mt-1 font-bold">₹{Number(breakdown.cash || 0).toFixed(0)}</p>
              </div>
              <div className="bg-white border border-[#EBDFD9] rounded-2xl p-5 shadow-xs">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#8a767d]">💳 Card</span>
                <p className="font-serif text-3xl text-[#2E1620] mt-1 font-bold">₹{Number(breakdown.card || 0).toFixed(0)}</p>
              </div>
              <div className="bg-white border border-[#EBDFD9] rounded-2xl p-5 shadow-xs">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#8a767d]">📱 UPI / QR</span>
                <p className="font-serif text-3xl text-[#2E1620] mt-1 font-bold">₹{Number(breakdown.qr || 0).toFixed(0)}</p>
              </div>
            </div>
          </>
        )}

        {tab === 'Transactions' && (
          <>
            <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-[#A63D5B] font-bold uppercase tracking-wider">Audit Log</p>
                <h1 className="font-serif text-3xl text-[#2E1620]">Transaction Register</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  placeholder="Search customer name..."
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  className="bg-white border border-[#EBDFD9] rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#A63D5B]"
                />
                <select
                  value={filters.payment_method}
                  onChange={(e) => setFilters((f) => ({ ...f, payment_method: e.target.value }))}
                  className="bg-white border border-[#EBDFD9] rounded-xl px-3.5 py-2 text-xs focus:outline-none"
                >
                  <option value="">All Methods</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="qr">UPI / QR</option>
                </select>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                  className="bg-white border border-[#EBDFD9] rounded-xl px-3.5 py-2 text-xs focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="voided">Voided</option>
                </select>
              </div>
            </header>

            <div className="bg-white border border-[#EBDFD9] rounded-3xl overflow-hidden shadow-xs">
              <table className="w-full text-xs">
                <thead className="bg-[#FAF4F0] text-[#8a767d] text-left border-b border-[#EBDFD9]">
                  <tr>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider">Date &amp; Time</th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider">Staff Handler</th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider">Method</th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider text-right">Amount</th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBDFD9]">
                  {loading && (
                    <tr>
                      <td colSpan="7" className="px-5 py-8 text-center text-[#8a767d]">Loading transactions…</td>
                    </tr>
                  )}
                  {!loading && transactions.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-5 py-8 text-center text-[#8a767d]">No transactions found matching criteria.</td>
                    </tr>
                  )}
                  {!loading && transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-[#FAF4F0]/50 transition-colors">
                      <td className="px-5 py-3.5 text-[#2E1620]">{new Date(t.created_at).toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-[#2E1620] font-medium">{t.profiles?.full_name || 'Front Desk'}</td>
                      <td className="px-5 py-3.5 text-[#2E1620]">{t.customer_name || 'Walk-in'}</td>
                      <td className="px-5 py-3.5 uppercase font-bold text-[#6b5a61]">{t.payment_method}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          t.status === 'completed' ? 'bg-[#DFF0DF] text-[#3d7a44]' :
                          t.status === 'voided' ? 'bg-[#F4D8DE] text-[#8f3450]' : 'bg-[#FCE9C9] text-[#8a6114]'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-[#2E1620]">₹{Number(t.total_amount).toFixed(0)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {t.status !== 'voided' ? (
                          <button
                            onClick={() => voidTransaction(t.id)}
                            className="text-[#A63D5B] hover:text-[#8f3450] font-bold text-xs hover:underline"
                          >
                            Void
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#8a767d] italic">{t.void_reason || 'Voided'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'Services' && (
          <>
            <header className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#A63D5B] font-bold uppercase tracking-wider">Catalog &amp; Pricing</p>
                <h1 className="font-serif text-3xl text-[#2E1620]">Services Management</h1>
              </div>
              <button
                onClick={() => setShowAddService(!showAddService)}
                className="bg-[#2E1620] hover:bg-[#3B2530] text-white text-xs font-semibold px-4 py-2.5 rounded-full transition-all shadow-xs"
              >
                {showAddService ? 'Close Form' : '+ Add New Service'}
              </button>
            </header>

            {showAddService && (
              <form onSubmit={handleCreateService} className="bg-white border border-[#EBDFD9] rounded-2xl p-6 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4 shadow-xs">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#8a767d] mb-1 font-semibold">Service Name</label>
                  <input
                    required
                    value={newService.name}
                    onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))}
                    placeholder="e.g. Keratin Treatment"
                    className="w-full bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#8a767d] mb-1 font-semibold">Category</label>
                  <select
                    value={newService.category}
                    onChange={(e) => setNewService((s) => ({ ...s, category: e.target.value }))}
                    className="w-full bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="Hair">Hair</option>
                    <option value="Skin">Skin</option>
                    <option value="Nails">Nails</option>
                    <option value="Threading">Threading</option>
                    <option value="Waxing">Waxing</option>
                    <option value="Makeup">Makeup</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#8a767d] mb-1 font-semibold">Base Price (₹)</label>
                  <input
                    required
                    type="number"
                    value={newService.base_price}
                    onChange={(e) => setNewService((s) => ({ ...s, base_price: e.target.value }))}
                    placeholder="1200"
                    className="w-full bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full bg-[#A63D5B] hover:bg-[#8f3450] text-white text-xs font-semibold py-2.5 rounded-xl transition-all">
                    Save Service
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white border border-[#EBDFD9] rounded-3xl divide-y divide-[#EBDFD9] overflow-hidden shadow-xs">
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#FAF4F0]/40 transition-colors">
                  <div>
                    <span className="text-[10px] text-[#A63D5B] font-bold uppercase tracking-wider">{s.category}</span>
                    <p className="font-semibold text-sm text-[#2E1620]">{s.name}</p>
                    <p className="text-[11px] text-[#8a767d]">Duration: {s.duration_mins} mins</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#8a767d]">₹</span>
                    <input
                      type="number"
                      defaultValue={s.base_price}
                      onBlur={(e) => updateServicePrice(s.id, Number(e.target.value))}
                      className="w-28 bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3 py-1.5 text-xs text-right font-bold text-[#2E1620] focus:outline-none focus:border-[#A63D5B]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'Staff' && (
          <>
            <header className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#A63D5B] font-bold uppercase tracking-wider">Team &amp; Access Control</p>
                <h1 className="font-serif text-3xl text-[#2E1620]">Staff Roster</h1>
              </div>
              <button
                onClick={() => setShowAddStaff(!showAddStaff)}
                className="bg-[#2E1620] hover:bg-[#3B2530] text-white text-xs font-semibold px-4 py-2.5 rounded-full transition-all shadow-xs"
              >
                {showAddStaff ? 'Close Form' : '+ Add Staff Account'}
              </button>
            </header>

            {showAddStaff && (
              <form onSubmit={handleCreateStaff} className="bg-white border border-[#EBDFD9] rounded-2xl p-6 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4 shadow-xs">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#8a767d] mb-1 font-semibold">Full Name</label>
                  <input
                    required
                    value={newStaff.full_name}
                    onChange={(e) => setNewStaff((s) => ({ ...s, full_name: e.target.value }))}
                    placeholder="e.g. Sanya Mirza"
                    className="w-full bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#8a767d] mb-1 font-semibold">Role</label>
                  <select
                    value={newStaff.role}
                    onChange={(e) => setNewStaff((s) => ({ ...s, role: e.target.value }))}
                    className="w-full bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="handler">Handler (Front Desk)</option>
                    <option value="admin">Admin (Owner)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#8a767d] mb-1 font-semibold">Phone Number</label>
                  <input
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff((s) => ({ ...s, phone: e.target.value }))}
                    placeholder="9876543210"
                    className="w-full bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full bg-[#A63D5B] hover:bg-[#8f3450] text-white text-xs font-semibold py-2.5 rounded-xl transition-all">
                    Create Staff Logins
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white border border-[#EBDFD9] rounded-3xl divide-y divide-[#EBDFD9] overflow-hidden shadow-xs">
              {staff.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#FAF4F0]/40 transition-colors">
                  <div>
                    <p className="font-semibold text-sm text-[#2E1620]">{s.full_name}</p>
                    <p className="text-[11px] text-[#8a767d]">Role: <strong className="capitalize">{s.role}</strong> · Phone: {s.phone || 'N/A'}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                    s.is_active ? 'bg-[#DFF0DF] text-[#3d7a44]' : 'bg-[#F4D8DE] text-[#8f3450]'
                  }`}>
                    {s.is_active ? 'Active' : 'Deactivated'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white border border-[#EBDFD9] rounded-3xl p-6 shadow-xs">
      <p className="text-xs uppercase tracking-wider font-semibold text-[#8a767d]">{label}</p>
      <p className="font-serif text-3xl text-[#2E1620] mt-1 font-bold">₹{Number(value).toFixed(0)}</p>
    </div>
  );
}
