import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export default function DashboardIndex() {
  const token = cookies().get("token")?.value;
  if (!token) redirect("/login");

  const user = jwt.verify(token, JWT_SECRET);

  if (user.role === "MANAGER") {
    redirect("/dashboard/manager");
  }

  redirect("/dashboard/sales");
}
