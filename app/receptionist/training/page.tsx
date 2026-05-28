import { redirect } from "next/navigation"
import { ReceptionistTrainingView } from "@/components/receptionist-training-view"
import { getReceptionistPortalContext } from "@/lib/receptionist-portal-auth"
import { getSessionUser } from "@/lib/server-session-user"
import { getTrainingCatalogForUser } from "@/lib/training-engine"

export const dynamic = "force-dynamic"

export default async function ReceptionistTrainingPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login?next=/receptionist/training")

  const ctx = await getReceptionistPortalContext(user.id)
  if (!ctx) redirect("/receptionist")

  const catalog = await getTrainingCatalogForUser(user.id)

  return <ReceptionistTrainingView userId={user.id} initialCatalog={catalog} />
}
