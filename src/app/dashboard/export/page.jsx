"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

export default function ExportDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Filters
  const [campaignName, setCampaignName] = useState("");
  const [adName, setAdName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [timeFrom, setTimeFrom] = useState("10:00");
  const [dateTo, setDateTo] = useState("");
  const [timeTo, setTimeTo] = useState("10:00");

  // Dropdown options
  const [campaigns, setCampaigns] = useState([]);
  const [adNames, setAdNames] = useState([]);

  const totalPages = Math.ceil(total / limit);

  // Fetch user
  useEffect(() => {
    async function fetchUser() {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!data.user) {
        router.push("/login");
      } else if (
        data.user.role !== "REPORTER" &&
        data.user.role !== "MANAGER"
      ) {
        router.push("/dashboard/sales");
      } else {
        setUser(data.user);
      }
    }
    fetchUser();
  }, []);

  // Fetch campaign & ad name dropdowns
  useEffect(() => {
    async function fetchOptions() {
      const res = await fetch("/api/export/options");
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.campaigns);
        setAdNames(data.adNames);
      }
    }
    fetchOptions();
  }, []);

  // Build query params
  function buildParams(exportAll = false) {
    const params = new URLSearchParams();
    if (campaignName) params.append("campaign_name", campaignName);
    if (adName) params.append("ad_name", adName);
    if (dateFrom) params.append("date_from", `${dateFrom}T${timeFrom}:00`);
    if (dateTo) params.append("date_to", `${dateTo}T${timeTo}:00`);
    if (exportAll) {
      params.append("export", "true");
    } else {
      params.append("page", page);
      params.append("limit", limit);
    }
    return params;
  }

  // Fetch leads for table
  async function fetchLeads() {
    setLoading(true);
    const res = await fetch(`/api/export/leads?${buildParams()}`);
    const data = await res.json();
    setLeads(data.leads || []);
    setTotal(data.total || 0);
    setLoading(false);
  }

  useEffect(() => {
    if (user) fetchLeads();
  }, [user, campaignName, adName, dateFrom, timeFrom, dateTo, timeTo, page]);

  // Export all to Excel
  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/export/leads?${buildParams(true)}`);
      const data = await res.json();
      const allLeads = data.leads || [];

      const rows = allLeads.map((l, i) => ({
        "#": i + 1,
        "Lead ID": l.id,
        Name: l.name || "-",
        Phone: l.phone || "-",
        Email: l.email || "-",
        Source: l.source || "-",
        Status: l.status || "-",
        Campaign: l.campaign_name || "-",
        "Ad Name": l.ad_name || "-",
        Platform: l.platform || "-",
        State: l.state || "-",
        "Created At (IST)": new Date(l.created_at).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 5 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 25 },
        { wch: 10 },
        { wch: 12 },
        { wch: 25 },
        { wch: 20 },
        { wch: 10 },
        { wch: 15 },
        { wch: 25 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");

      const filename = `leads_${dateFrom || "all"}_to_${dateTo || "all"}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  // Quick date presets
  function applyQuickDate(type) {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    if (type === "today") {
      // 10am today → 10am tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      setDateFrom(today);
      setTimeFrom("10:00");
      setDateTo(tomorrow.toISOString().split("T")[0]);
      setTimeTo("10:00");
    } else if (type === "yesterday") {
      // 10am yesterday → 10am today
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      setDateFrom(yesterday.toISOString().split("T")[0]);
      setTimeFrom("10:00");
      setDateTo(today);
      setTimeTo("10:00");
    } else if (type === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      setDateFrom(weekAgo.toISOString().split("T")[0]);
      setTimeFrom("00:00");
      setDateTo(today);
      setTimeTo("23:59");
    } else if (type === "month") {
      setDateFrom(
        new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split("T")[0],
      );
      setTimeFrom("00:00");
      setDateTo(today);
      setTimeTo("23:59");
    }
    setPage(1);
  }

  function clearFilters() {
    setCampaignName("");
    setAdName("");
    setDateFrom("");
    setDateTo("");
    setTimeFrom("10:00");
    setTimeTo("10:00");
    setPage(1);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-sm">NG</span>
              </div>
              <span className="text-slate-900 font-semibold text-lg">
                NextGen LMS
              </span>
              <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-md font-medium">
                Export
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={exporting || total === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Export {total > 0 ? `(${total})` : ""} to Excel
                  </>
                )}
              </button>

              {/* User */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white font-medium text-sm">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">
                    {user?.name}
                  </p>
                  <p className="text-xs text-slate-500">{user?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs text-slate-500 hover:text-red-600 transition-colors ml-2"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">
            Lead Export
          </h1>
          <p className="text-sm text-slate-600">
            Filter leads by campaign, ad, and time range — then export to Excel
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Filtered Leads", value: total },
            { label: "Page", value: `${page} / ${totalPages || 1}` },
            {
              label: "Active Filters",
              value: [campaignName, adName, dateFrom, dateTo].filter(Boolean)
                .length,
            },
            { label: "Exporting All", value: total },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-lg border border-slate-200 p-5"
            >
              <p className="text-sm font-medium text-slate-600 mb-1">
                {s.label}
              </p>
              <p className="text-2xl font-semibold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Filters</h2>
            <button
              onClick={clearFilters}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Clear all
            </button>
          </div>

          {/* Campaign & Ad Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Campaign Name
              </label>
              <select
                value={campaignName}
                onChange={(e) => {
                  setCampaignName(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none"
              >
                <option value="">All Campaigns</option>
                {campaigns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Ad Name
              </label>
              <select
                value={adName}
                onChange={(e) => {
                  setAdName(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none"
              >
                <option value="">All Ads</option>
                {adNames.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "today", label: "🕙 Today (10am → 10am)" },
                { key: "yesterday", label: "🕙 Yesterday (10am → 10am)" },
                { key: "week", label: "📅 Last 7 Days" },
                { key: "month", label: "📅 This Month" },
              ].map((q) => (
                <button
                  key={q.key}
                  onClick={() => applyQuickDate(q.key)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-300 bg-white text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date + Time Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">
                📅 From
              </p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-slate-500 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={timeFrom}
                    onChange={(e) => {
                      setTimeFrom(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">📅 To</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-slate-500 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={timeTo}
                    onChange={(e) => {
                      setTimeTo(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {[
                    "#",
                    "Name",
                    "Phone",
                    "Email",
                    "Campaign",
                    "Ad Name",
                    "Platform",
                    "Status",
                    "Created At (IST)",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Loading...</p>
                    </td>
                  </tr>
                )}
                {!loading && leads.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <p className="text-sm font-medium text-slate-900">
                        No leads found
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        Try adjusting your filters
                      </p>
                    </td>
                  </tr>
                )}
                {!loading &&
                  leads.map((lead, i) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {(page - 1) * limit + i + 1}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {lead.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {lead.phone || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {lead.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {lead.campaign_name || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {lead.ad_name || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          {lead.platform || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getStatusColor(lead.status)}`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Page <span className="font-medium text-slate-900">{page}</span> of{" "}
              <span className="font-medium text-slate-900">
                {totalPages || 1}
              </span>
              <span className="ml-2 text-slate-400">({total} total leads)</span>
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function getStatusColor(status) {
  const colors = {
    NEW: "bg-blue-50 text-blue-700 border-blue-200",
    ASSIGNED: "bg-purple-50 text-purple-700 border-purple-200",
    CONTACTED: "bg-amber-50 text-amber-700 border-amber-200",
    QUALIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CLOSED: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return colors[status] || "bg-slate-50 text-slate-700 border-slate-200";
}
