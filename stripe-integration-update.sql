-- Stripe Integration Update Script for RealVisionAI
-- Run this in your Supabase SQL editor to add Stripe support

-- Add Stripe-related columns to plan_rules table
ALTER TABLE public.plan_rules 
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_metadata JSONB DEFAULT '{}';

-- Create index for Stripe product lookups
CREATE INDEX IF NOT EXISTS idx_plan_rules_stripe_product ON public.plan_rules(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_plan_rules_stripe_price ON public.plan_rules(stripe_price_id);

-- Add Stripe customer ID to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create index for Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer ON public.user_profiles(stripe_customer_id);

-- Create subscriptions table for tracking Stripe subscriptions
CREATE TABLE IF NOT EXISTS public.stripe_subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT NOT NULL,
    stripe_price_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for subscriptions table
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_user_id ON public.stripe_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_stripe_id ON public.stripe_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_status ON public.stripe_subscriptions(status);

-- Create webhook events table for tracking Stripe webhooks
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for webhook events
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON public.stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON public.stripe_webhook_events(processed);

-- Create function to update subscription status
CREATE OR REPLACE FUNCTION update_subscription_status(
    subscription_id TEXT,
    new_status TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.stripe_subscriptions 
    SET 
        status = new_status,
        current_period_start = period_start,
        current_period_end = period_end,
        updated_at = NOW()
    WHERE stripe_subscription_id = subscription_id;
    
    -- Update user plan if subscription is active
    IF new_status = 'active' THEN
        UPDATE public.user_profiles 
        SET 
            subscription_plan = (
                SELECT plan_name 
                FROM public.stripe_subscriptions 
                WHERE stripe_subscription_id = subscription_id
            ),
            updated_at = NOW()
        WHERE id = (
            SELECT user_id 
            FROM public.stripe_subscriptions 
            WHERE stripe_subscription_id = subscription_id
        );
    END IF;
END;
$$;

-- Create function to handle subscription creation
CREATE OR REPLACE FUNCTION create_subscription(
    user_uuid TEXT,
    stripe_sub_id TEXT,
    stripe_customer_id TEXT,
    stripe_price_id TEXT,
    plan_name TEXT,
    status TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert subscription record
    INSERT INTO public.stripe_subscriptions (
        user_id,
        stripe_subscription_id,
        stripe_customer_id,
        stripe_price_id,
        plan_name,
        status,
        current_period_start,
        current_period_end
    ) VALUES (
        user_uuid,
        stripe_sub_id,
        stripe_customer_id,
        stripe_price_id,
        plan_name,
        status,
        period_start,
        period_end
    );
    
    -- Update user profile with Stripe customer ID
    UPDATE public.user_profiles 
    SET 
        stripe_customer_id = stripe_customer_id,
        updated_at = NOW()
    WHERE id = user_uuid;
    
    -- Update user plan if subscription is active
    IF status = 'active' THEN
        UPDATE public.user_profiles 
        SET 
            subscription_plan = plan_name,
            updated_at = NOW()
        WHERE id = user_uuid;
    END IF;
END;
$$;

-- Create function to get user's active subscription
CREATE OR REPLACE FUNCTION get_user_active_subscription(user_uuid TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'subscription_id', ss.stripe_subscription_id,
        'plan_name', ss.plan_name,
        'status', ss.status,
        'current_period_start', ss.current_period_start,
        'current_period_end', ss.current_period_end,
        'cancel_at_period_end', ss.cancel_at_period_end,
        'stripe_customer_id', ss.stripe_customer_id
    ) INTO result
    FROM public.stripe_subscriptions ss
    WHERE ss.user_id = user_uuid 
    AND ss.status IN ('active', 'trialing')
    ORDER BY ss.created_at DESC
    LIMIT 1;
    
    RETURN result;
END;
$$;

-- Create function to cancel subscription
CREATE OR REPLACE FUNCTION cancel_subscription(user_uuid TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.stripe_subscriptions 
    SET 
        cancel_at_period_end = true,
        updated_at = NOW()
    WHERE user_id = user_uuid 
    AND status IN ('active', 'trialing');
    
    RETURN FOUND;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_subscription_status(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION create_subscription(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_active_subscription(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_subscription(TEXT) TO authenticated;

-- Enable RLS on new tables
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for stripe_subscriptions
CREATE POLICY "Users can view own subscriptions" ON stripe_subscriptions
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own subscriptions" ON stripe_subscriptions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own subscriptions" ON stripe_subscriptions
    FOR UPDATE USING (auth.uid()::text = user_id);

-- Admin policies for stripe_subscriptions
CREATE POLICY "Admins can manage all subscriptions" ON stripe_subscriptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid()::text 
            AND role IN ('admin', 'super_admin')
        )
    );

-- RLS policies for stripe_webhook_events (admin only)
CREATE POLICY "Admins can manage webhook events" ON stripe_webhook_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid()::text 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Grant permissions
GRANT ALL ON public.stripe_subscriptions TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO authenticated;

-- Insert default Stripe metadata for existing plans
UPDATE public.plan_rules 
SET stripe_metadata = jsonb_build_object(
    'plan_type', plan_name,
    'generations_limit', monthly_generations_limit,
    'concurrent_limit', concurrent_generations,
    'features', features
)
WHERE stripe_metadata = '{}' OR stripe_metadata IS NULL;

-- Create trigger to update user plan when subscription changes
CREATE OR REPLACE FUNCTION update_user_plan_from_subscription()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active' AND (OLD.status != 'active' OR OLD.status IS NULL) THEN
        -- Update user plan when subscription becomes active
        UPDATE public.user_profiles 
        SET 
            subscription_plan = NEW.plan_name,
            updated_at = NOW()
        WHERE id = NEW.user_id;
    ELSIF NEW.status IN ('canceled', 'unpaid', 'past_due') AND OLD.status = 'active' THEN
        -- Downgrade to free plan when subscription becomes inactive
        UPDATE public.user_profiles 
        SET 
            subscription_plan = 'free',
            monthly_generations_limit = 10,
            updated_at = NOW()
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_user_plan_from_subscription
    AFTER INSERT OR UPDATE ON public.stripe_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_plan_from_subscription();

-- Insert sample Stripe webhook configuration
INSERT INTO public.admin_settings (setting_key, setting_value, description) VALUES
('stripe_webhook_endpoint', '"https://your-domain.com/api/webhooks/stripe"', 'Stripe webhook endpoint URL'),
('stripe_webhook_secret', '"whsec_your_webhook_secret"', 'Stripe webhook signing secret'),
('stripe_publishable_key', '"pk_test_your_publishable_key"', 'Stripe publishable key'),
('stripe_secret_key', '"sk_test_your_secret_key"', 'Stripe secret key (encrypted)')
ON CONFLICT (setting_key) DO NOTHING;

-- Create function to get plan pricing information
CREATE OR REPLACE FUNCTION get_plan_pricing_info()
RETURNS TABLE (
    plan_name TEXT,
    monthly_price DECIMAL,
    yearly_price DECIMAL,
    monthly_generations_limit INTEGER,
    features JSONB,
    stripe_product_id TEXT,
    stripe_price_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.plan_name,
        pr.price_per_month,
        pr.price_per_month * 12 as yearly_price,
        pr.monthly_generations_limit,
        pr.features,
        pr.stripe_product_id,
        pr.stripe_price_id
    FROM public.plan_rules pr
    WHERE pr.is_active = true
    ORDER BY pr.price_per_month;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_plan_pricing_info() TO authenticated;

-- Create public policy for plan pricing (so users can see available plans)
CREATE POLICY "Public can view plan pricing" ON plan_rules
    FOR SELECT USING (is_active = true);

-- Update existing plan rules with better features
UPDATE public.plan_rules 
SET features = jsonb_build_object(
    'basic_enhancement', true,
    'interior_design', plan_name IN ('basic', 'premium', 'enterprise'),
    'element_replacement', plan_name IN ('premium', 'enterprise'),
    'priority_processing', plan_name IN ('premium', 'enterprise'),
    'api_access', plan_name IN ('premium', 'enterprise'),
    'dedicated_support', plan_name = 'enterprise',
    'watermark', plan_name = 'free'
)
WHERE features IS NULL OR features = '{}';

-- Create function to get user subscription summary
CREATE OR REPLACE FUNCTION get_user_subscription_summary(user_uuid TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'current_plan', up.subscription_plan,
        'monthly_limit', up.monthly_generations_limit,
        'current_usage', (
            SELECT COUNT(*) 
            FROM public.generations 
            WHERE user_id = user_uuid 
            AND created_at >= date_trunc('month', CURRENT_DATE)
        ),
        'stripe_customer_id', up.stripe_customer_id,
        'active_subscription', (
            SELECT json_build_object(
                'status', ss.status,
                'current_period_end', ss.current_period_end,
                'cancel_at_period_end', ss.cancel_at_period_end
            )
            FROM public.stripe_subscriptions ss
            WHERE ss.user_id = user_uuid 
            AND ss.status IN ('active', 'trialing')
            LIMIT 1
        )
    ) INTO result
    FROM public.user_profiles up
    WHERE up.id = user_uuid;
    
    RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_subscription_summary(TEXT) TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_plan_name ON public.stripe_subscriptions(plan_name);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_period_end ON public.stripe_subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON public.stripe_webhook_events(created_at);

-- Insert default yearly pricing for existing plans
-- Note: This creates additional price points for yearly billing
-- You'll need to create these in Stripe manually or via the admin interface

-- Create function to sync plan limits from Stripe metadata
CREATE OR REPLACE FUNCTION sync_plan_limits_from_stripe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update plan rules with Stripe metadata if available
    UPDATE public.plan_rules 
    SET 
        monthly_generations_limit = COALESCE(
            (stripe_metadata->>'monthly_limit')::INTEGER,
            monthly_generations_limit
        ),
        concurrent_generations = COALESCE(
            (stripe_metadata->>'concurrent_limit')::INTEGER,
            concurrent_generations
        ),
        updated_at = NOW()
    WHERE stripe_metadata IS NOT NULL 
    AND stripe_metadata != '{}';
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_plan_limits_from_stripe() TO authenticated;

-- Final setup: Create a view for easy plan management
CREATE OR REPLACE VIEW public.plan_overview AS
SELECT 
    pr.id,
    pr.plan_name,
    pr.monthly_generations_limit,
    pr.concurrent_generations,
    pr.price_per_month,
    pr.features,
    pr.is_active,
    pr.stripe_product_id,
    pr.stripe_price_id,
    pr.created_at,
    pr.updated_at,
    COUNT(up.id) as active_users
FROM public.plan_rules pr
LEFT JOIN public.user_profiles up ON pr.plan_name = up.subscription_plan AND up.is_active = true
GROUP BY pr.id, pr.plan_name, pr.monthly_generations_limit, pr.concurrent_generations, 
         pr.price_per_month, pr.features, pr.is_active, pr.stripe_product_id, 
         pr.stripe_price_id, pr.created_at, pr.updated_at
ORDER BY pr.price_per_month;

-- Grant select permission on the view
GRANT SELECT ON public.plan_overview TO authenticated;

-- Create admin-only view for detailed plan analytics
-- Note: This view will be accessible to all authenticated users, but the frontend should check admin role
CREATE OR REPLACE VIEW public.admin_plan_analytics AS
SELECT 
    pr.plan_name,
    pr.monthly_generations_limit,
    pr.price_per_month,
    COUNT(up.id) as total_users,
    COUNT(CASE WHEN up.is_active THEN 1 END) as active_users,
    AVG(up.total_generations) as avg_generations_per_user,
    SUM(up.total_generations) as total_generations,
    pr.stripe_product_id,
    pr.stripe_price_id
FROM public.plan_rules pr
LEFT JOIN public.user_profiles up ON pr.plan_name = up.subscription_plan
GROUP BY pr.id, pr.plan_name, pr.monthly_generations_limit, pr.price_per_month, 
         pr.stripe_product_id, pr.stripe_price_id
ORDER BY pr.price_per_month;

-- Grant select permission on admin view to authenticated users
-- Note: Frontend should implement role-based access control for this view
GRANT SELECT ON public.admin_plan_analytics TO authenticated;

-- Summary of changes made:
-- 1. Added Stripe product and price IDs to plan_rules table
-- 2. Added Stripe customer ID to user_profiles table
-- 3. Created stripe_subscriptions table for tracking subscriptions
-- 4. Created stripe_webhook_events table for webhook processing
-- 5. Added functions for subscription management
-- 6. Created RLS policies for security
-- 7. Added indexes for performance
-- 8. Created views for easy data access
-- 9. Added admin settings for Stripe configuration

-- Next steps:
-- 1. Set up Stripe webhook endpoints in your backend
-- 2. Configure Stripe API keys in environment variables
-- 3. Create products and prices in your Stripe dashboard
-- 4. Test the integration with test subscriptions
-- 5. Update your frontend to use the new Stripe-enabled endpoints
