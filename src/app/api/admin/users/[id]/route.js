import { db } from "@/lib/db";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

async function verifyAdmin(req) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (user.role !== "ADMIN") return null;
    return user;
  } catch {
    return null;
  }
}

export async function PUT(req, { params }) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return Response.json({ success: false }, { status: 401 });

    const { id } = await params; // ✅ await params
    const body = await req.json();

    // If password is being changed
    if (body.password) {
      if (body.password.length < 6) {
        return Response.json(
          { success: false, message: "Password must be at least 6 characters" },
          { status: 400 },
        );
      }
      const hashed = await bcrypt.hash(body.password, 10);
      await db.query(`UPDATE users SET password = ? WHERE id = ?`, [
        hashed,
        id,
      ]);
      return Response.json({ success: true });
    }

    // Build dynamic update for other fields
    const fields = [];
    const values = [];

    if (body.name !== undefined) {
      fields.push("name = ?");
      values.push(body.name);
    }
    if (body.email !== undefined) {
      fields.push("email = ?");
      values.push(body.email);
    }
    if (body.role !== undefined) {
      fields.push("role = ?");
      values.push(body.role);
    }
    if (body.branch !== undefined) {
      fields.push("branch = ?");
      values.push(body.branch || null);
    }
    if (body.is_active !== undefined) {
      fields.push("is_active = ?");
      values.push(body.is_active);
    }

    if (fields.length === 0) {
      return Response.json(
        { success: false, message: "Nothing to update" },
        { status: 400 },
      );
    }

    if (body.email) {
      const [existing] = await db.query(
        `SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1`,
        [body.email, id],
      );
      if (existing.length > 0) {
        return Response.json(
          { success: false, message: "Email already exists" },
          { status: 400 },
        );
      }
    }

    values.push(id);
    await db.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("Admin PUT user error:", error);
    return Response.json(
      { success: false, message: "Failed to update user" },
      { status: 500 },
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return Response.json({ success: false }, { status: 401 });

    const { id } = await params; // ✅ await params

    if (String(admin.id) === String(id)) {
      return Response.json(
        { success: false, message: "You cannot delete your own account" },
        { status: 400 },
      );
    }

    await db.query(`DELETE FROM users WHERE id = ?`, [id]);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Admin DELETE user error:", error);
    return Response.json(
      { success: false, message: "Failed to delete user" },
      { status: 500 },
    );
  }
}
