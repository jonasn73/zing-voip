import { AdminSandboxBoard } from "@/components/admin-sandbox-board"
import { getSandboxEnvironment, listSandboxIntakeLogs } from "@/lib/sandbox-engine"

export const dynamic = "force-dynamic"

export default async function AdminSandboxPage() {
  let environment: Awaited<ReturnType<typeof getSandboxEnvironment>> = null
  let intakeLogs: Awaited<ReturnType<typeof listSandboxIntakeLogs>> = []

  try {
    ;[environment, intakeLogs] = await Promise.all([
      getSandboxEnvironment(),
      listSandboxIntakeLogs(30),
    ])
  } catch (e) {
    console.error("[admin/sandbox] page load:", e)
  }

  return <AdminSandboxBoard initialEnvironment={environment} initialIntakeLogs={intakeLogs} />
}
