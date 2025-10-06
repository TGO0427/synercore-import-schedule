-- Migration: Add rejection/return workflow fields to shipments table
-- This migration is idempotent and can be run multiple times safely

DO $$
BEGIN
    -- Add rejection_date column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shipments' AND column_name = 'rejection_date'
    ) THEN
        ALTER TABLE shipments ADD COLUMN rejection_date TIMESTAMP;
        RAISE NOTICE 'Added column: rejection_date';
    ELSE
        RAISE NOTICE 'Column rejection_date already exists';
    END IF;

    -- Add rejection_reason column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shipments' AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE shipments ADD COLUMN rejection_reason TEXT;
        RAISE NOTICE 'Added column: rejection_reason';
    ELSE
        RAISE NOTICE 'Column rejection_reason already exists';
    END IF;

    -- Add rejected_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shipments' AND column_name = 'rejected_by'
    ) THEN
        ALTER TABLE shipments ADD COLUMN rejected_by VARCHAR(255);
        RAISE NOTICE 'Added column: rejected_by';
    ELSE
        RAISE NOTICE 'Column rejected_by already exists';
    END IF;
END $$;
