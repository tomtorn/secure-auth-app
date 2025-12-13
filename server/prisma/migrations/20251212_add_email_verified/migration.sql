-- Add email_verified column to users table
ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;

-- Create index for filtering by email_verified
CREATE INDEX "users_email_verified_idx" ON "users"("email_verified");

-- One-time cleanup: Delete test user that doesn't exist in Supabase
DELETE FROM "users" WHERE email = 'tomhahomo@gmail.com';
