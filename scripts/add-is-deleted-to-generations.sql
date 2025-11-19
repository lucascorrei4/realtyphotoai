-- Add is_deleted column to generations table for soft delete functionality
-- This allows hiding generations from lists without physically deleting them

ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL;

-- Add index for faster queries filtering out deleted items
CREATE INDEX IF NOT EXISTS idx_generations_is_deleted ON generations(is_deleted) WHERE is_deleted = FALSE;

-- Add index for faster queries filtering by user and non-deleted
CREATE INDEX IF NOT EXISTS idx_generations_user_not_deleted ON generations(user_id, is_deleted) WHERE is_deleted = FALSE;

-- Comment on column
COMMENT ON COLUMN generations.is_deleted IS 'Soft delete flag - when true, generation is hidden from lists but not physically deleted';

