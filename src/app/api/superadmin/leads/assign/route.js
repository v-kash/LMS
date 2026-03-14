// app/api/superadmin/leads/assign/route.js
import { db } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function POST(req) {
  /* ---------------- AUTH ---------------- */

  const token = req.cookies.get("token")?.value;

  if (!token) {
    return Response.json({ success: false }, { status: 401 });
  }

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch {
    return Response.json({ success: false }, { status: 401 });
  }

  if (user.role !== "SUPER_ADMIN") {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  /* ---------------- BODY ---------------- */

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const { leadIds, managerId } = body;

  /* ---------------- VALIDATE ---------------- */

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return Response.json({ success: false, message: "No leads selected." }, { status: 400 });
  }

  if (!managerId) {
    return Response.json({ success: false, message: "Manager ID is required." }, { status: 400 });
  }

  // Confirm the target user actually exists and is a MANAGER
  const [managerRows] = await db.query(
    "SELECT id, name FROM users WHERE id = ? AND role = 'MANAGER' LIMIT 1",
    [managerId],
  );

  if (managerRows.length === 0) {
    return Response.json({ success: false, message: "Invalid manager." }, { status: 400 });
  }

  /* ---------------- UPDATE ---------------- */

  // assigned_manager  → set to this manager (Super Admin → Manager link)
  // status            → only flip NEW → ASSIGNED; leave all other statuses untouched
  // assigned_to       → intentionally NOT touched; manager will assign to sales later

  const placeholders = leadIds.map(() => "?").join(", ");

  await db.query(
    `UPDATE leads
     SET
       assigned_manager = ?,
       status           = CASE WHEN status = 'NEW' THEN 'ASSIGNED' ELSE status END,
       updated_at       = NOW()
     WHERE id IN (${placeholders})
       AND deleted_at IS NULL`,
    [managerId, ...leadIds],
  );

  return Response.json({
    success: true,
    message: `${leadIds.length} lead(s) assigned to ${managerRows[0].name}.`,
    assignedTo: managerRows[0].name,
  });
}