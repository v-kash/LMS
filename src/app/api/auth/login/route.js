import { db } from "@/lib/db";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return Response.json(
      { success: false, message: "Email and password required" },
      { status: 400 }
    );
  }

  const [[user]] = await db.query(
    `
    SELECT id, name, email, password, role
    FROM users
    WHERE email = ? AND is_active = 1
    `,
    [email]
  );

  if (!user) {
    return Response.json(
      { success: false, message: "Invalid credentials" },
      { status: 401 }
    );
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return Response.json(
      { success: false, message: "Invalid credentials" },
      { status: 401 }
    );
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  // ✅ IMPORTANT: Add more cookie options for better compatibility
  const cookieOptions = [
    `token=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=604800`
  ];

  // Add Secure flag in production
  if (process.env.NODE_ENV === 'production') {
    cookieOptions.push('Secure');
  }

  const responseData = {
    success: true,
    role: user.role,
    name: user.name,
    message: "Login successful"
  };

  console.log("Login successful for:", user.email, "Role:", user.role);
  console.log("Cookie being set:", cookieOptions.join('; '));

  return new Response(
    JSON.stringify(responseData),
    {
      status: 200,
      headers: {
        "Set-Cookie": cookieOptions.join('; '),
        "Content-Type": "application/json",
      },
    }
  );
}
