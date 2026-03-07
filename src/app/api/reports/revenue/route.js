import { db } from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const source = searchParams.get("source");
    const salespersonId = searchParams.get("salesperson_id");
    const page = parseInt(searchParams.get("page")) || 1;
const limit = parseInt(searchParams.get("limit")) || 10;
const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

   if (from && to) {
  conditions.push(
    "r.converted_at >= ? AND r.converted_at < DATE_ADD(?, INTERVAL 1 DAY)"
  );
  params.push(from, to);
}


    if (source) {
      conditions.push("l.source = ?");
      params.push(source);
    }

    if (salespersonId) {
      conditions.push("r.salesperson_id = ?");
      params.push(salespersonId);
    }

    const whereClause =
      conditions.length > 0
        ? "WHERE " + conditions.join(" AND ")
        : "";

    // 1️⃣ Total Revenue
    const [[totalRow]] = await db.query(
      `
      SELECT COALESCE(SUM(r.amount), 0) AS total
      FROM revenue r
      JOIN leads l ON l.id = r.lead_id
      ${whereClause}
      `,
      params
    );

    const [[countRow]] = await db.query(
  `
  SELECT COUNT(*) AS total
  FROM revenue r
  JOIN leads l ON l.id = r.lead_id
  ${whereClause}
  `,
  params
);


    // 2️⃣ Revenue by Source
    const [bySource] = await db.query(
      `
      SELECT
        l.source,
        COUNT(r.id) AS conversions,
        COALESCE(SUM(r.amount), 0) AS revenue
      FROM revenue r
      JOIN leads l ON l.id = r.lead_id
      ${whereClause}
      GROUP BY l.source
      ORDER BY revenue DESC
      `,
      params
    );

    // 3️⃣ Revenue by Salesperson
    const [bySalesperson] = await db.query(
      `
      SELECT
        u.name AS salesperson,
        COUNT(r.id) AS deals,
        COALESCE(SUM(r.amount), 0) AS revenue
      FROM revenue r
      JOIN users u ON u.id = r.salesperson_id
      JOIN leads l ON l.id = r.lead_id
      ${whereClause}
      GROUP BY r.salesperson_id
      ORDER BY revenue DESC
      `,
      params
    );

    // 4️⃣ Monthly Trend
    const [monthly] = await db.query(
      `
      SELECT
        DATE_FORMAT(r.converted_at, '%Y-%m') AS month,
        COALESCE(SUM(r.amount), 0) AS revenue
      FROM revenue r
      JOIN leads l ON l.id = r.lead_id
      ${whereClause}
      GROUP BY month
      ORDER BY month
      `,
      params
    );

    // 5️⃣ Revenue Transactions (ONE TABLE SOURCE)
const [transactions] = await db.query(
  `
  SELECT
    r.id,
    r.amount,
    r.product,
    r.converted_at,
    l.name AS lead_name,
    l.source,
    u.name AS salesperson
  FROM revenue r
  JOIN leads l ON l.id = r.lead_id
  JOIN users u ON u.id = r.salesperson_id
  ${whereClause}
  ORDER BY r.converted_at DESC
  LIMIT ? OFFSET ?
  `,
  [...params, limit, offset]
);



    return Response.json({
  success: true,
  totalRevenue: totalRow.total,
  bySource,
  bySalesperson,
  monthly,
  transactions,
  pagination: {
    total: countRow.total,
    page,
    totalPages: Math.ceil(countRow.total / limit),
  },
});

  } catch (err) {
    console.error("Revenue report error:", err);
    return Response.json(
      { success: false, message: "Failed to generate revenue report" },
      { status: 500 }
    );
  }
}
