"use client";

import { useEffect, useState } from "react";

export default function UserHeader() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user));
  }, []);

  if (!user) return null;

  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <p className="text-sm text-slate-500">Logged in as</p>
        <p className="font-semibold text-slate-900">
          {user.name} · {user.role}
        </p>
      </div>

      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/login";
        }}
        className="text-sm text-red-600"
      >
        Logout
      </button>
    </div>
  );
}
