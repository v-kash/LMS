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

// GET — list all users with filters
export async function GET(req) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return Response.json({ success: false }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    const branch = searchParams.get("branch");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    let where = "WHERE 1=1";
    const values = [];

    if (role) {
      where += " AND role = ?";
      values.push(role);
    }

    if (branch) {
      where += " AND branch = ?";
      values.push(branch);
    }

    if (status === "active") {
      where += " AND is_active = 1";
    } else if (status === "inactive") {
      where += " AND is_active = 0";
    }

    if (search) {
      where += " AND (name LIKE ? OR email LIKE ?)";
      values.push(`%${search}%`, `%${search}%`);
    }

    const [users] = await db.query(
      `SELECT id, name, email, role, branch, is_active, created_at
       FROM users ${where}
       ORDER BY created_at DESC`,
      values
    );

    return Response.json({ success: true, users });

  } catch (error) {
    console.error("Admin GET users error:", error);
    return Response.json({ success: false, message: "Failed to fetch users" }, { status: 500 });
  }
}

// POST — create new user
export async function POST(req) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return Response.json({ success: false }, { status: 401 });

    const { name, email, password, role, branch, is_active } = await req.json();

    if (!name || !email || !password) {
      return Response.json({ success: false, message: "Name, email and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return Response.json({ success: false, message: "Password must be at least 6 characters" }, { status: 400 });
    }

    // Check duplicate email
    const [existing] = await db.query(
      `SELECT id FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    if (existing.length > 0) {
      return Response.json({ success: false, message: "Email already exists" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users (name, email, password, role, branch, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, role || "SALES", branch || null, is_active ?? 1]
    );

    return Response.json({ success: true, userId: result.insertId }, { status: 201 });

  } catch (error) {
    console.error("Admin POST user error:", error);
    return Response.json({ success: false, message: "Failed to create user" }, { status: 500 });
  }
}