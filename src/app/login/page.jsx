"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (!data.success) {
        alert(data.message);
        setLoading(false);
        return;
      }
      
      // Redirect based on role
      if (data.role === "MANAGER") {
        window.location.href = "/dashboard/manager";
      } else {
        window.location.href = "/dashboard/sales";
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Login failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">NG</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">NextGen LMS</h1>
          <p className="text-sm text-slate-600 mt-1">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <form onSubmit={login} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                className="w-full px-3 py-2 text-gray-900 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                className="w-full px-3 py-2 text-gray-900 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
          © 2024 NextGen LMS. All rights reserved.
        </p>
      </div>
    </div>
  );
}