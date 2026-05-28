import { describe, expect, it } from "vitest"
import {
  certificationsData,
  getCertificationDatasetEntry,
  getPublicCertificationDatasetEntry,
  gradeCertificationAnswers,
} from "@/lib/data/certifications"
import { gradeQuizLocally } from "@/lib/training-engine"

describe("certificationsData", () => {
  it("includes automotive locksmith intake certification with M607 topic", () => {
    const entry = getCertificationDatasetEntry("automotive_core")
    expect(entry?.title).toBe("Automotive & Locksmithing Intake Certification")
    expect(entry?.passing_score).toBe(100)
    expect(entry?.questions.map((q) => q.id)).toEqual(["q1", "q2", "q3", "q4"])
    expect(entry?.questions.some((q) => q.question.includes("M607"))).toBe(true)
  })

  it("strips correct answers from public dataset", () => {
    const pub = getPublicCertificationDatasetEntry("automotive_core")
    expect(pub).not.toBeNull()
    for (const q of pub!.questions) {
      expect("correct_answer" in q).toBe(false)
    }
  })

  it("grades against passing_score threshold", () => {
    const entry = certificationsData[0]
    const allCorrect = Object.fromEntries(entry.questions.map((q) => [q.id, q.correct_answer]))
    expect(gradeCertificationAnswers(entry, allCorrect).passed).toBe(true)

    const partial = { ...allCorrect, q1: "wrong" }
    expect(gradeCertificationAnswers(entry, partial).passed).toBe(false)
  })
})

describe("gradeQuizLocally", () => {
  it("wraps gradeCertificationAnswers for tests", () => {
    const entry = certificationsData[0]
    const answers = Object.fromEntries(entry.questions.map((q) => [q.id, q.correct_answer]))
    const result = gradeQuizLocally(entry, answers)
    expect(result.passed).toBe(true)
    expect(result.correct).toBe(entry.questions.length)
  })
})
