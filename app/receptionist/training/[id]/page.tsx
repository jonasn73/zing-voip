import { notFound, redirect } from "next/navigation"
import { ReceptionistTrainingQuizView } from "@/components/receptionist-training-quiz-view"
import { getPublicCertificationDatasetEntry } from "@/lib/data/certifications"
import { getReceptionistPortalContext } from "@/lib/receptionist-portal-auth"
import { getSessionUser } from "@/lib/server-session-user"
import { getCertificationByCode, listReceptionistBadgesForUser } from "@/lib/db"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ReceptionistTrainingModulePage({ params }: PageProps) {
  const { id } = await params
  const certification = getPublicCertificationDatasetEntry(id)
  if (!certification) notFound()

  const user = await getSessionUser()
  if (!user) redirect(`/login?next=/receptionist/training/${encodeURIComponent(id)}`)

  const ctx = await getReceptionistPortalContext(user.id)
  if (!ctx) redirect("/receptionist")

  const dbCert = await getCertificationByCode(certification.certification_code)
  let alreadyCertified = false
  if (dbCert) {
    const badges = await listReceptionistBadgesForUser(user.id)
    alreadyCertified = badges.some((b) => b.certification_id === dbCert.id && b.status === "certified")
  }

  return (
    <ReceptionistTrainingQuizView
      userId={user.id}
      certification={certification}
      alreadyCertified={alreadyCertified}
    />
  )
}
