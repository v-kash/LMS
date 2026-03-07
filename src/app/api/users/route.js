import { db } from "@/lib/db";

export async function GET() {
  const [users] = await db.query(
    `
    SELECT id, name
    FROM users
    WHERE role = 'SALES' AND is_active = 1
    ORDER BY name
    `
  );

  return Response.json({
    success: true,
    users,
  });
}
