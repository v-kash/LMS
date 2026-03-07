"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function RevenueDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [source, setSource] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [users, setUsers] = useState([]);
  const [salespersonSearch, setSalespersonSearch] = useState("");
  const [showSalespersonDropdown, setShowSalespersonDropdown] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  // async function fetchReport(filters = {}) {
  //   setLoading(true);
  //   const params = new URLSearchParams();

  //   if (filters.from && filters.to) {
  //     params.append("from", filters.from);
  //     params.append("to", filters.to);
  //   }
  //   if (filters.source) params.append("source", filters.source);
  //   if (filters.salesperson)
  //     params.append("salesperson_id", filters.salesperson);

  //   const res = await fetch(`/api/reports/revenue?${params.toString()}`);
  //   const json = await res.json();
  //   setData(json);
  //   setLoading(false);
  // }

  async function fetchReport(filters = {}, currentPage = page) {
    setLoading(true);

    const params = new URLSearchParams();

    if (filters.from && filters.to) {
      params.append("from", filters.from);
      params.append("to", filters.to);
    }

    if (filters.source) params.append("source", filters.source);
    if (filters.salesperson)
      params.append("salesperson_id", filters.salesperson);

    params.append("page", currentPage);
    params.append("limit", limit);

    const res = await fetch(`/api/reports/revenue?${params.toString()}`);
    const json = await res.json();

    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    fetchReport({ from: fromDate, to: toDate, source, salesperson }, page);
  }, [page]);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users"); // must return sales users
        const json = await res.json();
        setUsers(json.users || []);
      } catch (err) {
        setUsers([]);
      }
    }

    fetchUsers();
  }, []);

  useEffect(() => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const from = firstDay.toISOString().split("T")[0];
  const to = today.toISOString().split("T")[0];

  setFromDate(from);
  setToDate(to);

  fetchReport({ from, to }, 1);
}, []);


  const filteredSalesUsers = users.filter((u) =>
    u.name.toLowerCase().includes(salespersonSearch.toLowerCase()),
  );

  useEffect(() => {
    function handleClickOutside(e) {
      if (!e.target.closest(".relative")) {
        setShowSalespersonDropdown(false);
      }
    }

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-600">Loading revenue data...</p>
        </div>
      </div>
    );
  }

  const totalConversions =
    data.bySource?.reduce((sum, s) => sum + s.conversions, 0) || 0;
  const avgDeal =
    totalConversions > 0 ? Math.round(data.totalRevenue / totalConversions) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-sm">NG</span>
                </div>
                <span className="text-slate-900 font-semibold text-lg">
                  NextGen LMS
                </span>
              </div>

              <nav className="hidden md:flex items-center gap-1">
                <Link
                  href="/dashboard/manager"
                  className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/revenue"
                  className="px-3 py-2 text-sm font-medium text-slate-900 bg-slate-100 rounded-md"
                >
                  Revenue
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">
            Revenue Analytics
          </h1>
          <p className="text-sm text-slate-600">
            Track revenue performance across sources and sales team
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Filters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border text-gray-800 border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border text-gray-800 border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 bg-white border text-gray-800 border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              >
                <option value="">All Sources</option>
                <option value="META">Meta Ads</option>
                <option value="WEBSITE">Website</option>
                <option value="EXCEL">Excel Import</option>
              </select>
            </div>

            <div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Salesperson
                </label>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search salesperson..."
                    value={salespersonSearch}
                    onFocus={() => setShowSalespersonDropdown(true)}
                    onChange={(e) => setSalespersonSearch(e.target.value)}
                    className="w-full px-3 py-2 text-gray-800 bg-white border border-slate-300 rounded-md text-sm outline-none"
                  />

                  {showSalespersonDropdown && (
                    <div className="absolute top-full mt-1 w-full text-gray-800 bg-white rounded-md shadow-lg border border-slate-200 max-h-48 overflow-y-auto z-50">
                      {/* All option */}
                      <div
                        onClick={() => {
                          setSalesperson("");
                          setSalespersonSearch("");
                          setShowSalespersonDropdown(false);
                        }}
                        className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer"
                      >
                        All Salespeople
                      </div>

                      {filteredSalesUsers.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setSalesperson(u.id);
                            setSalespersonSearch(u.name);
                            setShowSalespersonDropdown(false);
                          }}
                          className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer"
                        >
                          {u.name}
                        </div>
                      ))}

                      {filteredSalesUsers.length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-500">
                          No users found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setPage(1);
                  fetchReport(
                    { from: fromDate, to: toDate, source, salesperson },
                    1,
                  );
                }}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-all"
              >
                Apply Filters
              </button>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  setSource("");
                  setSalesperson("");
                  setSalespersonSearch("")
                  setShowSalespersonDropdown(false)

                  fetchReport();
                }}
                className="w-full px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <KpiCard
            label="Total Revenue"
            value={`₹${data.totalRevenue?.toLocaleString() || 0}`}
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <KpiCard
            label="Total Conversions"
            value={totalConversions}
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <KpiCard
            label="Average Deal Size"
            value={`₹${avgDeal.toLocaleString()}`}
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            }
          />
          <KpiCard
            label="Transactions"
            value={data.transactions?.length || 0}
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            }
          />
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue by Source */}
          {data.bySource && data.bySource.length > 0 && (
            <Section title="Revenue by Source">
              <div className="space-y-3">
                {data.bySource.map((item) => (
                  <div
                    key={item.source}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-900 rounded-md flex items-center justify-center text-white text-xs font-medium">
                        {item.source.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {item.source}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.conversions} conversions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        ₹{item.revenue.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Revenue by Salesperson */}
          {data.bySalesperson && data.bySalesperson.length > 0 && (
            <Section title="Revenue by Salesperson">
              <div className="space-y-3">
                {data.bySalesperson.map((item) => (
                  <div
                    key={item.salesperson}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-emerald-700">
                          {item.salesperson.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {item.salesperson}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.conversions} conversions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        ₹{item.revenue.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        

        {/* Transactions Table */}
        <Section title="Revenue Transactions">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Lead
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Salesperson
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(!data.transactions || data.transactions.length === 0) && (
                  <tr>
                    <td colSpan="6" className="px-6 py-12">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                          <svg
                            className="w-6 h-6 text-slate-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-slate-900">
                          No revenue transactions found
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Try adjusting your filters
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {data.transactions?.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-slate-900">
                      {new Date(t.converted_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-900">
                      {t.lead_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {t.source}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-900">
                      {t.salesperson}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {t.product || "-"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-semibold text-emerald-600">
                        ₹{t.amount.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        {data.pagination?.totalPages > 1 && (
  <div className="flex items-center justify-between mt-6">
    <div className="text-sm text-slate-600">
      Page <span className="font-medium text-slate-900">{page}</span> of{" "}
      <span className="font-medium text-slate-900">
        {data.pagination.totalPages}
      </span>
    </div>

    <div className="flex gap-2">
      <button
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
        className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Previous
      </button>

      <button
        disabled={page >= data.pagination.totalPages}
        onClick={() => setPage(page + 1)}
        className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  </div>
)}

        </Section>
      </main>
    </div>
  );
}

/* ---------- Components ---------- */

function KpiCard({ label, value, icon }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center text-slate-600">
          {icon}
        </div>
      </div>
      <p className="text-sm font-medium text-slate-600 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
