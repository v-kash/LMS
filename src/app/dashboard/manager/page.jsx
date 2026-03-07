"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { io } from "socket.io-client";
import { useRef } from "react";

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
  const [users, setUsers] = useState([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [userMap, setUserMap] = useState({});
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [assignedUserFilter, setAssignedUserFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  // const [assignedUserFilter, setAssignedUserFilter] = useState("");
  const [assignedUserSearch, setAssignedUserSearch] = useState("");
  const [showAssignedUserDropdown, setShowAssignedUserDropdown] =
    useState(false);

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickDate, setQuickDate] = useState("");

  const isManager = user?.role === "MANAGER";

  function applyQuickDate(type) {
    const now = new Date();
    let from = "";
    let to = new Date().toISOString().split("T")[0]; // today

    if (type === "today") {
      from = to;
    } else if (type === "week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      from = new Date(now.setDate(diff)).toISOString().split("T")[0];
    } else if (type === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
    }

    setDateFrom(from);
    setDateTo(to);
    setQuickDate(type);
    setPage(1);
  }

  async function fetchLeads() {
    setLoading(true);

    const params = new URLSearchParams();
    if (source) params.append("source", source);
    if (status) params.append("status", status);
    if (assigned) params.append("assigned", assigned);
    if (assignedUserFilter) params.append("assigned_user", assignedUserFilter);
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);

    params.append("page", page);
    params.append("limit", limit);

    const res = await fetch(`/api/leads?${params.toString()}`);
    const data = await res.json();

    setLeads(data.leads || []);
    console.log("Leads with assigned users:", data.leads);

    setTotal(data.total || 0);
    setLoading(false);
  }

  async function loadNotifications() {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();

      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }

  let lastSoundTime = 0;

  // function playNotificationSound() {
  //   const now = Date.now();
  //   if (now - lastSoundTime < 1000) return;
  //   lastSoundTime = now;

  //   const audio = new Audio("/notification.mp3");
  //   audio.play().catch(() => {});
  // }

  // Add this ref at the top with your other refs
  const audioRef = useRef(null);

  // Add this useEffect to pre-load audio on first interaction
  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current) {
        audioRef.current = new Audio("/notification.mp3");
        audioRef.current.load(); // pre-load
      }
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("click", unlock);
    return () => document.removeEventListener("click", unlock);
  }, []);

  // Update your playNotificationSound function
  function playNotificationSound() {
    const now = Date.now();
    if (now - lastSoundTime < 1000) return;
    lastSoundTime = now;

    if (audioRef.current) {
      audioRef.current.currentTime = 0; // rewind to start
      audioRef.current.play().catch((e) => console.log("Audio blocked:", e));
    } else {
      const audio = new Audio("/notification.mp3");
      audio.play().catch((e) => console.log("Audio blocked:", e));
    }
  }

  const socketRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return;

    const socket = io("http://localhost:4000");
    socketRef.current = socket;

    socket.emit("join", user.id);

    socket.on("new_lead_generated", (data) => {
      playNotificationSound();

      setToast({
        title: "New Lead Generated",
        message: `${data.leadName} submitted a new inquiry.`,
      });

      fetchLeads(); // refresh list
      loadNotifications();
    });

    return () => socket.disconnect();
  }, [user?.id]);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast]);

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

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()),
  );

  const filteredUsersForFilter = users.filter((u) =>
    u.name.toLowerCase().includes(assignedUserSearch.toLowerCase()),
  );

  useEffect(() => {
    if (!user?.id) return;
    loadNotifications();
  }, [user?.id]);

  useEffect(() => {
    // Fetch authenticated user data
    async function fetchUserData() {
      try {
        const userRes = await fetch("/api/auth/me");
        const userData = await userRes.json();
        console.log("User data from /api/auth/me:", userData);

        if (userData.user) {
          setUser(userData.user);
        } else {
          // If not authenticated, redirect to login
          router.push("/login");
        }
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
    function handleClickOutside(e) {
      if (!e.target.closest(".relative")) {
        setShowAssignedUserDropdown(false);
      }
    }

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      const map = {};
      users.forEach((user) => {
        map[user.id] = user.name;
      });
      setUserMap(map);
    }
  }, [users]);

  // useEffect(() => {
  //   fetchLeads();
  // }, [source, status, assignedUserFilter, assigned, page]);

  useEffect(() => {
    fetchLeads();
  }, [source, status, assignedUserFilter, assigned, page, dateFrom, dateTo]); // 👈 add dateFrom, dateTo

  const totalPages = Math.ceil(total / limit);

  const getStatusColor = (status) => {
    const colors = {
      NEW: "bg-blue-50 text-blue-700 border-blue-200",
      ASSIGNED: "bg-purple-50 text-purple-700 border-purple-200",
      CONTACTED: "bg-amber-50 text-amber-700 border-amber-200",
      QUALIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
      PROPOSAL: "bg-indigo-50 text-indigo-700 border-indigo-200",
      NEGOTIATION: "bg-orange-50 text-orange-700 border-orange-200",
      CONVERTED: "bg-green-50 text-green-700 border-green-200",
      LOST: "bg-red-50 text-red-700 border-red-200",
      CLOSED: "bg-slate-50 text-slate-700 border-slate-200",
    };
    return colors[status] || "bg-slate-50 text-slate-700 border-slate-200";
  };

  async function handleBulkAssign() {
    if (!assignUserId || selectedLeads.length === 0) return;

    setAssigning(true);

    try {
      await fetch("/api/leads/assign/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: selectedLeads,
          userId: assignUserId,
        }),
      });

      setSelectedLeads([]);
      setAssignUserId("");
      fetchLeads();
    } catch (error) {
      console.error("Error assigning leads:", error);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
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
                  href="/dashboard/manager"
                  className="px-3 py-2 text-sm font-medium text-slate-900 bg-slate-100 rounded-md"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/revenue"
                  className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
                >
                  Revenue
                </Link>
                {/* <Link
                  href="/dashboard/reports"
                  className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
                >
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
                  <div className="p-4 border-b border-slate-200 font-semibold text-sm">
                    Notifications
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500">
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
                          <p className="text-slate-600 text-sm mt-1">
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
                      <Link
                        href="/dashboard/profile"
                        className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md transition-colors"
                        onClick={() => setShowUserMenu(false)}
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
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        Profile Settings
                      </Link>
                      <Link
                        href="/dashboard/settings"
                        className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md transition-colors"
                        onClick={() => setShowUserMenu(false)}
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
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        Account Settings
                      </Link>
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
      <main className="max-w-[1600px] mx-auto px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">
            Lead Management
          </h1>
          <p className="text-sm text-slate-600">
            Manage and assign leads to your sales team
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Leads" value={total} />
          <StatCard label="Current Page" value={page} />
          <StatCard
            label="Active Filters"
            value={[source, status, assigned].filter(Boolean).length}
          />
          <StatCard label="Total Pages" value={totalPages || 1} />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Filters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Source
              </label>
              <select
                value={source}
                onChange={(e) => {
                  setPage(1);
                  setSource(e.target.value);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
              >
                <option value="">All Sources</option>
                <option value="EXCEL">Excel Import</option>
                <option value="WEBSITE">Website Form</option>
                <option value="META">Meta Ads</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
              >
                <option value="">All Statuses</option>
                <option value="NEW">New</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="CLOSED">Closed</option>
                {/* <option value="PROPOSAL">Proposal</option>

                <option value="NEGOTIATION">Negotiation</option>
                <option value="CONVERTED">Converted</option>
                <option value="LOST">Lost</option> */}
              </select>
            </div>

            {isManager && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assigned User
                </label>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search user..."
                    value={assignedUserSearch}
                    onFocus={() => setShowAssignedUserDropdown(true)}
                    onChange={(e) => setAssignedUserSearch(e.target.value)}
                    className="w-full px-3 py-2 border text-black border-slate-300 rounded-md text-sm outline-none"
                  />

                  {showAssignedUserDropdown && (
                    <div className="absolute top-full mt-1 w-full text-black bg-white rounded-md shadow-lg border border-slate-200 max-h-48 overflow-y-auto z-50">
                      <div
                        onClick={() => {
                          setAssignedUserFilter("");
                          setAssignedUserSearch("");
                          setShowAssignedUserDropdown(false);
                        }}
                        className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer"
                      >
                        All Users
                      </div>

                      {filteredUsersForFilter.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setAssignedUserFilter(u.id);
                            setAssignedUserSearch(u.name);
                            setShowAssignedUserDropdown(false);
                            setPage(1);
                          }}
                          className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer"
                        >
                          {u.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Date Filter */}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date Range
              </label>

              {/* Quick filters */}
              <div className="flex gap-2 mb-3">
                {["today", "week", "month"].map((type) => (
                  <button
                    key={type}
                    onClick={() => applyQuickDate(type)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                      quickDate === type
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {type === "today"
                      ? "Today"
                      : type === "week"
                        ? "This Week"
                        : "This Month"}
                  </button>
                ))}

                {/* Clear */}
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setQuickDate("");
                      setPage(1);
                    }}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Date range inputs */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">
                    From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setQuickDate("");
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">
                    To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setQuickDate("");
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {isManager && selectedLeads.length > 0 && (
          <div className="mb-4 bg-slate-900 text-white rounded-lg p-4 flex flex-wrap items-center gap-6">
            <div className="text-sm font-medium">
              {selectedLeads.length} lead
              {selectedLeads.length !== 1 ? "s" : ""} selected
            </div>

            {/* Searchable User Selector */}
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search user..."
                value={userSearch}
                onFocus={() => setShowUserDropdown(true)}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full px-3 py-2 bg-white text-slate-900 rounded-md text-sm outline-none"
              />

              {showUserDropdown && (
                <div className="absolute top-full mt-1 w-full bg-white text-slate-900 rounded-md shadow-lg border border-slate-200 max-h-48 overflow-y-auto z-50">
                  {filteredUsers.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      No users found
                    </div>
                  )}

                  {filteredUsers.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        setAssignUserId(u.id);
                        setUserSearch(u.name);
                        setShowUserDropdown(false);
                      }}
                      className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer transition-colors"
                    >
                      {u.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assign Button */}
            <button
              disabled={!assignUserId || assigning}
              onClick={handleBulkAssign}
              className="px-4 py-2 bg-white text-slate-900 rounded-md text-sm font-medium hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {assigning ? "Assigning..." : "Assign Selected"}
            </button>

            {/* Clear Button */}
            <button
              onClick={() => {
                setSelectedLeads([]);
                setAssignUserId("");
                setUserSearch("");
              }}
              className="px-4 py-2 bg-transparent border border-white/20 text-white rounded-md text-sm font-medium hover:bg-white/10 transition-all"
            >
              Clear Selection
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {isManager && (
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          leads.length > 0 &&
                          selectedLeads.length === leads.length
                        }
                        onChange={(e) =>
                          setSelectedLeads(
                            e.target.checked ? leads.map((l) => l.id) : [],
                          )
                        }
                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading && (
                  <tr>
                    <td colSpan={isManager ? 7 : 6} className="px-6 py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-3"></div>
                        <p className="text-sm text-slate-600">
                          Loading leads...
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && leads.length === 0 && (
                  <tr>
                    <td colSpan={isManager ? 7 : 6} className="px-6 py-12">
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
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-slate-900">
                          No leads found
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Try adjusting your filters
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {isManager && (
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedLeads.includes(lead.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeads([...selectedLeads, lead.id]);
                              } else {
                                setSelectedLeads(
                                  selectedLeads.filter((id) => id !== lead.id),
                                );
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                            {lead.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <button
                            onClick={() =>
                              router.push(`/dashboard/leads/${lead.id}`)
                            }
                            className="text-sm font-medium text-slate-900 hover:text-slate-600 text-left transition-colors"
                          >
                            {lead.name || "Unnamed Lead"}
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900">
                          {lead.phone || "-"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {lead.email || "-"}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700">
                          {lead.source || "-"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(lead.status)}`}
                        >
                          {lead.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {lead.assigned_to && userMap[lead.assigned_to] ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-emerald-700">
                                {userMap[lead.assigned_to]
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm text-slate-900">
                              {userMap[lead.assigned_to]}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(lead.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
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
                Page <span className="font-medium text-slate-900">{page}</span>{" "}
                of{" "}
                <span className="font-medium text-slate-900">
                  {totalPages || 1}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-4 py-2 bg-slate-900 border border-slate-900 rounded-md text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Components ---------- */

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <p className="text-sm font-medium text-slate-600 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
