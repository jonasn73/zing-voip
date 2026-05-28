import { AdminSandboxBoard } from "@/components/admin-sandbox-board"
import { getSandboxEnvironment, listSandboxIntakeLogs } from "@/lib/sandbox-engine"

export const dynamic = "force-dynamic"

export default async function AdminSandboxPage() {
  const [environment, intakeLogs] = await Promise.all([
    getSandboxEnvironment(),
    listSandboxIntakeLogs(30),
  ])

  return <AdminSandboxBoard initialEnvironment={environment} initialIntakeLogs={intakeLogs} />
}
