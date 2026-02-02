import { betterFetch } from "@better-fetch/fetch"

const protectedRoutes = ["/dashboard", "/sites", "/admin"]
const adminRoutes = ["/admin"]
const authRoutes = ["/auth"]

export async function proxy(request: Request) {
  const url = new URL(request.url)
  
  // Don't protect auth routes
  if (authRoutes.some(route => url.pathname.startsWith(route))) {
    return
  }
  
  // Don't protect public routes
  if (url.pathname === "/" || url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/_next")) {
    return
  }
  
  // Check if route needs protection
  const needsAuth = protectedRoutes.some(route => url.pathname.startsWith(route))
  const needsAdmin = adminRoutes.some(route => url.pathname.startsWith(route))
  
  if (!needsAuth && !needsAdmin) {
    return
  }
  
  // Verify session
  try {
    const { data: session } = await betterFetch("/api/auth/get-session", {
      baseURL: url.origin,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    })
    
    if (!session) {
      return Response.redirect(new URL("/auth/sign-in", url.origin))
    }
    
    // Check admin access
    if (needsAdmin && session.user.role !== "ADMIN") {
      return Response.redirect(new URL("/dashboard", url.origin))
    }
    
    // If user has no active organization, redirect to organization setup
    if (needsAuth && !session.session.activeOrganizationId && url.pathname !== "/dashboard/setup") {
      return Response.redirect(new URL("/dashboard/setup", url.origin))
    }
    
  } catch (error) {
    console.error("Auth error in proxy:", error)
    return Response.redirect(new URL("/auth/sign-in", url.origin))
  }
}