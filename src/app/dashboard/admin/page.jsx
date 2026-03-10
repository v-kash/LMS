"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BRANCHES = ["AHMEDABAD", "PUNE", "CHENNAI"];
const ROLES = ["MANAGER", "SALES", "REPORTER"];

const EMPTY_FORM = {
  name: "", email: "", password: "", role: "SALES", branch: "AHMEDABAD", is_active: 1,
};

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [filterRole, setFilterRole] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [changePassUser, setChangePassUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Form
  const [form, setForm] = useState(EMPTY_FORM);

  // Auth check
  useEffect(() => {
    async function fetchUser() {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!data.user || data.user.role !== "ADMIN") {
        router.push("/login");
      } else {
        setUser(data.user);
      }
    }
    fetchUser();
  }, []);

  // Fetch users
  async function fetchUsers() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterRole) params.append("role", filterRole);
    if (filterBranch) params.append("branch", filterBranch);
    if (filterStatus) params.append("status", filterStatus);
    if (search) params.append("search", search);

    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  useEffect(() => {
    if (user) fetchUsers();
  }, [user, filterRole, filterBranch, filterStatus, search]);

  function showSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  }

  function showError(msg) {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  }

  // Add user
  async function handleAddUser() {
    if (!form.name || !form.email || !form.password) {
      showError("Name, email and password are required");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      showSuccess("User created successfully!");
      fetchUsers();
    } else {
      showError(data.message || "Failed to create user");
    }
  }

  // Edit user
  async function handleEditUser() {
    if (!editUser.name || !editUser.email) {
      showError("Name and email are required");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/users/${editUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editUser.name,
        email: editUser.email,
        role: editUser.role,
        branch: editUser.branch,
        is_active: editUser.is_active,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      setEditUser(null);
      showSuccess("User updated successfully!");
      fetchUsers();
    } else {
      showError(data.message || "Failed to update user");
    }
  }

  // Toggle active
  async function handleToggleActive(u) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: u.is_active ? 0 : 1 }),
    });
    const data = await res.json();
    if (data.success) {
      showSuccess(`User ${u.is_active ? "deactivated" : "activated"} successfully!`);
      fetchUsers();
    }
  }

  // Delete user
  async function handleDeleteUser() {
    setSaving(true);
    const res = await fetch(`/api/admin/users/${deleteUser.id}`, { method: "DELETE" });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      setDeleteUser(null);
      showSuccess("User deleted successfully!");
      fetchUsers();
    } else {
      showError(data.message || "Failed to delete user");
    }
  }

  // Change password
  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) {
      showError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("Passwords do not match");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/users/${changePassUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      setChangePassUser(null);
      setNewPassword("");
      setConfirmPassword("");
      showSuccess("Password changed successfully!");
    } else {
      showError(data.message || "Failed to change password");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const getRoleColor = (role) => {
    const colors = {
      ADMIN: "bg-red-50 text-red-700 border-red-200",
      MANAGER: "bg-purple-50 text-purple-700 border-purple-200",
      SALES: "bg-blue-50 text-blue-700 border-blue-200",
      REPORTER: "bg-amber-50 text-amber-700 border-amber-200",
    };
    return colors[role] || "bg-slate-50 text-slate-700 border-slate-200";
  };

  const getBranchColor = (branch) => {
    const colors = {
      AHMEDABAD: "bg-emerald-50 text-emerald-700",
      PUNE: "bg-indigo-50 text-indigo-700",
      CHENNAI: "bg-orange-50 text-orange-700",
    };
    return colors[branch] || "bg-slate-50 text-slate-600";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      {success && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">
          ❌ {error}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-sm">NG</span>
              </div>
              <span className="text-slate-900 font-semibold text-lg">NextGen LMS</span>
              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-md font-medium">Admin</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setForm(EMPTY_FORM); setShowAddModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-700 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add User
              </button>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white font-medium text-sm">
                  {user?.name?.charAt(0).toUpperCase() || "A"}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                  <p className="text-xs text-slate-500">Admin</p>
                </div>
                <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-600 transition-colors ml-2">
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
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">User Management</h1>
          <p className="text-sm text-slate-600">Manage all users, roles and branches</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Users", value: users.length },
            { label: "Active", value: users.filter(u => u.is_active).length },
            { label: "Inactive", value: users.filter(u => !u.is_active).length },
            { label: "Branches", value: 3 },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-600 mb-1">{s.label}</p>
              <p className="text-2xl font-semibold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none"
            />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none"
            >
              <option value="">All Roles</option>
              {["ADMIN", ...ROLES].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none"
            >
              <option value="">All Branches</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {["User", "Email", "Role", "Branch", "Status", "Created", "Actions"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Loading users...</p>
                    </td>
                  </tr>
                )}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-500">No users found</td>
                  </tr>
                )}
                {!loading && users.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${!u.is_active ? "opacity-60" : ""}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{u.email}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getRoleColor(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {u.branch ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${getBranchColor(u.branch)}`}>
                          {u.branch}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full transition-all ${
                          u.is_active
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-red-50 text-red-700 hover:bg-red-100"
                        }`}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {new Date(u.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric"
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {/* Edit */}
                        <button
                          onClick={() => setEditUser({ ...u })}
                          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all"
                          title="Edit user"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {/* Change Password */}
                        <button
                          onClick={() => { setChangePassUser(u); setNewPassword(""); setConfirmPassword(""); }}
                          className="p-1.5 rounded-md text-slate-500 hover:bg-amber-50 hover:text-amber-700 transition-all"
                          title="Change password"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => setDeleteUser(u)}
                          className="p-1.5 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700 transition-all"
                          title="Delete user"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── ADD USER MODAL ── */}
      {showAddModal && (
        <Modal title="Add New User" onClose={() => setShowAddModal(false)}>
          <UserForm form={form} setForm={setForm} showPassword />
          <ModalFooter
            onCancel={() => setShowAddModal(false)}
            onConfirm={handleAddUser}
            confirmLabel="Create User"
            saving={saving}
          />
        </Modal>
      )}

      {/* ── EDIT USER MODAL ── */}
      {editUser && (
        <Modal title="Edit User" onClose={() => setEditUser(null)}>
          <UserForm form={editUser} setForm={setEditUser} showPassword={false} />
          <ModalFooter
            onCancel={() => setEditUser(null)}
            onConfirm={handleEditUser}
            confirmLabel="Save Changes"
            saving={saving}
          />
        </Modal>
      )}

      {/* ── CHANGE PASSWORD MODAL ── */}
      {changePassUser && (
        <Modal title={`Change Password — ${changePassUser.name}`} onClose={() => setChangePassUser(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full px-3 py-2 border border-slate-300 text-slate-700 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full px-3 py-2 border border-slate-300 text-slate-700 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
          <ModalFooter
            onCancel={() => setChangePassUser(null)}
            onConfirm={handleChangePassword}
            confirmLabel="Change Password"
            saving={saving}
            confirmClass="bg-amber-600 hover:bg-amber-700"
          />
        </Modal>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteUser && (
        <Modal title="Delete User" onClose={() => setDeleteUser(null)}>
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <span className="font-semibold text-slate-900">{deleteUser.name}</span>?
            This action cannot be undone.
          </p>
          <ModalFooter
            onCancel={() => setDeleteUser(null)}
            onConfirm={handleDeleteUser}
            confirmLabel="Delete User"
            saving={saving}
            confirmClass="bg-red-600 hover:bg-red-700"
          />
        </Modal>
      )}
    </div>
  );
}

/* ── REUSABLE COMPONENTS ── */

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function UserForm({ form, setForm, showPassword }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Enter full name"
          className="w-full px-3 py-2 border text-slate-700 border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Enter email"
          className="w-full px-3 py-2 border text-slate-700 border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>
      {showPassword && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Min 6 characters"
            className="w-full px-3 py-2 border text-slate-700 border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full px-3 py-2 border text-slate-700 border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900"
          >
            {["MANAGER", "SALES", "REPORTER"].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
          <select
            value={form.branch || ""}
            onChange={(e) => setForm({ ...form, branch: e.target.value })}
            className="w-full px-3 py-2 border text-slate-700 border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">Select Branch</option>
            {["AHMEDABAD", "PUNE", "CHENNAI"].map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, confirmLabel, saving, confirmClass = "bg-slate-900 hover:bg-slate-700" }) {
  return (
    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
      <button
        onClick={onCancel}
        className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={saving}
        className={`px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50 transition-all ${confirmClass}`}
      >
        {saving ? "Saving..." : confirmLabel}
      </button>
    </div>
  );
}