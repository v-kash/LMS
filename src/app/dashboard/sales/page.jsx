"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

export default function SalesDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [followup, setFollowup] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const router = useRouter();

  const socketRef = useRef(null);
  const notificationRef = useRef(null);

  // Format role for display
  const formatRole = (role) => {
    if (!role) return "User";
    return role.charAt(0) + role.slice(1).toLowerCase().replace("_", " ");
  };

  async function loadLeads() {
    try {
      const params = new URLSearchParams({
        page,
        limit,
        status,
        source,
        followup,
        search: debouncedSearch,
      });

      const res = await fetch(`/api/leads/sales?${params}`);
      const data = await res.json();

      if (data.success) {
        setLeads(data.leads);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to load leads:", err);
    }
  }

  let lastSoundTime = 0;

  function showSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  }

  function showError(msg) {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  }

  async function handleChangePassword(e) {
    e.preventDefault();

    setPasswordError("");

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match");
      return;
    }

    setSavingPassword(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setShowPasswordModal(false);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");

        showSuccess("Password updated successfully!");
      } else {
        setPasswordError(data.message || "Old password is incorrect");
      }
    } catch (err) {
      setPasswordError("Server error. Please try again.");
    }

    setSavingPassword(false);
  }

  function playNotificationSound() {
    const now = Date.now();

    // prevent multiple sounds within 1 second
    if (now - lastSoundTime < 1000) return;

    lastSoundTime = now;

    const audio = new Audio("/notification.mp3");
    audio.play().catch(() => {});
  }

  useEffect(() => {
    if (!user?.id) return;

    const socket = io("http://localhost:4000");
    socketRef.current = socket;

    socket.emit("join", user.id);

    socket.on("lead_assigned", (data) => {
      playNotificationSound();

      setToast({
        title: "New Lead Assigned",
        message: `${data.leadName} has been assigned to you.`,
      });

      loadNotifications();
      loadLeads();
    });

    socket.on("bulk_lead_assigned", (data) => {
      playNotificationSound();

      setToast({
        title: "Multiple Leads Assigned",
        message: `You have been assigned ${data.count} new leads.`,
      });

      loadNotifications();
      loadLeads();
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    loadLeads();
  }, [page, status, source, followup, debouncedSearch]);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadDashboard() {
    try {
      // Fetch user details first
      const userRes = await fetch("/api/auth/me");
      const userData = await userRes.json();
      console.log("User data from /api/auth/me:", userData);

      if (userData.user) {
        setUser(userData.user);
      }

      // Fetch dashboard data
      const dashRes = await fetch("/api/dashboard/sales");
      const dashData = await dashRes.json();
      console.log("Dashboard data received:", dashData);

      setData(dashData);
      setLoading(false);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      setLoading(false);
    }
  }

  async function loadNotifications() {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    if (data.success) {
      setNotifications(data.notifications);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  async function markAsRead(id) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    loadNotifications();
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!showNotifications) return;

    function handleClickOutside(event) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-600 text-sm font-medium">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      {success && (
        <div className="fixed top-4 right-4 z-80 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
          ✅ {success}
        </div>
      )}

      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">
          ❌ {error}
        </div>
      )}
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Navigation */}
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
                  href="/dashboard/sales"
                  className="px-3 py-2 text-sm font-medium text-slate-900 bg-slate-100 rounded-md"
                >
                  Dashboard
                </Link>
                {/* <Link href="/dashboard/leads" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors">
                  Leads
                </Link>
                <Link href="/dashboard/reports" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors">
                  Reports
                </Link> */}
              </nav>
            </div>

            <div className="relative mr-4 " ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {/* Bell Icon */}
                <svg
                  className="w-6 h-6 text-slate-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405C18.21 15.21 18 14.7 18 14.172V11a6 6 0 10-12 0v3.172c0 .528-.21 1.038-.595 1.423L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>

                {/* Badge */}
                {notifications.filter((n) => !n.is_read).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {notifications.filter((n) => !n.is_read).length}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 z-50 animate-fade-in">
                  <div className="p-4 border-b border-slate-200 text-slate-700 font-semibold text-sm">
                    Notifications
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-2 text-sm text-slate-700">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className={`p-4 text-sm cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition ${
                            !n.is_read ? "bg-blue-50" : ""
                          }`}
                        >
                          <p className="text-slate-800 text-sm mt-1">
                            {n.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-3 py-1.5 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">
                    {user?.name || "User"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatRole(user?.role)}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white font-medium text-sm">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden z-20">
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                      <p className="text-sm font-semibold text-slate-900">
                        {user?.name || "User"}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {user?.email || "No email"}
                      </p>
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-900 text-white">
                          {formatRole(user?.role)}
                        </span>
                      </div>
                    </div>

                    <div className="p-2">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowPasswordModal(true);
                        }}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md transition-colors w-full"
                      >
                        <svg
                          className="w-5 h-5 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 11c1.657 0 3-1.343 3-3V6a3 3 0 10-6 0v2c0 1.657 1.343 3 3 3z"
                          />
                        </svg>
                        Change Password
                      </button>
                    </div>

                    <div className="p-2 border-t border-slate-200">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
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
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">
            Welcome back, {user?.name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-sm text-slate-600">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KpiCard
            label="Open Leads"
            value={data.kpis.openLeads}
            change="+12%"
            trend="up"
          />
          <KpiCard
            label="Follow-ups Today"
            value={data.kpis.todayFollowups}
            change="+3"
            trend="up"
            highlight={data.kpis.todayFollowups > 0}
          />
          <KpiCard
            label="Monthly Conversions"
            value={data.kpis.monthlyConversions}
            change="+8%"
            trend="up"
          />
        </div>

        <div className="">
          {/* Left Column - Follow-ups */}
          <div className="space-y-6">
            {/* Follow-ups Section */}
            {/* <Section title="Priority Follow-ups" count={data.followups.length}>
              {data.followups.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                    <svg
                      className="w-6 h-6 text-emerald-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-600">
                    All caught up! No pending follow-ups.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.followups.map((f) => {
                    const isOverdue = new Date(f.followup_date) < new Date();

                    return (
                      <div
                        key={f.id}
                        className={`p-4 rounded-lg border transition-all ${
                          isOverdue
                            ? "border-red-200 bg-red-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-slate-900 truncate">
                                {f.lead_name}
                              </h3>
                              {isOverdue && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                  Overdue
                                </span>
                              )}
                            </div>

                            <p className="text-sm text-slate-600 mb-2">
                              {new Date(f.followup_date).toLocaleString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </p>

                            {f.note && (
                              <p className="text-sm text-slate-700">{f.note}</p>
                            )}
                          </div>

                          <Link
                            href={`/dashboard/leads/${f.lead_id}`}
                            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
                          >
                            View
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section> */}

            {/* Active Leads */}
            <Section title="Active Pipeline" count={data.activeLeads.length}>
              <div className="bg-white p-4 text-gray-800 rounded-lg border border-slate-200 mb-4 flex flex-wrap gap-3">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search name, phone, email..."
                  className="border px-3 py-2 rounded-md text-sm w-64"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                {/* Status */}
                <select
                  className="border px-3 py-2 rounded-md text-sm"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Status</option>
                  <option value="NEW">NEW</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="QUALIFIED">QUALIFIED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>

                {/* Source */}
                <select
                  className="border px-3 py-2 rounded-md text-sm"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Source</option>
                  <option value="META">META</option>
                  <option value="WEBSITE">WEBSITE</option>
                  <option value="EXCEL">EXCEL</option>
                </select>

                {/* Follow-up */}
                <select
                  className="border px-3 py-2 rounded-md text-sm"
                  value={followup}
                  onChange={(e) => {
                    setFollowup(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Follow-ups</option>
                  <option value="today">Today</option>
                  <option value="overdue">Overdue</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="none">No Follow-up</option>
                </select>
              </div>

              <div className="bg-white text-gray-800 rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-left">Phone</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Source</th>
                        <th className="px-4 py-3 text-left">Follow-up</th>
                        <th className="px-4 py-3 text-left">Updated</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {leads.map((lead) => {
                        const isOverdue =
                          lead.next_followup &&
                          new Date(lead.next_followup) < new Date();

                        return (
                          <tr key={lead.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium">
                              {lead.name}
                            </td>

                            <td className="px-4 py-3">
                              <a
                                href={`tel:${lead.phone}`}
                                className="text-blue-600 hover:underline"
                              >
                                {lead.phone}
                              </a>
                            </td>

                            <td className="px-4 py-3">
                              <StatusBadge status={lead.status} />
                            </td>

                            <td className="px-4 py-3">{lead.source}</td>

                            <td className="px-4 py-3">
                              {lead.next_followup ? (
                                <span
                                  className={`text-xs px-2 py-1 rounded ${
                                    isOverdue
                                      ? "bg-red-100 text-red-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {new Date(
                                    lead.next_followup,
                                  ).toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">
                                  None
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              {new Date(lead.updated_at).toLocaleDateString()}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/dashboard/leads/${lead.id}`}
                                className="text-slate-900 font-medium hover:underline"
                              >
                                View →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {pagination && (
                <div className="flex justify-between text-gray-800 items-center mt-4">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="px-3 py-1 border rounded disabled:opacity-40"
                  >
                    Prev
                  </button>

                  <span className="text-sm text-slate-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>

                  <button
                    disabled={page === pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="px-3 py-1 border rounded disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </Section>
          </div>

          {/* Right Column - Recent Conversions */}
          {/* <div className="lg:col-span-1">
            <Section title="Recent Wins" count={data.recentConversions.length}>
              {data.recentConversions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-600">No conversions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recentConversions.map((c, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate mb-1">
                            {c.lead_name}
                          </p>
                          <p className="text-lg font-semibold text-emerald-600">
                            ₹{c.amount.toLocaleString()}
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-4 h-4 text-emerald-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div> */}
        </div>
      </main>
      {toast && (
        <div className="fixed top-6 right-6 bg-white shadow-lg border border-slate-200 rounded-lg p-4 w-80 z-50 animate-slide-in">
          <p className="font-semibold text-sm text-slate-900">{toast.title}</p>
          <p className="text-xs text-slate-600 mt-1">{toast.message}</p>
        </div>
      )}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Change Password
              </h2>

              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={handleChangePassword}
              className="px-6 py-5 space-y-4"
            >
              {/* ERROR MESSAGE */}
              {passwordError && (
                <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                  {passwordError}
                </div>
              )}

              {/* Old Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Old Password
                </label>

                <div className="relative">
                  <input
                    type={showOldPassword ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Enter old password"
                    className="w-full px-3 py-2 border border-slate-300 text-slate-700 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  />

                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    {showOldPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  New Password
                </label>

                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3 py-2 border border-slate-300 text-slate-700 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  />

                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    {showNewPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password
                </label>

                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3 py-2 border border-slate-300 text-slate-700 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-sm hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  {savingPassword ? "Saving..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Components ---------- */

function KpiCard({ label, value, change, trend, highlight = false }) {
  return (
    <div
      className={`bg-white rounded-lg border p-6 transition-all ${
        highlight ? "border-slate-300 shadow-sm" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {change && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              trend === "up" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            <svg
              className={`w-3 h-3 ${trend === "down" ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
            {change}
          </span>
        )}
      </div>
      <p className="text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {count !== undefined && (
            <span className="text-sm font-medium text-slate-600">{count}</span>
          )}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const statusConfig = {
    NEW: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    CONTACTED: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-200",
    },
    QUALIFIED: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    },
    PROPOSAL: {
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      border: "border-indigo-200",
    },
    NEGOTIATION: {
      bg: "bg-orange-50",
      text: "text-orange-700",
      border: "border-orange-200",
    },
  };

  const config = statusConfig[status] || {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}
    >
      {status}
    </span>
  );
}
