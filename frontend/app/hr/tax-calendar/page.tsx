"use client";
import { useState, useEffect, useMemo } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Deadline {
  id: number;
  title: string;
  description: string;
  category: string;
  deadline_date: string;
  alert_d7: number;
  alert_d1: number;
  status: string;
  gcal_event_id: string | null;
  ya: number | null;
}

interface Summary {
  overdue: number;
  upcoming: number;
  completed: number;
  due_soon: number;
  total: number;
}

const CATEGORIES = ["Corporate Tax", "GST", "Employment", "Individual Tax", "Withholding Tax", "Other"];

const categoryColors: Record<string, string> = {
  "Corporate Tax": "bg-blue-100 text-blue-700 border-blue-200",
  "GST": "bg-purple-100 text-purple-700 border-purple-200",
  "Employment": "bg-green-100 text-green-700 border-green-200",
  "Individual Tax": "bg-orange-100 text-orange-700 border-orange-200",
  "Withholding Tax": "bg-red-100 text-red-700 border-red-200",
  "Other": "bg-gray-100 text-gray-700 border-gray-200",
};

const statusBadge: Record<string, string> = {
  overdue: "bg-red-500 text-white",
  due_today: "bg-red-400 text-white",
  upcoming: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

const statusLabel: Record<string, string> = {
  overdue: "Overdue",
  due_today: "Due Today",
  upcoming: "Upcoming",
  completed: "Completed",
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric" });
}

export default function TaxCalendarPage() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterYa, setFilterYa] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeadline, setNewDeadline] = useState({ title: "", description: "", category: "Corporate Tax", deadline_date: "", ya: 2026 });
  // Calendar state
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dlRes, sumRes] = await Promise.all([
        fetch(`${API}/api/hr/tax-calendar`),
        fetch(`${API}/api/hr/tax-calendar/summary`),
      ]);
      if (dlRes.ok) setDeadlines(await dlRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return deadlines.filter((d) => {
      if (filterCategory !== "all" && d.category !== filterCategory) return false;
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (filterYa !== "all" && String(d.ya) !== filterYa) return false;
      return true;
    });
  }, [deadlines, filterCategory, filterStatus, filterYa]);

  const yaOptions = useMemo(() => {
    const yas = new Set(deadlines.map((d) => d.ya).filter(Boolean));
    return Array.from(yas).sort() as number[];
  }, [deadlines]);

  const handleComplete = async (id: number) => {
    await fetch(`${API}/api/hr/tax-calendar/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    fetchData();
  };

  const handleReopen = async (id: number) => {
    await fetch(`${API}/api/hr/tax-calendar/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "upcoming" }),
    });
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this deadline?")) return;
    await fetch(`${API}/api/hr/tax-calendar/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleAdd = async () => {
    if (!newDeadline.title || !newDeadline.deadline_date) return;
    await fetch(`${API}/api/hr/tax-calendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDeadline),
    });
    setShowAddModal(false);
    setNewDeadline({ title: "", description: "", category: "Corporate Tax", deadline_date: "", ya: 2026 });
    fetchData();
  };

  // Calendar grid helpers
  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1);
    const startDay = first.getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    return cells;
  }, [calMonth, calYear]);

  const deadlinesByDate = useMemo(() => {
    const map: Record<string, Deadline[]> = {};
    for (const d of filtered) {
      const key = d.deadline_date;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    }
    return map;
  }, [filtered]);

  const monthName = new Date(calYear, calMonth).toLocaleString("en-US", { month: "long", year: "numeric" });
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">Singapore tax filing deadlines & alerts</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-[#2A72E5] text-white rounded-lg text-sm font-medium hover:bg-[#1E5DC8] transition"
        >
          + Add Deadline
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
          </div>
          <div className={`rounded-xl border p-4 ${summary.overdue > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
            <div className="text-sm text-gray-500">Overdue</div>
            <div className={`text-2xl font-bold ${summary.overdue > 0 ? "text-red-600" : "text-gray-900"}`}>{summary.overdue}</div>
          </div>
          <div className={`rounded-xl border p-4 ${summary.due_soon > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
            <div className="text-sm text-gray-500">Due in 30 days</div>
            <div className={`text-2xl font-bold ${summary.due_soon > 0 ? "text-amber-600" : "text-gray-900"}`}>{summary.due_soon}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Completed</div>
            <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
          </div>
        </div>
      )}

      {/* Filters & View Toggle */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="all">All Status</option>
          <option value="overdue">Overdue</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
        </select>
        <select value={filterYa} onChange={(e) => setFilterYa(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="all">All YA</option>
          {yaOptions.map((y) => <option key={y} value={y}>YA{y}</option>)}
        </select>
        <div className="ml-auto flex bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setView("calendar")} className={`px-3 py-1 text-sm rounded-md ${view === "calendar" ? "bg-white shadow text-gray-900 font-medium" : "text-gray-500"}`}>Calendar</button>
          <button onClick={() => setView("list")} className={`px-3 py-1 text-sm rounded-md ${view === "list" ? "bg-white shadow text-gray-900 font-medium" : "text-gray-500"}`}>List</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : view === "calendar" ? (
        /* Calendar View */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }} className="p-1 hover:bg-gray-100 rounded text-gray-500">&larr;</button>
            <h2 className="font-semibold text-lg">{monthName}</h2>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }} className="p-1 hover:bg-gray-100 rounded text-gray-500">&rarr;</button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-400 border-b">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calDays.map((day, i) => {
              const dateStr = day ? `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
              const events = dateStr ? (deadlinesByDate[dateStr] || []) : [];
              const isToday = dateStr === todayStr;
              return (
                <div key={i} className={`min-h-[100px] border-b border-r p-1.5 ${day ? "" : "bg-gray-50"} ${isToday ? "bg-blue-50" : ""}`}>
                  {day && (
                    <>
                      <div className={`text-xs font-medium mb-1 ${isToday ? "text-[#2A72E5] font-bold" : "text-gray-500"}`}>{day}</div>
                      {events.map((ev) => {
                        const catColor = ev.status === "completed"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : ev.status === "overdue"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : (categoryColors[ev.category] || categoryColors["Other"]);
                        return (
                          <div
                            key={ev.id}
                            className={`text-[10px] leading-tight px-1.5 py-1 mb-0.5 rounded border truncate cursor-default ${catColor}`}
                            title={`${ev.title}\n${ev.description}`}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">YA</th>
                <th className="px-4 py-3">D-Day</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const days = daysUntil(d.deadline_date);
                const dDayLabel = d.status === "completed" ? "Done" : days === 0 ? "D-Day" : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
                return (
                  <tr key={d.id} className="border-b hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[d.status] || statusBadge.upcoming}`}>
                        {statusLabel[d.status] || d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{formatDate(d.deadline_date)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{d.title}</div>
                      {d.description && <div className="text-xs text-gray-400 mt-0.5">{d.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${categoryColors[d.category] || categoryColors["Other"]}`}>
                        {d.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{d.ya ? `YA${d.ya}` : "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs font-bold ${days <= 0 && d.status !== "completed" ? "text-red-600" : days <= 7 ? "text-amber-600" : "text-gray-500"}`}>
                        {dDayLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {d.status !== "completed" ? (
                        <button onClick={() => handleComplete(d.id)} className="text-xs text-green-600 hover:text-green-800 font-medium">Complete</button>
                      ) : (
                        <button onClick={() => handleReopen(d.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Reopen</button>
                      )}
                      <button onClick={() => handleDelete(d.id)} className="text-xs text-red-400 hover:text-red-600 ml-2">Delete</button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No deadlines found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Add Tax Deadline</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Title *</label>
                <input value={newDeadline.title} onChange={(e) => setNewDeadline({ ...newDeadline, title: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. GST Return — Q1 2026" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Description</label>
                <input value={newDeadline.description} onChange={(e) => setNewDeadline({ ...newDeadline, description: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Category</label>
                  <select value={newDeadline.category} onChange={(e) => setNewDeadline({ ...newDeadline, category: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">YA</label>
                  <input type="number" value={newDeadline.ya} onChange={(e) => setNewDeadline({ ...newDeadline, ya: parseInt(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Deadline Date *</label>
                <input type="date" value={newDeadline.deadline_date} onChange={(e) => setNewDeadline({ ...newDeadline, deadline_date: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleAdd} className="px-4 py-2 bg-[#2A72E5] text-white rounded-lg text-sm font-medium hover:bg-[#1E5DC8]">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
