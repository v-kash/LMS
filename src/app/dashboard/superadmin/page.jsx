"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { io } from "socket.io-client";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusColor(status) {
  const colors = {
    NEW:       "bg-blue-50 text-blue-700 border-blue-200",
    ASSIGNED:  "bg-violet-50 text-violet-700 border-violet-200",
    CONTACTED: "bg-amber-50 text-amber-700 border-amber-200",
    QUALIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CLOSED:    "bg-slate-100 text-slate-600 border-slate-200",
  };
  return colors[status] || "bg-slate-100 text-slate-600 border-slate-200";
}

function formatRole(role) {
  if (!role) return "User";
  return role.charAt(0) + role.slice(1).toLowerCase().replace("_", " ");
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`bg-white rounded-xl border p-5 ${accent ? "border-violet-200 bg-violet-50/40" : "border-slate-200"}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? "text-violet-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const router = useRouter();

  const [user, setUser]   = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage]   = useState(1);
  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  // ── Filters ──
  const [source, setSource]           = useState("");
  const [status, setStatus]           = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [adName, setAdName]           = useState("");
  const [dateFrom, setDateFrom]       = useState("");
  const [timeFrom, setTimeFrom]       = useState("10:00");
  const [dateTo, setDateTo]           = useState("");
  const [timeTo, setTimeTo]           = useState("10:00");

  // Assigned-manager filter
  const [assignedManagerFilter, setAssignedManagerFilter] = useState("");
  const [assignedManagerSearch, setAssignedManagerSearch] = useState("");
  const [showAssignedMgrDropdown, setShowAssignedMgrDropdown] = useState(false);

  // Dropdown options
  const [campaigns, setCampaigns] = useState([]);
  const [adNames, setAdNames]     = useState([]);

  // Managers
  const [managers, setManagers]   = useState([]);
  const [managerMap, setManagerMap] = useState({});

  // ── Selection state ──
  const [selectedLeads, setSelectedLeads]       = useState([]);  // IDs on current page
  const [allFilteredSelected, setAllFilteredSelected] = useState(false); // "select all X" mode
  const [loadingAllIds, setLoadingAllIds]       = useState(false);

  // ── Assign ──
  const [assignManagerId, setAssignManagerId] = useState("");
  const [managerSearch, setManagerSearch]     = useState("");
  const [showMgrDropdown, setShowMgrDropdown] = useState(false);
  const [assigning, setAssigning]             = useState(false);

  // ── Unassign ──
  const [unassigning, setUnassigning] = useState(false);

  // ── Assign-by-filter ──
  const [assignByFilterMgrId, setAssignByFilterMgrId]       = useState("");
  const [assignByFilterMgrSearch, setAssignByFilterMgrSearch] = useState("");
  const [showAssignByFilterDropdown, setShowAssignByFilterDropdown] = useState(false);
  const [assigningByFilter, setAssigningByFilter]           = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  // Notifications
  const [notifications, setNotifications]       = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const assignedMgrDropdownRef    = useRef(null);
  const bulkMgrDropdownRef        = useRef(null);
  const assignByFilterDropdownRef = useRef(null);

  // Toast / alerts
  const [toast, setToast]         = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg]   = useState("");

  // User menu / password modal
  const [showUserMenu, setShowUserMenu]         = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword]   = useState("");
  const [newPassword, setNewPassword]   = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError]     = useState("");
  const [savingPassword, setSavingPassword]   = useState(false);
  const [showOldPw, setShowOldPw]     = useState(false);
  const [showNewPw, setShowNewPw]     = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Socket / audio
  const audioRef  = useRef(null);
  const socketRef = useRef(null);
  let lastSoundTime = 0;

  // ── Derived ──
  const filteredMgrsForBulk = managers.filter((m) =>
    m.name.toLowerCase().includes(managerSearch.toLowerCase())
  );
  const filteredMgrsForFilter = managers.filter((m) =>
    m.name.toLowerCase().includes(assignedManagerSearch.toLowerCase())
  );
  const filteredMgrsForAssignByFilter = managers.filter((m) =>
    m.name.toLowerCase().includes(assignByFilterMgrSearch.toLowerCase())
  );
  const activeFilterCount = [source, status, campaignName, adName, dateFrom, dateTo, assignedManagerFilter].filter(Boolean).length;

  // How many leads are "effectively selected":
  // If allFilteredSelected=true → all `total` leads; otherwise just the checked IDs
  const effectiveCount = allFilteredSelected ? total : selectedLeads.length;

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const res  = await fetch("/api/auth/me");
      const data = await res.json();
      if (!data.user) return router.push("/login");
      if (data.user.role !== "SUPER_ADMIN") return router.push("/dashboard/manager");
      setUser(data.user);
    }
    init();
  }, []);

  // ── Fetch managers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetch("/api/users?role=MANAGER")
      .then((r) => r.json())
      .then((data) => {
        const mgrs = data.users || [];
        setManagers(mgrs);
        const map = {};
        mgrs.forEach((m) => (map[m.id] = m.name));
        setManagerMap(map);
      })
      .catch(() => {});
  }, [user]);

  // ── Fetch dropdown options ────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/export/options")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCampaigns(data.campaigns || []);
          setAdNames(data.adNames   || []);
        }
      })
      .catch(() => {});
  }, []);

  // ── Socket.io ─────────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!user?.id) return;
    const socket = io("http://localhost:4000");
    socketRef.current = socket;
    socket.emit("join", user.id);
    socket.on("new_lead_generated", (data) => {
      playSound();
      setToast({ title: "New Lead", message: `${data.leadName} submitted a new inquiry.` });
      fetchLeads();
      loadNotifications();
    });
    return () => socket.disconnect();
  }, [user?.id]);

  function playSound() {
    const now = Date.now();
    if (now - lastSoundTime < 1000) return;
    lastSoundTime = now;
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Click-outside handler for ALL dropdowns
  useEffect(() => {
    function handler(e) {
      // Notifications panel
      if (showNotifications && notificationRef.current && !notificationRef.current.contains(e.target))
        setShowNotifications(false);

      // Filter panel "Assigned Manager" dropdown
      if (showAssignedMgrDropdown && assignedMgrDropdownRef.current && !assignedMgrDropdownRef.current.contains(e.target))
        setShowAssignedMgrDropdown(false);

      // Bulk action bar "Search manager" dropdown
      if (showMgrDropdown && bulkMgrDropdownRef.current && !bulkMgrDropdownRef.current.contains(e.target))
        setShowMgrDropdown(false);

      // Assign-by-filter dropdown
      if (showAssignByFilterDropdown && assignByFilterDropdownRef.current && !assignByFilterDropdownRef.current.contains(e.target))
        setShowAssignByFilterDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifications, showAssignedMgrDropdown, showMgrDropdown, showAssignByFilterDropdown]);

  // ── Build query params ────────────────────────────────────────────────────
  function buildParams(exportAll = false) {
    const p = new URLSearchParams();
    if (source)               p.append("source",           source);
    if (status)               p.append("status",           status);
    if (campaignName)         p.append("campaign_name",    campaignName);
    if (adName)               p.append("ad_name",          adName);
    if (dateFrom)             p.append("date_from",        `${dateFrom}T${timeFrom}:00`);
    if (dateTo)               p.append("date_to",          `${dateTo}T${timeTo}:00`);
    if (assignedManagerFilter) p.append("assigned_manager", assignedManagerFilter);
    if (exportAll) {
      p.append("export", "true");
    } else {
      p.append("page",  page);
      p.append("limit", limit);
    }
    return p;
  }

  // Current filters as a plain object (for assign-by-filter API)
  function currentFilters() {
    return {
      source:           source           || null,
      status:           status           || null,
      campaign_name:    campaignName     || null,
      ad_name:          adName           || null,
      date_from:        dateFrom ? `${dateFrom}T${timeFrom}:00` : null,
      date_to:          dateTo   ? `${dateTo}T${timeTo}:00`     : null,
      assigned_manager: assignedManagerFilter || null,
    };
  }

  // ── Fetch leads ───────────────────────────────────────────────────────────
  async function fetchLeads() {
    setLoading(true);
    // Reset cross-page selection whenever data refreshes
    setAllFilteredSelected(false);
    setSelectedLeads([]);
    try {
      const res  = await fetch(`/api/superadmin/leads?${buildParams()}`);
      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) fetchLeads();
  }, [user, source, status, campaignName, adName, dateFrom, timeFrom, dateTo, timeTo, assignedManagerFilter, page]);

  // ── Notifications ─────────────────────────────────────────────────────────
  async function loadNotifications() {
    try {
      const res  = await fetch("/api/notifications");
      const data = await res.json();
      if (data.success) setNotifications(data.notifications);
    } catch {}
  }

  useEffect(() => {
    if (user?.id) loadNotifications();
  }, [user?.id]);

  async function markAsRead(id) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadNotifications();
  }

  // ── SELECT ALL across pages ───────────────────────────────────────────────
  // Step 1: user ticks the page checkbox → selects current 20
  // Step 2: banner appears → user clicks "Select all X" → fetches all IDs
  async function handleSelectAllFiltered() {
    setLoadingAllIds(true);
    try {
      const res  = await fetch(`/api/superadmin/leads?${buildParams(true)}`);
      const data = await res.json();
      const allIds = (data.leads || []).map((l) => l.id);
      setSelectedLeads(allIds);
      setAllFilteredSelected(true);
    } catch {
      showError("Failed to select all leads.");
    } finally {
      setLoadingAllIds(false);
    }
  }

  function clearSelection() {
    setSelectedLeads([]);
    setAllFilteredSelected(false);
    setAssignManagerId("");
    setManagerSearch("");
  }

  // ── BULK ASSIGN ───────────────────────────────────────────────────────────
  async function handleBulkAssign() {
    if (!assignManagerId || selectedLeads.length === 0) return;
    setAssigning(true);
    try {
      const res  = await fetch("/api/superadmin/leads/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: selectedLeads, managerId: assignManagerId }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`${selectedLeads.length} lead(s) assigned to ${managerMap[assignManagerId]}.`);
        clearSelection();
        fetchLeads();
      } else {
        showError(data.message || "Assignment failed.");
      }
    } catch {
      showError("Server error. Please try again.");
    } finally {
      setAssigning(false);
    }
  }

  // ── BULK UNASSIGN ─────────────────────────────────────────────────────────
  async function handleBulkUnassign() {
    if (selectedLeads.length === 0) return;
    setUnassigning(true);
    try {
      const res  = await fetch("/api/superadmin/leads/unassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: selectedLeads }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`${selectedLeads.length} lead(s) unassigned.`);
        clearSelection();
        fetchLeads();
      } else {
        showError(data.message || "Unassign failed.");
      }
    } catch {
      showError("Server error. Please try again.");
    } finally {
      setUnassigning(false);
    }
  }

  // ── PER-ROW UNASSIGN ──────────────────────────────────────────────────────
  async function handleRowUnassign(leadId) {
    try {
      const res  = await fetch("/api/superadmin/leads/unassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [leadId] }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("Lead unassigned.");
        fetchLeads();
      } else {
        showError(data.message || "Unassign failed.");
      }
    } catch {
      showError("Server error. Please try again.");
    }
  }

  // ── ASSIGN BY FILTER ──────────────────────────────────────────────────────
  async function handleAssignByFilter() {
    if (!assignByFilterMgrId) return;
    setAssigningByFilter(true);
    try {
      const res  = await fetch("/api/superadmin/leads/assign-by-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: currentFilters(), managerId: assignByFilterMgrId }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`${data.affected} lead(s) assigned to ${managerMap[assignByFilterMgrId]}.`);
        setAssignByFilterMgrId("");
        setAssignByFilterMgrSearch("");
        fetchLeads();
      } else {
        showError(data.message || "Failed.");
      }
    } catch {
      showError("Server error. Please try again.");
    } finally {
      setAssigningByFilter(false);
    }
  }

  // ── EXPORT ────────────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true);
    try {
      const res      = await fetch(`/api/superadmin/leads?${buildParams(true)}`);
      const data     = await res.json();
      const allLeads = data.leads || [];
      const rows = allLeads.map((l, i) => ({
        "#":                i + 1,
        "Lead ID":          l.id,
        Name:               l.name         || "-",
        Phone:              l.phone        || "-",
        Email:              l.email        || "-",
        Source:             l.source       || "-",
        Status:             l.status       || "-",
        Campaign:           l.campaign_name || "-",
        "Ad Name":          l.ad_name      || "-",
        Platform:           l.platform     || "-",
        State:              l.state        || "-",
        "Assigned Manager": managerMap[l.assigned_manager] || "Unassigned",
        "Created At (IST)": new Date(l.created_at).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        }),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [5,12,22,15,28,10,12,28,22,12,15,22,25].map((w) => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, `leads_${dateFrom || "all"}_to_${dateTo || "all"}.xlsx`);
    } catch {
      showError("Export failed.");
    } finally {
      setExporting(false);
    }
  }

  // ── Quick date presets ────────────────────────────────────────────────────
  function applyQuickDate(type) {
    const now   = new Date();
    const today = now.toISOString().split("T")[0];
    if (type === "today") {
      const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
      setDateFrom(today); setTimeFrom("10:00");
      setDateTo(tomorrow.toISOString().split("T")[0]); setTimeTo("10:00");
    } else if (type === "yesterday") {
      const y = new Date(now); y.setDate(now.getDate() - 1);
      setDateFrom(y.toISOString().split("T")[0]); setTimeFrom("10:00");
      setDateTo(today); setTimeTo("10:00");
    } else if (type === "week") {
      const w = new Date(now); w.setDate(now.getDate() - 7);
      setDateFrom(w.toISOString().split("T")[0]); setTimeFrom("00:00");
      setDateTo(today); setTimeTo("23:59");
    } else if (type === "month") {
      setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
      setTimeFrom("00:00"); setDateTo(today); setTimeTo("23:59");
    }
    setPage(1);
  }

  function clearFilters() {
    setSource(""); setStatus(""); setCampaignName(""); setAdName("");
    setDateFrom(""); setDateTo(""); setTimeFrom("10:00"); setTimeTo("10:00");
    setAssignedManagerFilter(""); setAssignedManagerSearch("");
    setPage(1);
  }

  // ── Change password ───────────────────────────────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError("");
    if (!oldPassword || !newPassword || !confirmPassword) return setPasswordError("All fields are required.");
    if (newPassword.length < 6) return setPasswordError("Password must be at least 6 characters.");
    if (newPassword !== confirmPassword) return setPasswordError("Passwords do not match.");
    setSavingPassword(true);
    try {
      const res  = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPasswordModal(false);
        setOldPassword(""); setNewPassword(""); setConfirmPassword("");
        showSuccess("Password updated successfully.");
      } else {
        setPasswordError(data.message || "Incorrect old password.");
      }
    } catch {
      setPasswordError("Server error. Please try again.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function showSuccess(msg) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3500); }
  function showError(msg)   { setErrorMsg(msg);   setTimeout(() => setErrorMsg(""),   4000); }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* Global alerts */}
      {successMsg && (
        <div className="fixed top-5 right-5 z-[90] flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-5 right-5 z-[90] flex items-center gap-2 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          {errorMsg}
        </div>
      )}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[90] bg-slate-900 border border-slate-700 text-white px-5 py-4 rounded-xl shadow-2xl text-sm max-w-xs">
          <p className="font-semibold mb-0.5">{toast.title}</p>
          <p className="text-slate-400 text-xs">{toast.message}</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════ */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm tracking-tight">NG</span>
              </div>
              <span className="text-slate-900 font-semibold text-lg tracking-tight">NextGen LMS</span>
              <span className="ml-1 px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-md font-semibold tracking-wide">SUPER ADMIN</span>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3">
              {/* Export */}
              <button onClick={handleExport} disabled={exporting || total === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {exporting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Exporting…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Export {total > 0 ? `(${total})` : ""}</>
                )}
              </button>

              {/* Notifications */}
              <div className="relative" ref={notificationRef}>
                <button onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405C18.21 15.21 18 14.7 18 14.172V11a6 6 0 10-12 0v3.172c0 .528-.21 1.038-.595 1.423L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {notifications.filter((n) => !n.is_read).length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                      {notifications.filter((n) => !n.is_read).length}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">Notifications</span>
                      <span className="text-xs text-slate-400">{notifications.filter((n) => !n.is_read).length} unread</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet</div>
                      ) : notifications.map((n) => (
                        <div key={n.id} onClick={() => markAsRead(n.id)}
                          className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${!n.is_read ? "bg-violet-50/60" : ""}`}>
                          {!n.is_read && <span className="inline-block w-1.5 h-1.5 bg-violet-500 rounded-full mr-2 mb-0.5" />}
                          <p className="text-sm text-slate-700 leading-snug">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="relative">
                <button onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{user?.name || "Super Admin"}</p>
                    <p className="text-xs text-slate-400">{formatRole(user?.role)}</p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-violet-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {user?.name?.charAt(0).toUpperCase() || "S"}
                  </div>
                </button>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20">
                      <div className="p-4 bg-gradient-to-br from-violet-50 to-slate-50 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-violet-700 flex items-center justify-center text-white font-bold">
                            {user?.name?.charAt(0).toUpperCase() || "S"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                            <p className="text-xs text-slate-500">{user?.email}</p>
                          </div>
                        </div>
                        <span className="mt-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-violet-700 text-white">
                          {formatRole(user?.role)}
                        </span>
                      </div>
                      <div className="p-2">
                        <button onClick={() => { setShowUserMenu(false); setShowPasswordModal(true); }}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg w-full transition-colors">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          Change Password
                        </button>
                      </div>
                      <div className="p-2 border-t border-slate-100">
                        <button onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════════════════ */}
      <main className="max-w-[1600px] mx-auto px-6 lg:px-8 py-8">

        {/* Page header */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Lead Management</h1>
          <p className="text-sm text-slate-500">View all leads, assign or unassign managers, and export</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
          <StatCard label="Total Leads"    value={total.toLocaleString()} accent />
          <StatCard label="Page"           value={`${page} / ${totalPages || 1}`} />
          <StatCard label="Active Filters" value={activeFilterCount} />
          <StatCard label="Selected"       value={effectiveCount} />
        </div>

        {/* ── FILTERS ─────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-xs font-semibold rounded">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">Clear all</button>
          </div>

          {/* Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
            {/* Source */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Source</label>
              <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all">
                <option value="">All Sources</option>
                <option value="EXCEL">Excel Import</option>
                <option value="WEBSITE">Website Form</option>
                <option value="META">Meta Ads</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all">
                <option value="">All Statuses</option>
                <option value="NEW">New</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Assigned manager filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Assigned Manager</label>
              <div className="relative" ref={assignedMgrDropdownRef}>
                <input type="text" placeholder="Search manager…"
                  value={assignedManagerSearch}
                  onFocus={() => setShowAssignedMgrDropdown(true)}
                  onChange={(e) => setAssignedManagerSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 transition-all" />
                {showAssignedMgrDropdown && (
                  <div className="absolute top-full mt-1 w-full bg-white text-slate-900 rounded-lg shadow-lg border border-slate-200 max-h-48 overflow-y-auto z-50">
                    <div onClick={() => { setAssignedManagerFilter(""); setAssignedManagerSearch(""); setShowAssignedMgrDropdown(false); }}
                      className="px-3 py-2 text-sm hover:bg-violet-50 cursor-pointer text-slate-500">All Managers</div>
                    {filteredMgrsForFilter.map((m) => (
                      <div key={m.id} onClick={() => { setAssignedManagerFilter(m.id); setAssignedManagerSearch(m.name); setShowAssignedMgrDropdown(false); setPage(1); }}
                        className="px-3 py-2 text-sm hover:bg-violet-50 cursor-pointer font-medium">{m.name}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Campaign */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Campaign</label>
              <select value={campaignName} onChange={(e) => { setCampaignName(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all">
                <option value="">All Campaigns</option>
                {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Ad Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Ad Name</label>
              <select value={adName} onChange={(e) => { setAdName(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all">
                <option value="">All Ads</option>
                {adNames.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Quick date presets */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quick Presets</label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "today",     label: "🕙 Today (10am → 10am)" },
                { key: "yesterday", label: "🕙 Yesterday (10am → 10am)" },
                { key: "week",      label: "📅 Last 7 Days" },
                { key: "month",     label: "📅 This Month" },
              ].map((q) => (
                <button key={q.key} onClick={() => applyQuickDate(q.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 bg-white text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all">
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date + time range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">📅 From</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Date</label>
                  <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-500 outline-none bg-white" />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-slate-400 mb-1">Time</label>
                  <input type="time" value={timeFrom} onChange={(e) => { setTimeFrom(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-500 outline-none bg-white" />
                </div>
              </div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">📅 To</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Date</label>
                  <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-500 outline-none bg-white" />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-slate-400 mb-1">Time</label>
                  <input type="time" value={timeTo} onChange={(e) => { setTimeTo(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-500 outline-none bg-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── ASSIGN BY FILTER BAR ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 mb-4 flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Assign by Filter</p>
            <p className="text-xs text-slate-400">Assign all <span className="font-semibold text-slate-700">{total.toLocaleString()}</span> filtered leads at once — no selection needed</p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="relative w-56" ref={assignByFilterDropdownRef}>
              <input type="text" placeholder="Pick a manager…"
                value={assignByFilterMgrSearch}
                onFocus={() => setShowAssignByFilterDropdown(true)}
                onChange={(e) => { setAssignByFilterMgrSearch(e.target.value); setAssignByFilterMgrId(""); }}
                className="w-full px-3 py-2 border border-slate-300 text-slate-900 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500" />
              {showAssignByFilterDropdown && (
                <div className="absolute top-full mt-1 w-full bg-white text-slate-900 rounded-lg shadow-lg border border-slate-200 max-h-48 overflow-y-auto z-50">
                  {filteredMgrsForAssignByFilter.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-slate-400 text-center">No managers found</div>
                  ) : filteredMgrsForAssignByFilter.map((m) => (
                    <div key={m.id}
                      onClick={() => { setAssignByFilterMgrId(m.id); setAssignByFilterMgrSearch(m.name); setShowAssignByFilterDropdown(false); }}
                      className="px-3 py-2.5 text-sm hover:bg-violet-50 cursor-pointer font-medium flex items-center gap-2">
                      <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center text-xs font-bold text-violet-700">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      {m.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              disabled={!assignByFilterMgrId || assigningByFilter || total === 0}
              onClick={handleAssignByFilter}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap">
              {assigningByFilter ? (
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Assigning…
                </span>
              ) : `Assign all ${total.toLocaleString()} leads`}
            </button>
          </div>
        </div>

        {/* ── BULK ACTION BAR (shown when leads are selected) ─────────────── */}
        {selectedLeads.length > 0 && (
          <div className="mb-4 bg-slate-900 text-white rounded-xl p-4 flex flex-wrap items-center gap-4 shadow-lg">
            {/* Count */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-violet-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                {effectiveCount > 999 ? "999+" : effectiveCount}
              </div>
              <span className="text-sm font-medium">
                {allFilteredSelected
                  ? `All ${total.toLocaleString()} filtered leads selected`
                  : `${selectedLeads.length} lead${selectedLeads.length !== 1 ? "s" : ""} selected`}
              </span>
            </div>

            {/* Select-all-filtered banner */}
            {!allFilteredSelected && total > leads.length && (
              <button onClick={handleSelectAllFiltered} disabled={loadingAllIds}
                className="text-xs text-violet-300 hover:text-violet-100 underline underline-offset-2 transition-colors disabled:opacity-50">
                {loadingAllIds ? "Loading…" : `Select all ${total.toLocaleString()} filtered leads`}
              </button>
            )}

            {/* Manager search for assign */}
            <div className="flex-1 min-w-[200px] max-w-xs relative" ref={bulkMgrDropdownRef}>
              <input type="text" placeholder="Search manager to assign…"
                value={managerSearch}
                onFocus={() => setShowMgrDropdown(true)}
                onChange={(e) => { setManagerSearch(e.target.value); setAssignManagerId(""); }}
                className="w-full px-3 py-2 bg-white text-slate-900 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-400" />
              {showMgrDropdown && (
                <div className="absolute top-full mt-1 w-full bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 max-h-48 overflow-y-auto z-50">
                  {filteredMgrsForBulk.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-slate-400 text-center">No managers found</div>
                  ) : filteredMgrsForBulk.map((m) => (
                    <div key={m.id}
                      onClick={() => { setAssignManagerId(m.id); setManagerSearch(m.name); setShowMgrDropdown(false); }}
                      className="px-3 py-2.5 text-sm hover:bg-violet-50 cursor-pointer font-medium flex items-center gap-2 transition-colors">
                      <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center text-xs font-bold text-violet-700">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      {m.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assign btn */}
            <button disabled={!assignManagerId || assigning} onClick={handleBulkAssign}
              className="px-5 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap">
              {assigning ? (
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Assigning…
                </span>
              ) : "Assign to Manager"}
            </button>

            {/* Unassign btn */}
            <button disabled={unassigning} onClick={handleBulkUnassign}
              className="px-5 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap">
              {unassigning ? (
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Unassigning…
                </span>
              ) : "Unassign"}
            </button>

            {/* Clear */}
            <button onClick={clearSelection}
              className="px-4 py-2 border border-white/20 text-white/70 hover:text-white hover:border-white/40 rounded-lg text-sm font-medium transition-all">
              Clear
            </button>
          </div>
        )}

        {/* ── TABLE ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-3.5 text-left">
                    <input type="checkbox"
                      checked={leads.length > 0 && leads.every((l) => selectedLeads.includes(l.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // Add current page leads to selection (don't wipe cross-page)
                          const newIds = leads.map((l) => l.id);
                          setSelectedLeads((prev) => [...new Set([...prev, ...newIds])]);
                        } else {
                          // Deselect current page + exit "all filtered" mode
                          const pageIds = new Set(leads.map((l) => l.id));
                          setSelectedLeads((prev) => prev.filter((id) => !pageIds.has(id)));
                          setAllFilteredSelected(false);
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                  </th>
                  {["#", "Name", "Contact", "Source", "Campaign / Ad", "Status", "Assigned Manager", "Created At (IST)"].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr><td colSpan={9} className="py-16 text-center">
                    <div className="w-8 h-8 border-2 border-slate-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Loading leads…</p>
                  </td></tr>
                )}
                {!loading && leads.length === 0 && (
                  <tr><td colSpan={9} className="py-16 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No leads found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
                  </td></tr>
                )}

                {!loading && leads.map((lead, i) => (
                  <tr key={lead.id}
                    className={`hover:bg-slate-50/80 transition-colors ${selectedLeads.includes(lead.id) ? "bg-violet-50/40" : ""}`}>

                    {/* Checkbox */}
                    <td className="px-5 py-3.5">
                      <input type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedLeads([...selectedLeads, lead.id]);
                          else {
                            setSelectedLeads(selectedLeads.filter((id) => id !== lead.id));
                            setAllFilteredSelected(false);
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                    </td>

                    {/* Row number */}
                    <td className="px-4 py-3.5 text-xs text-slate-400 font-mono">
                      {(page - 1) * limit + i + 1}
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {lead.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <button onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                          className="text-sm font-semibold text-slate-900 hover:text-violet-700 text-left transition-colors">
                          {lead.name || "Unnamed Lead"}
                        </button>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3.5">
                      <div className="text-sm text-slate-800">{lead.phone || "-"}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{lead.email || "-"}</div>
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3.5">
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                        {lead.source || "-"}
                      </span>
                    </td>

                    {/* Campaign / Ad */}
                    <td className="px-4 py-3.5">
                      <div className="text-sm text-slate-700 font-medium truncate max-w-[160px]">{lead.campaign_name || "-"}</div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">{lead.ad_name || "-"}</div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>

                    {/* Assigned manager + per-row unassign */}
                    <td className="px-4 py-3.5">
                      {lead.assigned_manager && managerMap[lead.assigned_manager] ? (
                        <div className="flex items-center gap-2 group">
                          <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-violet-700">
                              {managerMap[lead.assigned_manager].charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm text-slate-800 font-medium">
                            {managerMap[lead.assigned_manager]}
                          </span>
                          {/* Per-row unassign — visible on row hover */}
                          <button
                            onClick={() => handleRowUnassign(lead.id)}
                            title="Unassign manager"
                            className="ml-1 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-all flex-shrink-0">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 text-xs font-medium">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Created at */}
                    <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Page <span className="font-semibold text-slate-900">{page}</span> of{" "}
              <span className="font-semibold text-slate-900">{totalPages || 1}</span>
              <span className="ml-2 text-slate-400">· {total.toLocaleString()} total leads</span>
            </p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Previous
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════
          CHANGE PASSWORD MODAL
      ══════════════════════════════════════════════════════ */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-semibold text-slate-900">Change Password</h2>
              <button onClick={() => { setShowPasswordModal(false); setPasswordError(""); }}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="px-6 py-5 space-y-4">
              {passwordError && (
                <div className="flex items-start gap-2 px-3 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                  </svg>
                  {passwordError}
                </div>
              )}
              {[
                { label: "Current Password",     val: oldPassword,     set: setOldPassword,     show: showOldPw,     toggle: () => setShowOldPw(!showOldPw) },
                { label: "New Password",          val: newPassword,     set: setNewPassword,     show: showNewPw,     toggle: () => setShowNewPw(!showNewPw),     hint: "Min. 6 characters" },
                { label: "Confirm New Password",  val: confirmPassword, set: setConfirmPassword, show: showConfirmPw, toggle: () => setShowConfirmPw(!showConfirmPw) },
              ].map(({ label, val, set, show, toggle, hint }) => (
                <div key={label}>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                  <div className="relative">
                    <input type={show ? "text" : "password"} value={val} onChange={(e) => set(e.target.value)}
                      placeholder={hint || ""}
                      className="w-full px-3 py-2.5 pr-10 border border-slate-300 text-slate-900 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 transition-all" />
                    <button type="button" onClick={toggle}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      {show ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => { setShowPasswordModal(false); setPasswordError(""); }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all">Cancel</button>
                <button type="submit" disabled={savingPassword}
                  className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-all">
                  {savingPassword ? "Saving…" : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}