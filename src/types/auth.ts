/** Extended user type for Better Auth session with role property */
export interface SessionUser {
  id: string
  name: string
  email: string
  image?: string | null
  role: 'ADMIN' | 'CUSTOMER'
}

/** Helper to safely extract user role from Better Auth session */
export function getUserRole(user: Record<string, unknown>): 'ADMIN' | 'CUSTOMER' {
  return (user as SessionUser).role ?? 'CUSTOMER'
}

/** Check if session user has admin role */
export function isAdminUser(user: Record<string, unknown>): boolean {
  return getUserRole(user) === 'ADMIN'
}
