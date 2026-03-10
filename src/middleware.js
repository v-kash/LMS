// middleware.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// This config tells Next.js to use Node.js runtime
export const config = {
  runtime: "nodejs",
  matcher: ["/dashboard/:path*", "/login"],
};

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;

  console.log("=== MIDDLEWARE DEBUG ===");
  console.log("Path:", pathname);
  console.log("Has token:", !!token);

  // Public routes
  if (pathname === "/login") {
    console.log("Login page - checking if already logged in");
    if (token) {
      try {
        const user = jwt.verify(token, JWT_SECRET);
        console.log("Already logged in as:", user.role);

        // Redirect to appropriate dashboard if already logged in
        // const redirectPath =
        //   user.role === "MANAGER" ? "/dashboard/manager" : "/dashboard/sales";
        const redirectPath =
          user.role === "ADMIN"
            ? "/dashboard/admin"
            : user.role === "MANAGER"
              ? "/dashboard/manager"
              : user.role === "REPORTER"
                ? "/dashboard/export"
                : "/dashboard/sales";
        return NextResponse.redirect(new URL(redirectPath, request.url));
      } catch (error) {
        console.log("Invalid token, staying on login page");
        return NextResponse.next();
      }
    }
    return NextResponse.next();
  }

  // API auth routes - always allow
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      console.log("No token found, redirecting to login");
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const user = jwt.verify(token, JWT_SECRET);
      console.log("User verified:", user);

      // If accessing generic /dashboard, redirect to role-specific
      // if (pathname === "/dashboard") {
      //   console.log("Generic dashboard access");
      //   const redirectPath =
      //     user.role === "MANAGER" ? "/dashboard/manager" : "/dashboard/sales";
      //   return NextResponse.redirect(new URL(redirectPath, request.url));
      // }

      if (pathname === "/dashboard") {
        console.log("Generic dashboard access");
        const redirectPath =
          user.role === "ADMIN"
            ? "/dashboard/admin"
            : user.role === "MANAGER"
              ? "/dashboard/manager"
              : user.role === "REPORTER"
                ? "/dashboard/export"
                : "/dashboard/sales";
        return NextResponse.redirect(new URL(redirectPath, request.url));
      }

      //Check role-based access
      if (pathname === "/dashboard/manager" && user.role !== "MANAGER") {
        console.log("Unauthorized access to manager dashboard");
        return NextResponse.redirect(new URL("/dashboard/sales", request.url));
      }

      // After the manager check, add:
      if (pathname === "/dashboard/sales" && user.role === "REPORTER") {
        return NextResponse.redirect(new URL("/dashboard/export", request.url));
      }

      console.log("Access granted to:", pathname);
      return NextResponse.next();
    } catch (error) {
      console.error("JWT verification failed:", error.message);
      // Clear invalid token and redirect to login
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      return response;
    }
  }

  return NextResponse.next();
}
