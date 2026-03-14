"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { io } from "socket.io-client";
import { useRef } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

export default function ManagerDashboard() {
  const router = useRouter();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [assigned, setAssigned] = useState("");

  const [page, setPage] = useState(1);
  const limit = 10;
  const [total, setTotal] = useState(0);

  const [selectedLeads, setSelectedLeads] = useState([]);
  const [allFilteredSelected, setAllFilteredSelected] = useState(false);
  const [loadingAllIds, setLoadingAllIds] = useState(false);

  const [users, setUsers] = useState([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const [userMap, setUserMap] = useState({});
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [assignedUserFilter, setAssignedUserFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [assignedUserSearch, setAssignedUserSearch] = useState("");
  const [showAssignedUserDropdown, setShowAssignedUserDropdown] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickDate, setQuickDate] = useState("");

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

  const isManager = user?.role === "MANAGER";

  // Refs
  const audioRef = useRef(null);
  const socketRef = useRef(null);
  const notificationRef = useRef(null);
  const assignedUserDropdownRef = useRef(null); // filter "Assigned User"
  const bulkUserDropdownRef = useRef(null);     // bulk action bar user search

  let lastSoundTime = 0;

  // Derived
  const totalPages = Math.ceil(total / limit);
  const effectiveCount = allFilteredSelected ? total : selectedLeads.length;
  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()),
  );
  const filteredUsersForFilter = users.filter((u) =>
    u.name.toLowerCase().includes(assignedUserSearch.toLowerCase()),
  );

  // ── Click-outside for ALL dropdowns ──────────────────────────────────────
  useEffect(() => {
    function handler(e) {
      if (showNotifications && notificationRef.current && !notificationRef.current.contains(e.target))
        setShowNotifications(false);
      if (showAssignedUserDropdown && assignedUserDropdownRef.current && !assignedUserDropdownRef.current.contains(e.target))
        setShowAssignedUserDropdown(false);
      if (showUserDropdown && bulkUserDropdownRef.current && !bulkUserDropdownRef.current.contains(e.target))
        setShowUserDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifications, showAssignedUserDropdown, showUserDropdown]);

  function applyQuickDate(type) {
    const now = new Date();
    let from = "";
    let to = new Date().toISOString().split("T")[0];
    if (type === "today") {
      from = to;
    } else if (type === "week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      from = new Date(now.setDate(diff)).toISOString().split("T")[0];
    } else if (type === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    }
    setDateFrom(from);
    setDateTo(to);
    setQuickDate(type);
    setPage(1);
  }

  function showSuccessMsg(msg) { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); }
  function showErrorMsg(msg)   { setError(msg);   setTimeout(() => setError(""),   4000); }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError("");
    if (!oldPassword || !newPassword || !confirmPassword) return setPasswordError("All fields are required");
    if (newPassword.length < 6) return setPasswordError("Password must be at least 6 characters");
    if (newPassword !== confirmPassword) return setPasswordError("New password and confirm password do not match");
    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPasswordModal(false);
        setOldPassword(""); setNewPassword(""); setConfirmPassword("");
        showSuccessMsg("Password updated successfully!");
      } else {
        setPasswordError(data.message || "Old password is incorrect");
      }
    } catch (err) {
      setPasswordError("Server error. Please try again.");
    }
    setSavingPassword(false);
  }

  async function fetchLeads() {
    setLoading(true);
    setAllFilteredSelected(false);
    setSelectedLeads([]);
    const params = new URLSearchParams();
    if (source)             params.append("source",        source);
    if (status)             params.append("status",        status);
    if (assigned)           params.append("assigned",      assigned);
    if (assignedUserFilter) params.append("assigned_user", assignedUserFilter);
    if (dateFrom)           params.append("date_from",     dateFrom);
    if (dateTo)             params.append("date_to",       dateTo);
    params.append("page",  page);
    params.append("limit", limit);
    const res = await fetch(`/api/leads?${params.toString()}`);
    const data = await res.json();
    setLeads(data.leads || []);
    setTotal(data.total  || 0);
    setLoading(false);
  }

  async function loadNotifications() {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.success) setNotifications(data.notifications);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }

  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current) {
        audioRef.current = new Audio("/notification.mp3");
        audioRef.current.load();
      }
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("click", unlock);
    return () => document.removeEventListener("click", unlock);
  }, []);

  function playNotificationSound() {
    const now = Date.now();
    if (now - lastSoundTime < 1000) return;
    lastSoundTime = now;
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e) => console.log("Audio blocked:", e));
    } else {
      const audio = new Audio("/notification.mp3");
      audio.play().catch((e) => console.log("Audio blocked:", e));
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    const socket = io("http://localhost:4000");
    socketRef.current = socket;
    socket.emit("join", user.id);
    socket.on("new_lead_generated", (data) => {
      playNotificationSound();
      setToast({ title: "New Lead Generated", message: `${data.leadName} submitted a new inquiry.` });
      fetchLeads();
      loadNotifications();
    });
    return () => socket.disconnect();
  }, [user?.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const formatRole = (role) => {
    if (!role) return "User";
    return role.charAt(0) + role.slice(1).toLowerCase().replace("_", " ");
  };

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
    async function fetchUserData() {
      try {
        const userRes = await fetch("/api/auth/me");
        const userData = await userRes.json();
        if (userData.user) setUser(userData.user);
        else router.push("/login");
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        router.push("/login");
      }
    }
    fetchUserData();
  }, [router]);

  useEffect(() => {
    if (!isManager) return;
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => setUsers([]));
  }, [isManager]);

  useEffect(() => {
    if (!user?.id) return;
    loadNotifications();
  }, [user?.id]);

  useEffect(() => {
    if (users.length > 0) {
      const map = {};
      users.forEach((u) => { map[u.id] = u.name; });
      setUserMap(map);
    }
  }, [users]);

  useEffect(() => {
    fetchLeads();
  }, [source, status, assignedUserFilter, assigned, page, dateFrom, dateTo]);

  // ── Select all filtered ───────────────────────────────────────────────────
  async function handleSelectAllFiltered() {
    setLoadingAllIds(true);
    try {
      const params = new URLSearchParams();
      if (source)             params.append("source",        source);
      if (status)             params.append("status",        status);
      if (assigned)           params.append("assigned",      assigned);
      if (assignedUserFilter) params.append("assigned_user", assignedUserFilter);
      if (dateFrom)           params.append("date_from",     dateFrom);
      if (dateTo)             params.append("date_to",       dateTo);
      params.append("export", "true");
      const res  = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      const allIds = (data.leads || []).map((l) => l.id);
      setSelectedLeads(allIds);
      setAllFilteredSelected(true);
    } catch {
      showErrorMsg("Failed to select all leads.");
    } finally {
      setLoadingAllIds(false);
    }
  }

  function clearSelection() {
    setSelectedLeads([]);
    setAllFilteredSelected(false);
    setAssignUserId("");
    setUserSearch("");
  }

  // ── Bulk assign ───────────────────────────────────────────────────────────
  async function handleBulkAssign() {
    if (!assignUserId || selectedLeads.length === 0) return;
    setAssigning(true);
    try {
      await fetch("/api/leads/assign/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: selectedLeads, userId: assignUserId }),
      });
      showSuccessMsg(`${selectedLeads.length} lead(s) assigned to ${userMap[assignUserId] || "user"}.`);
      clearSelection();
      fetchLeads();
    } catch (error) {
      console.error("Error assigning leads:", error);
      showErrorMsg("Assignment failed.");
    } finally {
      setAssigning(false);
    }
  }

  // ── Bulk unassign ─────────────────────────────────────────────────────────
  async function handleBulkUnassign() {
    if (selectedLeads.length === 0) return;
    setUnassigning(true);
    try {
      const res  = await fetch("/api/leads/unassign/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: selectedLeads }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMsg(`${selectedLeads.length} lead(s) unassigned.`);
        clearSelection();
        fetchLeads();
      } else {
        showErrorMsg(data.message || "Unassign failed.");
      }
    } catch {
      showErrorMsg("Server error. Please try again.");
    } finally {
      setUnassigning(false);
    }
  }

  // ── Per-row unassign ──────────────────────────────────────────────────────
  async function handleRowUnassign(leadId) {
    try {
      const res  = await fetch("/api/leads/unassign/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [leadId] }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMsg("Lead unassigned.");
        fetchLeads();
      } else {
        showErrorMsg(data.message || "Unassign failed.");
      }
    } catch {
      showErrorMsg("Server error. Please try again.");
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      NEW:         "bg-blue-50 text-blue-700 border-blue-200",
      ASSIGNED:    "bg-purple-50 text-purple-700 border-purple-200",
      CONTACTED:   "bg-amber-50 text-amber-700 border-amber-200",
      QUALIFIED:   "bg-emerald-50 text-emerald-700 border-emerald-200",
      PROPOSAL:    "bg-indigo-50 text-indigo-700 border-indigo-200",
      NEGOTIATION: "bg-orange-50 text-orange-700 border-orange-200",
      CONVERTED:   "bg-green-50 text-green-700 border-green-200",
      LOST:        "bg-red-50 text-red-700 border-red-200",
      CLOSED:      "bg-slate-50 text-slate-700 border-slate-200",
    };
    return colors[status] || "bg-slate-50 text-slate-700 border-slate-200";
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Alerts */}
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
      {toast && (
        <div className="fixed bottom-4 right-4 z-[80] bg-slate-900 text-white px-5 py-4 rounded-xl shadow-2xl text-sm max-w-xs">
          <p className="font-semibold mb-0.5">{toast.title}</p>
          <p className="text-slate-400 text-xs">{toast.message}</p>
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
                <span className="text-slate-900 font-semibold text-lg">NextGen LMS</span>
              </div>
              <nav className="hidden md:flex items-center gap-1">
                <Link href="/dashboard/manager"
                  className="px-3 py-2 text-sm font-medium text-slate-900 bg-slate-100 rounded-md">
                  Dashboard
                </Link>
                <Link href="/dashboard/revenue"
                  className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors">
                  Revenue
                </Link>
              </nav>
            </div>

            {/* Notifications */}
            <div className="relative mr-4" ref={notificationRef}>
              <button onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405C18.21 15.21 18 14.7 18 14.172V11a6 6 0 10-12 0v3.172c0 .528-.21 1.038-.595 1.423L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifications.filter((n) => !n.is_read).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {notifications.filter((n) => !n.is_read).length}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 z-50 animate-fade-in">
                  <div className="p-4 border-b border-slate-200 font-semibold text-sm">Notifications</div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500">No notifications</div>
                    ) : notifications.map((n) => (
                      <div key={n.id} onClick={() => markAsRead(n.id)}
                        className={`p-4 text-sm cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition ${!n.is_read ? "bg-blue-50" : ""}`}>
                        <p className="text-slate-600 text-sm mt-1">{n.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-3 py-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">{user?.name || "User"}</p>
                  <p className="text-xs text-slate-500">{formatRole(user?.role)}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white font-medium text-sm">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden z-20">
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                      <p className="text-sm font-semibold text-slate-900">{user?.name || "User"}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{user?.email || "No email"}</p>
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-900 text-white">
                          {formatRole(user?.role)}
                        </span>
                      </div>
                    </div>
                    <div className="p-2">
                      <button onClick={() => { setShowUserMenu(false); setShowPasswordModal(true); }}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md transition-colors w-full">
                        <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3V6a3 3 0 10-6 0v2c0 1.657 1.343 3 3 3z" />
                        </svg>
                        Change Password
                      </button>
                    </div>
                    <div className="p-2 border-t border-slate-200">
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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
      <main className="max-w-[1600px] mx-auto px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Lead Management</h1>
          <p className="text-sm text-slate-600">Manage and assign leads to your sales team</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Leads"    value={total} />
          <StatCard label="Current Page"   value={page} />
          <StatCard label="Active Filters" value={[source, status, assigned].filter(Boolean).length} />
          <StatCard label="Total Pages"    value={totalPages || 1} />
        </div>

        {/* ── FILTERS (exactly as original) ───────────────────────────────── */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Source</label>
              <select value={source} onChange={(e) => { setPage(1); setSource(e.target.value); }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all">
                <option value="">All Sources</option>
                <option value="EXCEL">Excel Import</option>
                <option value="WEBSITE">Website Form</option>
                <option value="META">Meta Ads</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all">
                <option value="">All Statuses</option>
                <option value="NEW">New</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {isManager && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Assigned User</label>
                <div className="relative" ref={assignedUserDropdownRef}>
                  <input type="text" placeholder="Search user..."
                    value={assignedUserSearch}
                    onFocus={() => setShowAssignedUserDropdown(true)}
                    onChange={(e) => setAssignedUserSearch(e.target.value)}
                    className="w-full px-3 py-2 border text-black border-slate-300 rounded-md text-sm outline-none" />
                  {showAssignedUserDropdown && (
                    <div className="absolute top-full mt-1 w-full text-black bg-white rounded-md shadow-lg border border-slate-200 max-h-48 overflow-y-auto z-50">
                      <div onClick={() => { setAssignedUserFilter(""); setAssignedUserSearch(""); setShowAssignedUserDropdown(false); }}
                        className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer">All Users</div>
                      {filteredUsersForFilter.map((u) => (
                        <div key={u.id}
                          onClick={() => { setAssignedUserFilter(u.id); setAssignedUserSearch(u.name); setShowAssignedUserDropdown(false); setPage(1); }}
                          className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer">{u.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Date Filter — exactly as original */}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Date Range</label>
              <div className="flex gap-2 mb-3">
                {["today", "week", "month"].map((type) => (
                  <button key={type} onClick={() => applyQuickDate(type)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                      quickDate === type
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}>
                    {type === "today" ? "Today" : type === "week" ? "This Week" : "This Month"}
                  </button>
                ))}
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(""); setDateTo(""); setQuickDate(""); setPage(1); }}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-all">
                    Clear
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">From</label>
                  <input type="date" value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setQuickDate(""); setPage(1); }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">To</label>
                  <input type="date" value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setQuickDate(""); setPage(1); }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── BULK ACTION BAR ──────────────────────────────────────────────── */}
        {isManager && selectedLeads.length > 0 && (
          <div className="mb-4 bg-slate-900 text-white rounded-lg p-4 flex flex-wrap items-center gap-4">

            {/* Count */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                {effectiveCount > 999 ? "999+" : effectiveCount}
              </div>
              <span className="text-sm font-medium">
                {allFilteredSelected
                  ? `All ${total} filtered leads selected`
                  : `${selectedLeads.length} lead${selectedLeads.length !== 1 ? "s" : ""} selected`}
              </span>
            </div>

            {/* Select all across pages */}
            {!allFilteredSelected && total > leads.length && (
              <button onClick={handleSelectAllFiltered} disabled={loadingAllIds}
                className="text-xs text-purple-300 hover:text-purple-100 underline underline-offset-2 transition-colors disabled:opacity-50">
                {loadingAllIds ? "Loading…" : `Select all ${total} filtered leads`}
              </button>
            )}

            {/* User search for assign */}
            <div className="relative w-64" ref={bulkUserDropdownRef}>
              <input type="text" placeholder="Search user..."
                value={userSearch}
                onFocus={() => setShowUserDropdown(true)}
                onChange={(e) => { setUserSearch(e.target.value); setAssignUserId(""); }}
                className="w-full px-3 py-2 bg-white text-slate-900 rounded-md text-sm outline-none" />
              {showUserDropdown && (
                <div className="absolute top-full mt-1 w-full bg-white text-slate-900 rounded-md shadow-lg border border-slate-200 max-h-48 overflow-y-auto z-50">
                  {filteredUsers.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">No users found</div>
                  )}
                  {filteredUsers.map((u) => (
                    <div key={u.id}
                      onClick={() => { setAssignUserId(u.id); setUserSearch(u.name); setShowUserDropdown(false); }}
                      className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer transition-colors">{u.name}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Assign */}
            <button disabled={!assignUserId || assigning} onClick={handleBulkAssign}
              className="px-4 py-2 bg-white text-slate-900 rounded-md text-sm font-medium hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {assigning ? "Assigning..." : "Assign Selected"}
            </button>

            {/* Unassign */}
            <button disabled={unassigning} onClick={handleBulkUnassign}
              className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {unassigning ? "Unassigning..." : "Unassign"}
            </button>

            {/* Clear */}
            <button onClick={clearSelection}
              className="px-4 py-2 bg-transparent border border-white/20 text-white rounded-md text-sm font-medium hover:bg-white/10 transition-all">
              Clear Selection
            </button>
          </div>
        )}

        {/* ── TABLE ────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {isManager && (
                    <th className="px-6 py-3 text-left">
                      <input type="checkbox"
                        checked={leads.length > 0 && leads.every((l) => selectedLeads.includes(l.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newIds = leads.map((l) => l.id);
                            setSelectedLeads((prev) => [...new Set([...prev, ...newIds])]);
                          } else {
                            const pageIds = new Set(leads.map((l) => l.id));
                            setSelectedLeads((prev) => prev.filter((id) => !pageIds.has(id)));
                            setAllFilteredSelected(false);
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading && (
                  <tr><td colSpan={isManager ? 7 : 6} className="px-6 py-12">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-3"></div>
                      <p className="text-sm text-slate-600">Loading leads...</p>
                    </div>
                  </td></tr>
                )}

                {!loading && leads.length === 0 && (
                  <tr><td colSpan={isManager ? 7 : 6} className="px-6 py-12">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-slate-900">No leads found</p>
                      <p className="text-sm text-slate-500 mt-1">Try adjusting your filters</p>
                    </div>
                  </td></tr>
                )}

                {!loading && leads.map((lead) => (
                  <tr key={lead.id} className={`hover:bg-slate-50 transition-colors ${selectedLeads.includes(lead.id) ? "bg-purple-50/40" : ""}`}>
                    {isManager && (
                      <td className="px-6 py-4">
                        <input type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedLeads([...selectedLeads, lead.id]);
                            else { setSelectedLeads(selectedLeads.filter((id) => id !== lead.id)); setAllFilteredSelected(false); }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                      </td>
                    )}

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                          {lead.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <button onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                          className="text-sm font-medium text-slate-900 hover:text-slate-600 text-left transition-colors">
                          {lead.name || "Unnamed Lead"}
                        </button>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900">{lead.phone || "-"}</div>
                      <div className="text-xs text-slate-500">{lead.email || "-"}</div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-700">{lead.source || "-"}</span>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>

                    {/* Assigned To + per-row unassign */}
                    <td className="px-6 py-4">
                      {lead.assigned_to && userMap[lead.assigned_to] ? (
                        <div className="flex items-center gap-2 group">
                          <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-emerald-700">
                              {userMap[lead.assigned_to].charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm text-slate-900">{userMap[lead.assigned_to]}</span>
                          {/* Per-row unassign — visible on hover */}
                          {isManager && (
                            <button onClick={() => handleRowUnassign(lead.id)} title="Unassign"
                              className="ml-1 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-all flex-shrink-0">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(lead.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Page <span className="font-medium text-slate-900">{page}</span> of{" "}
                <span className="font-medium text-slate-900">{totalPages || 1}</span>
              </div>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  Previous
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                  className="px-4 py-2 bg-slate-900 border border-slate-900 rounded-md text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Change Password</h2>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-700 transition-colors">✕</button>
            </div>
            <form onSubmit={handleChangePassword} className="px-6 py-5 space-y-4">
              {passwordError && (
                <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">{passwordError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Old Password</label>
                <div className="relative">
                  <input type={showOldPassword ? "text" : "password"} value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)} placeholder="Enter old password"
                    className="w-full px-3 py-2 border border-slate-300 text-slate-700 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900" />
                  <button type="button" onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700">
                    {showOldPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <div className="relative">
                  <input type={showNewPassword ? "text" : "password"} value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters"
                    className="w-full px-3 py-2 border border-slate-300 text-slate-700 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900" />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700">
                    {showNewPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password"
                    className="w-full px-3 py-2 border border-slate-300 text-slate-700 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700">
                    {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-sm hover:bg-slate-50 transition-all">Cancel</button>
                <button type="submit" disabled={savingPassword}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm hover:bg-slate-800 transition-all disabled:opacity-50">
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

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <p className="text-sm font-medium text-slate-600 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}