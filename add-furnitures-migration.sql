-- Migration to add 'add_furnitures' to the ai_model enum
-- This needs to be run on the Supabase database

-- Add 'add_furnitures' to the ai_model enum
ALTER TYPE ai_model ADD VALUE 'add_furnitures';

-- Update plan rules to include add_furnitures in premium and enterprise plans
UPDATE public.plan_rules 
SET allowed_models = ARRAY['image_enhancement', 'interior_design', 'element_replacement', 'add_furnitures']::ai_model[]
WHERE plan_name = 'premium';

UPDATE public.plan_rules 
SET allowed_models = ARRAY['image_enhancement', 'interior_design', 'element_replacement', 'add_furnitures']::ai_model[]
WHERE plan_name = 'enterprise';

-- Optional: Add to basic plan as well if desired
-- UPDATE public.plan_rules 
-- SET allowed_models = ARRAY['image_enhancement', 'interior_design', 'add_furnitures']::ai_model[]
-- WHERE plan_name = 'basic';
