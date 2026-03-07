// /api/auth/me/route.js
import { db } from "@/lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    
    if (!token) {
      return Response.json({ user: null });
    }

    // Verify token and get user ID
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Decoded JWT token:", decoded); // Debug log
    
    // Fetch full user details from database
    const [[user]] = await db.query(
      `SELECT id, name, email, role FROM users WHERE id = ? AND is_active = 1`,
      [decoded.id]
    );

    if (!user) {
      return Response.json({ user: null });
    }

    console.log("User from database:", user); // Debug log

    return Response.json({ 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error("Auth me error:", error);
    return Response.json({ user: null });
  }
}