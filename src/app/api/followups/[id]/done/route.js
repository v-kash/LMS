import { db } from "@/lib/db";

export async function POST(request, context) {
  const { id } = await context.params;

  await db.query(
    `
    UPDATE followups
    SET status = 'DONE'
    WHERE id = ?
    `,
    [id]
  );

  return Response.json({
    success: true,
    message: "Follow-up completed",
  });
}
