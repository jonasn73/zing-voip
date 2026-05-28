// Re-export automotive dataset from the canonical certifications data file.

import { certificationsData } from "@/lib/data/certifications"
import type { CertificationModuleData } from "@/lib/types"

export const AUTOMOTIVE_CORE_CODE_IDENTIFIER = "automotive_core"

const automotiveEntry = certificationsData.find(
  (c) => c.certification_code === AUTOMOTIVE_CORE_CODE_IDENTIFIER
)

/** @deprecated Import from `@/lib/data/certifications` instead. */
export const AUTOMOTIVE_CORE_CERTIFICATION_MODULE: CertificationModuleData = automotiveEntry
  ? {
      description: "",
      lessons: [],
      quiz: automotiveEntry.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correctAnswer: q.correct_answer,
      })),
    }
  : { lessons: [], quiz: [] }
