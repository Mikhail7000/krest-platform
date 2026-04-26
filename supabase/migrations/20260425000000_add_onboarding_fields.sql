-- Migration: Add onboarding and горница fields to profiles
-- Created: 2026-04-25
-- Purpose: Support setup.html onboarding flow for Telegram Mini App

-- Add onboarding fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gornitsa_type TEXT CHECK (gornitsa_type IN ('online', 'offline', NULL));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region TEXT CHECK (region IN ('russia', 'international', NULL));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nastavnik_id UUID REFERENCES profiles(id);

-- Add blocks_unlocked if not exists (should already exist from CLAUDE.md spec)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blocks_unlocked INTEGER DEFAULT 1 CHECK (blocks_unlocked >= 1 AND blocks_unlocked <= 6);

-- Add admin_approved to student_progress if not exists
ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT FALSE;

-- Create index for nastavnik lookups
CREATE INDEX IF NOT EXISTS idx_profiles_nastavnik ON profiles(nastavnik_id);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city) WHERE gornitsa_type = 'offline';
