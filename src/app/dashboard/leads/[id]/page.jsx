"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const STATUS_FLOW = {
  NEW: ["ASSIGNED"],
  ASSIGNED: ["CONTACTED", "NEW"],
  CONTACTED: ["QUALIFIED", "CLOSED"],
  QUALIFIED: ["PROPOSAL", "CLOSED"],
  PROPOSAL: ["NEGOTIATION", "CLOSED"],
  NEGOTIATION: ["CONVERTED", "LOST"],
  CONVERTED: [],
  LOST: [],
  CLOSED: [],
};

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [lead, setLead] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");

  const [disposition, setDisposition] = useState("");
  const [updating, setUpdating] = useState(false);

  const [followups, setFollowups] = useState([]);
  const [followupDate, setFollowupDate] = useState("");
  const [followupNote, setFollowupNote] = useState("");

  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const [revenue, setRevenue] = useState(null);
  const [amount, setAmount] = useState("");
  const [product, setProduct] = useState("");
  const [addingRevenue, setAddingRevenue] = useState(false);

  const allowedNextStatuses = STATUS_FLOW[currentStatus] || [];

  useEffect(() => {
    if (status !== "CLOSED") {
      setDisposition("");
    }
  }, [status]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const leadRes = await fetch(`/api/leads/${id}`);
      const leadData = await leadRes.json();

      if (!leadData.success) {
        router.push("/dashboard/manager");
        return;
      }

      const revRes = await fetch(`/api/leads/${id}/revenue`);
      const revData = await revRes.json();
      setRevenue(revData.revenue);

      const fuRes = await fetch(`/api/leads/${id}/followups`);
      const fuData = await fuRes.json();
      setFollowups(fuData.followups || []);

      const logsRes = await fetch(`/api/leads/${id}/logs`);
      const logsData = await logsRes.json();

      setLead(leadData.lead);
      setStatus(leadData.lead.status);
      setCurrentStatus(leadData.lead.status);
      setDisposition(leadData.lead.disposition || "");

      setLogs(logsData.logs || []);
      setLoading(false);
    }

    fetchData();
  }, [id]);

  // async function handleStatusUpdate() {
  //   setUpdating(true);

  //   const res = await fetch(`/api/leads/${id}/status`, {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ status, disposition }),
  //   });

  //   const data = await res.json();
  //   setUpdating(false);

  //   if (!data.success) {
  //     alert(data.message);
  //     return;
  //   }

  //   // Reload lead data
  //   const leadRes = await fetch(`/api/leads/${id}`);
  //   const leadData = await leadRes.json();
  //   setLead(leadData.lead);
  //   setCurrentStatus(leadData.lead.status);

  //   // Reload logs
  //   const logsRes = await fetch(`/api/leads/${id}/logs`);
  //   const logsData = await logsRes.json();
  //   setLogs(logsData.logs || []);
  // }

  async function handleStatusUpdate() {
    // 🚨 Prevent closing as Converted without revenue
    if (status === "CLOSED" && disposition === "Converted" && !revenue) {
      alert("You must add revenue before marking this lead as Converted.");
      return;
    }

    setUpdating(true);

    const res = await fetch(`/api/leads/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, disposition }),
    });

    const data = await res.json();
    setUpdating(false);

    if (!data.success) {
      alert(data.message);
      return;
    }

    const leadRes = await fetch(`/api/leads/${id}`);
    const leadData = await leadRes.json();
    setLead(leadData.lead);
    setCurrentStatus(leadData.lead.status);

    const logsRes = await fetch(`/api/leads/${id}/logs`);
    const logsData = await logsRes.json();
    setLogs(logsData.logs || []);
  }

  async function handleAddNote() {
    setAddingNote(true);

    const res = await fetch(`/api/leads/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteText }),
    });

    const data = await res.json();
    setAddingNote(false);

    if (!data.success) {
      alert(data.message);
      return;
    }

    setNoteText("");

    // Reload logs
    const logsRes = await fetch(`/api/leads/${id}/logs`);
    const logsData = await logsRes.json();
    setLogs(logsData.logs || []);
  }

  async function handleAddFollowup() {
    const res = await fetch(`/api/leads/${id}/followups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        followup_date: followupDate,
        note: followupNote,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message);
      return;
    }

    setFollowupDate("");
    setFollowupNote("");

    // Reload followups
    const r = await fetch(`/api/leads/${id}/followups`);
    const d = await r.json();
    setFollowups(d.followups);
  }

  async function handleMarkFollowupDone(followupId) {
    await fetch(`/api/followups/${followupId}/done`, {
      method: "POST",
    });

    const r = await fetch(`/api/leads/${id}/followups`);
    const d = await r.json();
    setFollowups(d.followups);
  }

  async function handleAddRevenue() {
  if (!amount || Number(amount) <= 0) {
    alert("Please enter a valid revenue amount.");
    return;
  }

  setAddingRevenue(true);

  try {
    // 1️⃣ First update status in DB
    const statusRes = await fetch(`/api/leads/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "CLOSED",
        disposition: "Converted",
      }),
    });

    const statusData = await statusRes.json();

    if (!statusData.success) {
      alert(statusData.message);
      setAddingRevenue(false);
      return;
    }

    // 2️⃣ Now add revenue (status is CLOSED in DB)
    const res = await fetch(`/api/leads/${id}/revenue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amount),
        product,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message);
      setAddingRevenue(false);
      return;
    }

    // 3️⃣ Reload lead
    const leadRes = await fetch(`/api/leads/${id}`);
    const leadData = await leadRes.json();
    setLead(leadData.lead);
    setCurrentStatus(leadData.lead.status);

    // 4️⃣ Reload revenue
    const r = await fetch(`/api/leads/${id}/revenue`);
    const d = await r.json();
    setRevenue(d.revenue);

    setAmount("");
    setProduct("");

  } catch (error) {
    console.error(error);
    alert("Something went wrong.");
  }

  setAddingRevenue(false);
}


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-600">Loading lead details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
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
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8">
        {/* Back Button & Title */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Leads
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 mb-1">
                {lead.name || "Unnamed Lead"}
              </h1>
              <div className="flex items-center gap-3">
                <StatusBadge status={lead.status} />
                <span className="text-sm text-slate-500">•</span>
                <span className="text-sm text-slate-600">{lead.source}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Lead Information */}
            <Section title="Lead Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoField label="Phone" value={lead.phone || "-"} />
                <InfoField label="Email" value={lead.email || "-"} />
                <InfoField label="Campaign" value={lead.campaign_name || "-"} />
                <InfoField label="Ad Name" value={lead.ad_name || "-"} />
                <InfoField label="Platform" value={lead.platform || "-"} />
                <InfoField
                  label="Assigned To"
                  value={lead.assigned_to_name || "Unassigned"}
                />
              </div>
            </Section>

            {/* Update Status */}
            <Section title="Update Status">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    >
                      <option value={currentStatus}>
                        {currentStatus} (Current)
                      </option>
                      {allowedNextStatuses.map((next) => (
                        <option key={next} value={next}>
                          {next}
                        </option>
                      ))}
                    </select>
                  </div>

                  {status === "CLOSED" && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Disposition <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={disposition}
                        onChange={(e) => setDisposition(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                      >
                        <option value="">Select Disposition</option>
                        <option value="Interested">Interested</option>
                        <option value="Not Interested">Not Interested</option>
                        <option value="Call Not Picked">Call Not Picked</option>
                        <option value="Budget Issue">Budget Issue</option>
                        <option value="Duplicate Lead">Duplicate Lead</option>
                        <option value="Invalid Lead">Invalid Lead</option>
                        <option value="Converted">Converted</option>
                      </select>
                    </div>
                  )}
                </div>

                {status === "CLOSED" &&
                  disposition === "Converted" &&
                  !revenue && (
                    <p className="text-sm text-red-600">
                      Revenue must be added before closing as Converted.
                    </p>
                  )}

                <button
                  disabled={
                    updating ||
                    (status === "CLOSED" &&
                      disposition === "Converted" &&
                      !revenue)
                  }
                  onClick={handleStatusUpdate}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {updating ? "Updating..." : "Update Status"}
                </button>

                {/* <button
                  disabled={updating}
                  onClick={handleStatusUpdate}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {updating ? "Updating..." : "Update Status"}
                </button> */}
              </div>
            </Section>

            {((status === "CLOSED" && disposition === "Converted") ||
              (lead.status === "CLOSED" &&
                lead.disposition === "Converted")) && (
              <Section title="Revenue">
                {!revenue ? (
                  <div className="space-y-4 text-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Amount (₹)
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Product / Service
                        </label>
                        <input
                          type="text"
                          placeholder="Product name"
                          value={product}
                          onChange={(e) => setProduct(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                    <button
                      disabled={addingRevenue || !amount}
                      onClick={handleAddRevenue}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all"
                    >
                      {addingRevenue ? "Saving..." : "Add Revenue"}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-emerald-900 mb-1">
                          Amount
                        </p>
                        <p className="text-xl font-semibold text-emerald-600">
                          ₹{revenue.amount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-emerald-900 mb-1">
                          Product
                        </p>
                        <p className="text-sm text-emerald-700">
                          {revenue.product || "-"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-600 mt-3">
                      Converted on{" "}
                      {new Date(revenue.converted_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </Section>
            )}

            {/* Notes */}
            {lead.status !== "CLOSED" && (
              <Section title="Add Note">
                <div className="space-y-3 text-gray-800">
                  <textarea
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note about this lead..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none resize-none"
                  />
                  <button
                    disabled={addingNote || !noteText.trim()}
                    onClick={handleAddNote}
                    className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {addingNote ? "Adding..." : "Add Note"}
                  </button>
                </div>
              </Section>
            )}

            {/* Follow-ups */}
            {lead.status !== "NEW" && lead.status !== "CLOSED" && (
              <Section title="Follow-ups">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-gray-800">
                    <input
                      type="datetime-local"
                      value={followupDate}
                      onChange={(e) => setFollowupDate(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={followupNote}
                      onChange={(e) => setFollowupNote(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    />
                    <button
                      onClick={handleAddFollowup}
                      disabled={!followupDate}
                      className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-all"
                    >
                      Add Follow-up
                    </button>
                  </div>

                  {followups.length > 0 && (
                    <div className="space-y-2">
                      {followups.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-md"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-900">
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
                              <p className="text-xs text-slate-600 mt-1">
                                {f.note}
                              </p>
                            )}
                          </div>
                          {f.status === "PENDING" && (
                            <button
                              onClick={() => handleMarkFollowupDone(f.id)}
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                            >
                              Mark Done
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            
          </div>

          {/* Right Column - Activity Timeline */}
          <div className="lg:col-span-1">
            <Section title="Activity Timeline">
              {logs.length === 0 ? (
                <p className="text-sm text-slate-500">No activity yet.</p>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="relative pl-6 pb-4 border-l-2 border-slate-200 last:pb-0"
                    >
                      <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-slate-400"></div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-900">
                          {log.action === "NOTE_ADDED"
                            ? "Note Added"
                            : log.action.replace(/_/g, " ")}
                        </p>
                        {log.new_value && (
                          <p className="text-sm text-slate-600 whitespace-pre-wrap">
                            {log.new_value}
                          </p>
                        )}
                        <p className="text-xs text-slate-500">
                          {log.performed_by_name || "System"} •{" "}
                          {new Date(log.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Components ---------- */

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

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-sm text-slate-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const statusConfig = {
    NEW: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    ASSIGNED: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-200",
    },
    CONTACTED: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    },
    QUALIFIED: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
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
    CONVERTED: {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
    },
    LOST: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    CLOSED: {
      bg: "bg-slate-50",
      text: "text-slate-700",
      border: "border-slate-200",
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
