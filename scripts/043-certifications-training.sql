-- Receptionist certification & training engine.
-- Run in Neon SQL Editor after 042-skill-routing-pool.sql.

CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code_identifier TEXT NOT NULL UNIQUE,
  module_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certifications_code ON certifications (code_identifier);

COMMENT ON TABLE certifications IS 'Training courses / specialty certifications for platform receptionists.';
COMMENT ON COLUMN certifications.code_identifier IS 'Stable slug appended to receptionist skills on pass (e.g. automotive_core).';
COMMENT ON COLUMN certifications.module_data IS 'JSON: lessons[], quiz[] with correctAnswer keys for grading.';

CREATE TABLE IF NOT EXISTS receptionist_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  certification_id UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'certified')),
  active_toggle BOOLEAN NOT NULL DEFAULT true,
  earned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, certification_id)
);

CREATE INDEX IF NOT EXISTS idx_receptionist_badges_user ON receptionist_badges (user_id);
CREATE INDEX IF NOT EXISTS idx_receptionist_badges_cert ON receptionist_badges (certification_id);
CREATE INDEX IF NOT EXISTS idx_receptionist_badges_active_certified
  ON receptionist_badges (user_id, certification_id)
  WHERE status = 'certified' AND active_toggle = true;

COMMENT ON TABLE receptionist_badges IS 'Per-user certification progress and live routing toggle.';
COMMENT ON COLUMN receptionist_badges.active_toggle IS 'When false, routing pool excludes this specialty even if certified.';

-- Seed starter certifications (safe to re-run — skips existing code_identifiers).
INSERT INTO certifications (name, code_identifier, module_data)
VALUES
  (
    'Automotive Core',
    'automotive_core',
    '{
      "description": "Answer automotive service calls with confidence — scheduling, estimates, and customer care.",
      "lessons": [
        {
          "id": "auto-l1",
          "title": "Greeting & intake",
          "body": "Always confirm the caller''s name, vehicle year/make/model, and the reason for the call. Repeat key details back before transferring or scheduling."
        },
        {
          "id": "auto-l2",
          "title": "Service scheduling",
          "body": "Offer the next two available appointment windows. Note whether the vehicle is drivable or needs a tow. Capture a callback number even if email is on file."
        }
      ],
      "quiz": [
        {
          "id": "auto-q1",
          "question": "What three vehicle details should you capture on every automotive intake call?",
          "options": ["Color, mileage, VIN only", "Year, make, and model", "License plate only"],
          "correctAnswer": "Year, make, and model"
        },
        {
          "id": "auto-q2",
          "question": "Before ending the call, you should always:",
          "options": ["Hang up immediately after booking", "Repeat key details and confirm callback number", "Transfer without a summary"],
          "correctAnswer": "Repeat key details and confirm callback number"
        }
      ]
    }'::jsonb
  ),
  (
    'Medical Front Desk',
    'medical_core',
    '{
      "description": "HIPAA-aware phone etiquette for clinics and medical offices.",
      "lessons": [
        {
          "id": "med-l1",
          "title": "Privacy basics",
          "body": "Never discuss diagnoses or test results on a call unless identity is verified using at least two identifiers (name + DOB). Offer to call back on the number on file when in doubt."
        },
        {
          "id": "med-l2",
          "title": "Urgent vs routine",
          "body": "If a caller describes chest pain, trouble breathing, or severe bleeding, instruct them to hang up and dial emergency services. Document the transfer reason without storing PHI in free-text notes."
        }
      ],
      "quiz": [
        {
          "id": "med-q1",
          "question": "How many identifiers should you use before discussing protected health information?",
          "options": ["One is enough", "At least two", "None if they sound familiar"],
          "correctAnswer": "At least two"
        },
        {
          "id": "med-q2",
          "question": "A caller reports severe chest pain. You should:",
          "options": ["Book a routine follow-up next week", "Tell them to call 911 or go to the ER", "Ask for their insurance card number first"],
          "correctAnswer": "Tell them to call 911 or go to the ER"
        }
      ]
    }'::jsonb
  ),
  (
    'Real Estate Intake',
    'real_estate_core',
    '{
      "description": "Qualify buyers and sellers and route hot leads to the right agent.",
      "lessons": [
        {
          "id": "re-l1",
          "title": "Lead qualification",
          "body": "Capture timeline, budget range, preferred neighborhoods, and whether they are pre-approved. Tag hot leads (moving within 30 days) for priority callback."
        }
      ],
      "quiz": [
        {
          "id": "re-q1",
          "question": "Which detail best indicates a hot buyer lead?",
          "options": ["Browsing casually with no timeline", "Pre-approved and moving within 30 days", "Only wants email listings"],
          "correctAnswer": "Pre-approved and moving within 30 days"
        }
      ]
    }'::jsonb
  ),
  (
    'General Support',
    'general_support_core',
    '{
      "description": "Universal phone support fundamentals for any small business line.",
      "lessons": [
        {
          "id": "gen-l1",
          "title": "Professional tone",
          "body": "Answer within two rings when possible. State the business name, your first name, and ask how you can help. Smile — callers can hear it."
        }
      ],
      "quiz": [
        {
          "id": "gen-q1",
          "question": "The best opening on a business line includes:",
          "options": ["Hello?", "Business name, your name, and an offer to help", "Who is this?"],
          "correctAnswer": "Business name, your name, and an offer to help"
        }
      ]
    }'::jsonb
  )
ON CONFLICT (code_identifier) DO NOTHING;
