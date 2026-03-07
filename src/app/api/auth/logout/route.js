// /api/auth/logout/route.js
export async function POST() {
  return new Response(
    JSON.stringify({ 
      success: true, 
      message: "Logged out successfully" 
    }),
    {
      headers: {
        "Set-Cookie": [
          "token=; HttpOnly; Path=/; Max-Age=0",
          "__Secure-next-auth.session-token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
        ].join(', '),
        "Content-Type": "application/json",
      },
    }
  );
}