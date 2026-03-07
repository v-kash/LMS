"use client";

import { useState } from "react";

export default function LeadFormPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setError("");

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/leads/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      setSuccess("Lead submitted successfully ✅");
      e.target.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-semibold mb-4 text-center">
          Contact Us
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="name"
            placeholder="Full Name"
            className="w-full border rounded px-3 py-2"
          />

          <input
            name="phone"
            placeholder="Phone Number"
            className="w-full border rounded px-3 py-2"
          />

          <input
            name="email"
            placeholder="Email Address"
            className="w-full border rounded px-3 py-2"
          />

          {/* 🔽 Service Type Dropdown */}
          <select
            name="serviceType"
            required
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select Service Type</option>
            <option value="Consultation">Consultation</option>
            <option value="Product Demo">Product Demo</option>
            <option value="Subscription">Subscription</option>
            <option value="Support">Support</option>
          </select>

          <textarea
            name="message"
            placeholder="Your requirement"
            rows="4"
            className="w-full border rounded px-3 py-2"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </form>

        {success && (
          <p className="mt-4 text-green-600 text-center">{success}</p>
        )}
        {error && (
          <p className="mt-4 text-red-600 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
