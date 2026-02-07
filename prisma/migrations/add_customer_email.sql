-- Migration: Add email column to customers table if it doesn't exist
-- This ensures the email column exists even if db push was used instead of migrations

DO $$ 
BEGIN
    -- Add email column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'customers' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE customers ADD COLUMN email TEXT;
        RAISE NOTICE 'Added email column to customers table';
    ELSE
        RAISE NOTICE 'Email column already exists in customers table';
    END IF;
END $$;

-- Verify the column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'customers' 
AND column_name IN ('name', 'phone', 'email', 'dob', 'allergies', 'notes', 'tenant_id')
ORDER BY ordinal_position;


