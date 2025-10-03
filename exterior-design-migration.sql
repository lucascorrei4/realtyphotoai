-- Exterior Design Migration Script
-- Run this in your Supabase SQL editor to add exterior_design support to existing databases

-- Add 'exterior_design' to the ai_model enum type
ALTER TYPE ai_model ADD VALUE 'exterior_design';

-- Update plan_rules to include 'exterior_design' for relevant plans (premium, enterprise)
UPDATE public.plan_rules
SET allowed_models = array_append(allowed_models, 'exterior_design'::ai_model)
WHERE plan_name IN ('premium', 'enterprise')
  AND NOT ('exterior_design'::ai_model = ANY(allowed_models));

-- Verify the changes
SELECT plan_name, allowed_models 
FROM public.plan_rules 
WHERE 'exterior_design'::ai_model = ANY(allowed_models);
