-- Industry chosen at signup — drives default AI fallback script (can be overridden in Settings).
ALTER TABLE users ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT 'generic';
