-- Supabase Setup Script for RealVisionAI Admin Integration
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE subscription_plan AS ENUM ('free', 'basic', 'premium', 'enterprise');
CREATE TYPE generation_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE ai_model AS ENUM ('interior_design', 'image_enhancement', 'element_replacement', 'add_furnitures', 'exterior_design');

-- Users table (extends Supabase auth.users)
-- Note: The id field will store the UUID from auth.users when users are created
-- The foreign key relationship is handled through application logic for better Supabase compatibility
CREATE TABLE public.user_profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    role user_role DEFAULT 'user',
    subscription_plan subscription_plan DEFAULT 'free',
    monthly_generations_limit INTEGER DEFAULT 10,
    total_generations INTEGER DEFAULT 0,
    successful_generations INTEGER DEFAULT 0,
    failed_generations INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin settings table for controlling system-wide rules
CREATE TABLE public.admin_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan rules table for subscription-based limits
CREATE TABLE public.plan_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    plan_name subscription_plan NOT NULL,
    monthly_generations_limit INTEGER NOT NULL,
    concurrent_generations INTEGER DEFAULT 1,
    allowed_models ai_model[] NOT NULL,
    price_per_month DECIMAL(10,2) DEFAULT 0,
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generation history table
CREATE TABLE public.generations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    model_type ai_model NOT NULL,
    input_image_url TEXT,
    output_image_url TEXT,
    prompt TEXT,
    status generation_status DEFAULT 'pending',
    metadata JSONB,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User sessions table for tracking active sessions
CREATE TABLE public.user_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default admin settings
INSERT INTO public.admin_settings (setting_key, setting_value, description) VALUES
('default_free_plan_limit', '{"monthly_generations": 10, "concurrent_generations": 1}', 'Default limits for free plan'),
('default_basic_plan_limit', '{"monthly_generations": 100, "concurrent_generations": 2}', 'Default limits for basic plan'),
('default_premium_plan_limit', '{"monthly_generations": 500, "concurrent_generations": 5}', 'Default limits for premium plan'),
('default_enterprise_plan_limit', '{"monthly_generations": 2000, "concurrent_generations": 10}', 'Default limits for enterprise plan'),
('system_maintenance_mode', '{"enabled": false, "message": ""}', 'System maintenance mode settings'),
('rate_limiting', '{"requests_per_minute": 60, "burst_limit": 100}', 'Rate limiting configuration');

-- Insert default plan rules
INSERT INTO public.plan_rules (plan_name, monthly_generations_limit, concurrent_generations, allowed_models, price_per_month, features) VALUES
('free', 10, 1, ARRAY['image_enhancement']::ai_model[], 0, '{"basic_enhancement": true, "watermark": true}'),
('basic', 100, 2, ARRAY['image_enhancement', 'interior_design']::ai_model[], 19.99, '{"basic_enhancement": true, "interior_design": true, "watermark": false}'),
('premium', 500, 5, ARRAY['image_enhancement', 'interior_design', 'element_replacement', 'add_furnitures', 'exterior_design']::ai_model[], 49.99, '{"all_models": true, "priority_processing": true, "api_access": true}'),
('enterprise', 2000, 10, ARRAY['image_enhancement', 'interior_design', 'element_replacement', 'add_furnitures', 'exterior_design']::ai_model[], 199.99, '{"all_models": true, "priority_processing": true, "api_access": true, "dedicated_support": true}');

-- Create indexes for better performance
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_status ON public.generations(status);
CREATE INDEX idx_generations_created_at ON public.generations(created_at);
CREATE INDEX idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON public.user_sessions(expires_at);

-- Create function to update user generation counts
CREATE OR REPLACE FUNCTION update_user_generation_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment total generations
        UPDATE public.user_profiles 
        SET total_generations = total_generations + 1
        WHERE id = NEW.user_id;
        
        -- Update successful/failed counts based on status
        IF NEW.status = 'completed' THEN
            UPDATE public.user_profiles 
            SET successful_generations = successful_generations + 1
            WHERE id = NEW.user_id;
        ELSIF NEW.status = 'failed' THEN
            UPDATE public.user_profiles 
            SET failed_generations = failed_generations + 1
            WHERE id = NEW.user_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle status changes
        IF OLD.status != NEW.status THEN
            IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
                UPDATE public.user_profiles 
                SET successful_generations = successful_generations - 1
                WHERE id = NEW.user_id;
            ELSIF OLD.status != 'completed' AND NEW.status = 'completed' THEN
                UPDATE public.user_profiles 
                SET successful_generations = successful_generations + 1
                WHERE id = NEW.user_id;
            ELSIF OLD.status = 'failed' AND NEW.status != 'failed' THEN
                UPDATE public.user_profiles 
                SET failed_generations = failed_generations - 1
                WHERE id = NEW.user_id;
            ELSIF OLD.status != 'failed' AND NEW.status = 'failed' THEN
                UPDATE public.user_profiles 
                SET failed_generations = failed_generations + 1
                WHERE id = NEW.user_id;
            END IF;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for generation counts
CREATE TRIGGER trigger_update_generation_counts
    AFTER INSERT OR UPDATE ON public.generations
    FOR EACH ROW
    EXECUTE FUNCTION update_user_generation_counts();

-- Create function to check user generation limits
CREATE OR REPLACE FUNCTION check_user_generation_limit(user_uuid TEXT, model_type ai_model)
RETURNS BOOLEAN AS $$
DECLARE
    user_plan subscription_plan;
    monthly_limit INTEGER;
    current_month_generations INTEGER;
    plan_rules_record RECORD;
BEGIN
    -- Get user's plan and monthly limit
    SELECT subscription_plan, monthly_generations_limit 
    INTO user_plan, monthly_limit
    FROM public.user_profiles 
    WHERE id = user_uuid;
    
    -- Check if model is allowed for user's plan
    SELECT * INTO plan_rules_record
    FROM public.plan_rules 
    WHERE plan_name = user_plan AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    IF NOT (model_type = ANY(plan_rules_record.allowed_models)) THEN
        RETURN FALSE;
    END IF;
    
    -- Count generations for current month
    SELECT COUNT(*) INTO current_month_generations
    FROM public.generations 
    WHERE user_id = user_uuid 
    AND created_at >= date_trunc('month', CURRENT_DATE);
    
    RETURN current_month_generations < monthly_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user statistics
CREATE OR REPLACE FUNCTION get_user_statistics(user_uuid TEXT)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_generations', up.total_generations,
        'successful_generations', up.successful_generations,
        'failed_generations', up.failed_generations,
        'success_rate', CASE 
            WHEN up.total_generations > 0 
            THEN ROUND((up.successful_generations::DECIMAL / up.total_generations * 100)::NUMERIC, 2)
            ELSE 0 
        END,
        'monthly_usage', (
            SELECT COUNT(*) 
            FROM public.generations 
            WHERE user_id = user_uuid 
            AND created_at >= date_trunc('month', CURRENT_DATE)
        ),
        'monthly_limit', up.monthly_generations_limit,
        'model_breakdown', (
            SELECT json_object_agg(model_type, count)
            FROM (
                SELECT model_type, COUNT(*) as count
                FROM public.generations 
                WHERE user_id = user_uuid 
                GROUP BY model_type
            ) model_counts
        )
    ) INTO result
    FROM public.user_profiles up
    WHERE up.id = user_uuid;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to create user profile (bypasses RLS for initial creation)
CREATE OR REPLACE FUNCTION create_user_profile(
    user_id TEXT,
    user_email TEXT,
    user_role user_role DEFAULT 'user',
    user_plan subscription_plan DEFAULT 'free'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_profiles (
        id,
        email,
        role,
        subscription_plan,
        monthly_generations_limit,
        total_generations,
        successful_generations,
        failed_generations,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        user_id,
        user_email,
        user_role,
        user_plan,
        CASE 
            WHEN user_plan = 'free' THEN 10
            WHEN user_plan = 'basic' THEN 50
            WHEN user_plan = 'premium' THEN 200
            WHEN user_plan = 'enterprise' THEN 1000
            ELSE 10
        END,
        0,
        0,
        0,
        true,
        NOW(),
        NOW()
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_user_profile(TEXT, TEXT, user_role, subscription_plan) TO authenticated;

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid()::text = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Generations policies
CREATE POLICY "Users can view own generations" ON generations
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own generations" ON generations
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own generations" ON generations
    FOR UPDATE USING (auth.uid()::text = user_id);

-- Admin settings policies (admin only)
CREATE POLICY "Admins can manage admin settings" ON admin_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid()::text 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Plan rules policies (admin only)
CREATE POLICY "Admins can manage plan rules" ON plan_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid()::text 
            AND role IN ('admin', 'super_admin')
        )
    );

-- User sessions policies
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own sessions" ON user_sessions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own sessions" ON user_sessions
    FOR UPDATE USING (auth.uid()::text = user_id);

-- Allow public access to plan_rules for reading (so users can see available plans)
CREATE POLICY "Public can view plan rules" ON plan_rules
    FOR SELECT USING (true);

-- Create a super admin user (you'll need to replace with actual user ID)
-- This should be run after you create your first user in Supabase Auth
-- INSERT INTO public.user_profiles (id, email, name, role) 
-- VALUES ('YOUR_USER_ID_HERE', 'your-email@example.com', 'Super Admin', 'super_admin');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.generations TO authenticated;
GRANT ALL ON public.user_sessions TO authenticated;
GRANT SELECT ON public.plan_rules TO authenticated;
GRANT SELECT ON public.admin_settings TO authenticated;

-- IMPORTANT NOTES FOR SETUP:
-- 1. After running this script, you may need to enable RLS policies manually in Supabase dashboard
-- 2. The RLS policies use auth.uid() which requires proper Supabase Auth setup
-- 3. To create your first super admin user:
--    a) First create a user through Supabase Auth (signup)
--    b) Get the user's UUID from auth.users table
--    c) Insert into user_profiles with role = 'super_admin'
--    d) Example: UPDATE public.user_profiles SET role = 'super_admin' WHERE email = 'your-email@example.com';
-- 4. If you encounter RLS policy issues, you can temporarily disable RLS:
--    ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
--    (Remember to re-enable after proper setup)
