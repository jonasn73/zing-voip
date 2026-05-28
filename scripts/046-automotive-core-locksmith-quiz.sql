-- Upsert automotive_core certification with locksmith qualification matrix.
-- Run in Neon SQL Editor after 043-certifications-training.sql (requires certifications table).

UPDATE certifications
SET
  name = 'Automotive Core',
  module_data = '{
    "description": "Core automotive locksmith intake — All Keys Lost (AKL), proximity verification, year/make/model validation, and structural key handling.",
    "lessons": [
      {
        "id": "auto-l1-akl",
        "title": "All Keys Lost (AKL) definitions",
        "body": "AKL means the customer has no working key — lost, stolen, or broken beyond use. Treat AKL as higher priority: confirm vehicle location, ownership indicators, and that no key is inside the vehicle before quoting mobile service."
      },
      {
        "id": "auto-l2-proximity",
        "title": "Proximity verification",
        "body": "Before dispatching, verify the caller is with the vehicle or can meet the technician at the exact location. Ask for cross streets, parking level, or a landmark. Never dispatch on a vague ''somewhere in town'' address."
      },
      {
        "id": "auto-l3-ymm",
        "title": "Year / Make / Model validation",
        "body": "Capture year, make, and model on every automotive call — repeat them back. If the caller is unsure, ask for VIN (last 8 is fine) or a photo via text after the call. Wrong YMM causes wrong keys, blades, and programming tools."
      },
      {
        "id": "auto-l4-structural",
        "title": "Structural key component handling",
        "body": "Do not promise a finished key until you know the key type: mechanical blade, transponder/chip, remote head, smart/proximity fob, or push-to-start. Note if the ignition is damaged or a broken fragment is stuck — that may require extraction before a new key can be made."
      }
    ],
    "quiz": [
      {
        "id": "auto-q-akl",
        "question": "What does AKL (All Keys Lost) mean on an automotive locksmith call?",
        "options": [
          "Customer has a spare key at home",
          "Customer has no working key for the vehicle",
          "Only the remote fob is missing but a metal key still works"
        ],
        "correctAnswer": "Customer has no working key for the vehicle"
      },
      {
        "id": "auto-q-proximity",
        "question": "Before dispatching mobile service, you should:",
        "options": [
          "Send a tech to the billing address on file only",
          "Verify the caller is at the vehicle location or can meet the tech there",
          "Dispatch immediately without confirming location"
        ],
        "correctAnswer": "Verify the caller is at the vehicle location or can meet the tech there"
      },
      {
        "id": "auto-q-ymm",
        "question": "Which vehicle details are required on every automotive intake call?",
        "options": ["License plate color only", "Year, make, and model", "VIN only — never ask for make"],
        "correctAnswer": "Year, make, and model"
      },
      {
        "id": "auto-q-structural",
        "question": "When handling structural key components, you should:",
        "options": [
          "Promise any key can be cut in five minutes without asking key type",
          "Identify key type (blade, chip, remote, smart key) and note ignition or broken-key issues before quoting",
          "Skip key type if the customer sounds in a hurry"
        ],
        "correctAnswer": "Identify key type (blade, chip, remote, smart key) and note ignition or broken-key issues before quoting"
      }
    ]
  }'::jsonb
WHERE code_identifier = 'automotive_core';

INSERT INTO certifications (name, code_identifier, module_data)
SELECT
  'Automotive Core',
  'automotive_core',
  '{
    "description": "Core automotive locksmith intake — All Keys Lost (AKL), proximity verification, year/make/model validation, and structural key handling.",
    "lessons": [
      {
        "id": "auto-l1-akl",
        "title": "All Keys Lost (AKL) definitions",
        "body": "AKL means the customer has no working key — lost, stolen, or broken beyond use. Treat AKL as higher priority: confirm vehicle location, ownership indicators, and that no key is inside the vehicle before quoting mobile service."
      },
      {
        "id": "auto-l2-proximity",
        "title": "Proximity verification",
        "body": "Before dispatching, verify the caller is with the vehicle or can meet the technician at the exact location. Ask for cross streets, parking level, or a landmark. Never dispatch on a vague ''somewhere in town'' address."
      },
      {
        "id": "auto-l3-ymm",
        "title": "Year / Make / Model validation",
        "body": "Capture year, make, and model on every automotive call — repeat them back. If the caller is unsure, ask for VIN (last 8 is fine) or a photo via text after the call. Wrong YMM causes wrong keys, blades, and programming tools."
      },
      {
        "id": "auto-l4-structural",
        "title": "Structural key component handling",
        "body": "Do not promise a finished key until you know the key type: mechanical blade, transponder/chip, remote head, smart/proximity fob, or push-to-start. Note if the ignition is damaged or a broken fragment is stuck — that may require extraction before a new key can be made."
      }
    ],
    "quiz": [
      {
        "id": "auto-q-akl",
        "question": "What does AKL (All Keys Lost) mean on an automotive locksmith call?",
        "options": [
          "Customer has a spare key at home",
          "Customer has no working key for the vehicle",
          "Only the remote fob is missing but a metal key still works"
        ],
        "correctAnswer": "Customer has no working key for the vehicle"
      },
      {
        "id": "auto-q-proximity",
        "question": "Before dispatching mobile service, you should:",
        "options": [
          "Send a tech to the billing address on file only",
          "Verify the caller is at the vehicle location or can meet the tech there",
          "Dispatch immediately without confirming location"
        ],
        "correctAnswer": "Verify the caller is at the vehicle location or can meet the tech there"
      },
      {
        "id": "auto-q-ymm",
        "question": "Which vehicle details are required on every automotive intake call?",
        "options": ["License plate color only", "Year, make, and model", "VIN only — never ask for make"],
        "correctAnswer": "Year, make, and model"
      },
      {
        "id": "auto-q-structural",
        "question": "When handling structural key components, you should:",
        "options": [
          "Promise any key can be cut in five minutes without asking key type",
          "Identify key type (blade, chip, remote, smart key) and note ignition or broken-key issues before quoting",
          "Skip key type if the customer sounds in a hurry"
        ],
        "correctAnswer": "Identify key type (blade, chip, remote, smart key) and note ignition or broken-key issues before quoting"
      }
    ]
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM certifications WHERE code_identifier = 'automotive_core'
);
