import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: Object.fromEntries((await headers()).entries()),
  })

  if (session) {
    redirect("/dashboard")
  } else {
    redirect("/auth/sign-in")
  }
}