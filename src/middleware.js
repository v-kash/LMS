// // middleware.js
// import { NextResponse } from "next/server";
// import jwt from "jsonwebtoken";

// const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// // This config tells Next.js to use Node.js runtime
// export const config = {
//   runtime: "nodejs",
//   matcher: ["/", "/dashboard/:path*", "/login"],
// };

// export function middleware(request) {
//   const { pathname } = request.nextUrl;
//   const token = request.cookies.get("token")?.value;

//   console.log("=== MIDDLEWARE DEBUG ===");
//   console.log("Path:", pathname);
//   console.log("Has token:", !!token);

//   // Public routes
//   // Handle root route
//   if (pathname === "/") {
//     if (!token) {
//       console.log("Root accessed without login → redirect to login");
//       return NextResponse.redirect(new URL("/login", request.url));
//     }

//     try {
//       const user = jwt.verify(token, JWT_SECRET);

//       const redirectPath =
//         user.role === "ADMIN"
//           ? "/dashboard/admin"
//           : user.role === "MANAGER"
//             ? "/dashboard/manager"
//             : user.role === "REPORTER"
//               ? "/dashboard/export"
//               : "/dashboard/sales";

//       console.log("Root redirecting to:", redirectPath);

//       return NextResponse.redirect(new URL(redirectPath, request.url));
//     } catch (error) {
//       console.log("Invalid token at root → login");
//       const response = NextResponse.redirect(new URL("/login", request.url));
//       response.cookies.delete("token");
//       return response;
//     }
//   }

//   // API auth routes - always allow
//   if (pathname.startsWith("/api/auth")) {
//     return NextResponse.next();
//   }

//   // Protect dashboard routes
//   if (pathname.startsWith("/dashboard")) {
//     if (!token) {
//       console.log("No token found, redirecting to login");
//       return NextResponse.redirect(new URL("/login", request.url));
//     }

//     try {
//       const user = jwt.verify(token, JWT_SECRET);
//       console.log("User verified:", user);

//       // If accessing generic /dashboard, redirect to role-specific
//       // if (pathname === "/dashboard") {
//       //   console.log("Generic dashboard access");
//       //   const redirectPath =
//       //     user.role === "MANAGER" ? "/dashboard/manager" : "/dashboard/sales";
//       //   return NextResponse.redirect(new URL(redirectPath, request.url));
//       // }

//       if (pathname === "/dashboard") {
//         console.log("Generic dashboard access");
//         const redirectPath =
//           user.role === "ADMIN"
//             ? "/dashboard/admin"
//             : user.role === "MANAGER"
//               ? "/dashboard/manager"
//               : user.role === "REPORTER"
//                 ? "/dashboard/export"
//                 : "/dashboard/sales";
//         return NextResponse.redirect(new URL(redirectPath, request.url));
//       }

//       //Check role-based access
//       if (pathname === "/dashboard/manager" && user.role !== "MANAGER") {
//         console.log("Unauthorized access to manager dashboard");
//         return NextResponse.redirect(new URL("/dashboard/sales", request.url));
//       }

//       // After the manager check, add:
//       if (pathname === "/dashboard/sales" && user.role === "REPORTER") {
//         return NextResponse.redirect(new URL("/dashboard/export", request.url));
//       }

//       if (pathname.startsWith("/dashboard/admin") && user.role !== "ADMIN") {
//         return NextResponse.redirect(
//           new URL(getDashboardByRole(user.role), request.url),
//         );
//       }

//       console.log("Access granted to:", pathname);
//       return NextResponse.next();
//     } catch (error) {
//       console.error("JWT verification failed:", error.message);
//       // Clear invalid token and redirect to login
//       const response = NextResponse.redirect(new URL("/login", request.url));
//       response.cookies.delete("token");
//       return response;
//     }
//   }

//   return NextResponse.next();
// }


// middleware.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export const config = {
  runtime: "nodejs",
  matcher: ["/", "/dashboard/:path*", "/login"],
};

// Role → Dashboard mapping
function getDashboardByRole(role) {
  if (role === "SUPER_ADMIN") return "/dashboard/superadmin";
  if (role === "ADMIN") return "/dashboard/admin";
  if (role === "MANAGER") return "/dashboard/manager";
  if (role === "REPORTER") return "/dashboard/export";
  return "/dashboard/sales";
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;

  console.log("=== MIDDLEWARE DEBUG ===");
  console.log("Path:", pathname);
  console.log("Has token:", !!token);

  // Allow auth APIs
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Handle root route
  if (pathname === "/") {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const user = jwt.verify(token, JWT_SECRET);
      const redirectPath = getDashboardByRole(user.role);
      return NextResponse.redirect(new URL(redirectPath, request.url));
    } catch (error) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      return response;
    }
  }

  // Handle login page
  if (pathname === "/login") {
    if (!token) return NextResponse.next();

    try {
      const user = jwt.verify(token, JWT_SECRET);
      const redirectPath = getDashboardByRole(user.role);
      return NextResponse.redirect(new URL(redirectPath, request.url));
    } catch {
      return NextResponse.next();
    }
  }

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const user = jwt.verify(token, JWT_SECRET);
      console.log("User verified:", user);

      const allowedDashboard = getDashboardByRole(user.role);

      // If visiting generic dashboard
      if (pathname === "/dashboard") {
        return NextResponse.redirect(new URL(allowedDashboard, request.url));
      }

      // Prevent access to other dashboards
      if (!pathname.startsWith(allowedDashboard)) {
        console.log("Unauthorized dashboard access");
        return NextResponse.redirect(new URL(allowedDashboard, request.url));
      }

      console.log("Access granted to:", pathname);
      return NextResponse.next();

    } catch (error) {
      console.error("JWT verification failed:", error.message);
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      return response;
    }
  }

  return NextResponse.next();
}