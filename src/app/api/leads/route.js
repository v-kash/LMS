// import { db } from "@/lib/db";
// import jwt from "jsonwebtoken";

// const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// export async function GET(req) {
//   try {
//     /* ---------------- AUTH ---------------- */

//     const token = req.cookies.get("token")?.value;

//     if (!token) {
//       return Response.json({ success: false }, { status: 401 });
//     }

//     let user;
//     try {
//       user = jwt.verify(token, JWT_SECRET);
//     } catch {
//       return Response.json({ success: false }, { status: 401 });
//     }

//     /* ---------------- QUERY PARAMS ---------------- */

//     const { searchParams } = new URL(req.url);

//     const source = searchParams.get("source");
//     const status = searchParams.get("status");
//     const assigned = searchParams.get("assigned"); // yes | no
//     const assignedUser = searchParams.get("assigned_user");

//     const page = parseInt(searchParams.get("page") || "1");
//     const limit = parseInt(searchParams.get("limit") || "20");
//     // Add these with your other searchParams
//     const date_from = searchParams.get("date_from");
//     const date_to = searchParams.get("date_to");

//     const offset = (page - 1) * limit;

//     let where = "WHERE deleted_at IS NULL";
//     const values = [];

//     /* ---------------- ROLE SCOPING ---------------- */

//     // SALES can only see their own leads
//     if (user.role === "SALES") {
//       where += " AND assigned_to = ?";
//       values.push(user.id);
//     }

//     // Filter by assigned user (Manager only)
//     if (assignedUser && user.role === "MANAGER") {
//       where += " AND assigned_to = ?";
//       values.push(assignedUser);
//     }

//     /* ---------------- FILTERS ---------------- */

//     if (source) {
//       where += " AND source = ?";
//       values.push(source);
//     }

//     if (status) {
//       where += " AND status = ?";
//       values.push(status);
//     }

//     // Assigned filter (only meaningful for MANAGER)
//     if (assigned === "yes") {
//       where += " AND assigned_to IS NOT NULL";
//     }

//     if (assigned === "no") {
//       where += " AND assigned_to IS NULL";
//     }

//     if (date_from) {
//       where += ` AND DATE(created_at) >= ?`;
//       values.push(date_from);
//     }
//     if (date_to) {
//       where += ` AND DATE(created_at) <= ?`;
//       values.push(date_to);
//     }

//     /* ---------------- TOTAL COUNT ---------------- */

//     const [countRows] = await db.query(
//       `SELECT COUNT(*) AS total FROM leads ${where}`,
//       values,
//     );

//     const total = countRows[0].total;

//     /* ---------------- FETCH LEADS ---------------- */

//     const [leads] = await db.query(
//       `
//       SELECT
//         id,
//         name,
//         phone,
//         email,
//         source,
//         status,
//         disposition,
//         assigned_to,
//         created_at
//       FROM leads
//       ${where}
//       ORDER BY created_at DESC, id DESC
//       LIMIT ? OFFSET ?
//       `,
//       [...values, limit, offset],
//     );

//     return Response.json({
//       success: true,
//       page,
//       limit,
//       total,
//       leads,
//       role: user.role, // 🔥 useful for frontend
//     });
//   } catch (error) {
//     console.error("Fetch leads error:", error);

//     return Response.json(
//       { success: false, message: "Failed to fetch leads" },
//       { status: 500 },
//     );
//   }
// }
// app/api/leads/route.js  ← REPLACE your existing file with this
import { db } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function GET(req) {
  try {
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

    /* ---------------- QUERY PARAMS ---------------- */

    const { searchParams } = new URL(req.url);

    const source       = searchParams.get("source");
    const status       = searchParams.get("status");
    const assigned     = searchParams.get("assigned"); // "yes" | "no"
    const assignedUser = searchParams.get("assigned_user");
    const date_from    = searchParams.get("date_from");
    const date_to      = searchParams.get("date_to");

    const page   = parseInt(searchParams.get("page")  || "1");
    const limit  = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let where = "WHERE deleted_at IS NULL";
    const values = [];

    /* ---------------- ROLE SCOPING ---------------- */

    if (user.role === "SALES") {
      // Sales users only see leads explicitly assigned to them
      where += " AND assigned_to = ?";
      values.push(user.id);
    }

    if (user.role === "MANAGER") {
      // ✅ Managers only see leads that Super Admin assigned to them via assigned_manager
      where += " AND assigned_manager = ?";
      values.push(user.id);

      // Further narrow by a specific sales user if the manager filters for one
      if (assignedUser) {
        where += " AND assigned_to = ?";
        values.push(assignedUser);
      }
    }

    // SUPER_ADMIN and REPORTER: no role scoping — they see everything

    /* ---------------- FILTERS ---------------- */

    if (source) {
      where += " AND source = ?";
      values.push(source);
    }

    if (status) {
      where += " AND status = ?";
      values.push(status);
    }

    if (assigned === "yes") {
      where += " AND assigned_to IS NOT NULL";
    }

    if (assigned === "no") {
      where += " AND assigned_to IS NULL";
    }

    if (date_from) {
      where += " AND DATE(created_at) >= ?";
      values.push(date_from);
    }

    if (date_to) {
      where += " AND DATE(created_at) <= ?";
      values.push(date_to);
    }

    /* ---------------- TOTAL COUNT ---------------- */

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM leads ${where}`,
      values,
    );

    const total = countRows[0].total;

    /* ---------------- FETCH LEADS ---------------- */

    const [leads] = await db.query(
      `
      SELECT
        id,
        name,
        phone,
        email,
        source,
        status,
        disposition,
        assigned_to,
        assigned_manager,
        created_at
      FROM leads
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      [...values, limit, offset],
    );

    return Response.json({
      success: true,
      page,
      limit,
      total,
      leads,
      role: user.role,
    });
  } catch (error) {
    console.error("Fetch leads error:", error);

    return Response.json(
      { success: false, message: "Failed to fetch leads" },
      { status: 500 },
    );
  }
}