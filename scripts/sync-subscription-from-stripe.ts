import dotenv from 'dotenv';
import Stripe from 'stripe';
import { supabase } from '../src/config/supabase';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

async function syncSubscriptionFromStripe() {
  const customerId = 'cus_TNIPHTEKJUC44z'; // From inspection
  const userEmail = 'lucascorreiaevangelista@gmail.com';

  console.log('🔄 Syncing subscription from Stripe...\n');
  console.log(`Customer ID: ${customerId}`);
  console.log(`User Email: ${userEmail}\n`);

  try {
    // 1. Get user from database
    console.log('1️⃣ Fetching user from database...');
    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email, subscription_plan, stripe_customer_id')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', userError);
      return;
    }

    console.log(`✅ Found user: ${user.id}`);
    console.log(`   Current plan: ${user.subscription_plan}\n`);

    // 2. Get subscriptions from Stripe
    console.log('2️⃣ Fetching subscriptions from Stripe...');
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });

    if (subscriptions.data.length === 0) {
      console.log('⚠️  No subscriptions found in Stripe for this customer\n');
      return;
    }

    console.log(`✅ Found ${subscriptions.data.length} subscription(s) in Stripe:\n`);

    for (const subscription of subscriptions.data) {
      console.log(`📋 Subscription: ${subscription.id}`);
      console.log(`   Status: ${subscription.status}`);
      console.log(`   Current Period: ${new Date(subscription.current_period_start * 1000).toISOString()} - ${new Date(subscription.current_period_end * 1000).toISOString()}`);
      
      const priceId = subscription.items.data[0]?.price.id;
      if (priceId) {
        const price = await stripe.prices.retrieve(priceId);
        const planName = price.metadata.plan_name || 'unknown';
        console.log(`   Plan Name: ${planName}`);
        console.log(`   Price ID: ${priceId}\n`);

        // 3. Check if subscription exists in database
        console.log('3️⃣ Checking if subscription exists in database...');
        const { data: existingSub } = await supabase
          .from('stripe_subscriptions')
          .select('id, plan_name, subscription_plan, status')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (existingSub) {
          console.log(`⚠️  Subscription already exists in database (ID: ${existingSub.id})`);
          console.log(`   Current plan in DB: ${existingSub.plan_name || existingSub.subscription_plan || 'N/A'}\n`);
        } else {
          console.log('   ⚠️  Subscription NOT found in database - needs to be created\n');
        }

        // 4. Try to insert/update subscription
        console.log('4️⃣ Attempting to sync subscription to database...');
        
        // Normalize plan name
        const normalizedPlanName = planName.toLowerCase().trim();
        
        // Try using RPC function first (handles enum casting)
        console.log(`   Attempting insert via RPC function with plan: "${normalizedPlanName}"`);
        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_stripe_subscription', {
          p_user_id: user.id,
          p_stripe_subscription_id: subscription.id,
          p_stripe_customer_id: customerId,
          p_stripe_price_id: priceId,
          p_plan_name: normalizedPlanName,
          p_status: subscription.status,
          p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          p_cancel_at_period_end: subscription.cancel_at_period_end || false
        });

        let insertError = rpcError;

        if (rpcError) {
          console.log('   ⚠️  RPC function failed or not found, trying direct insert...');
          console.log('   RPC error:', rpcError.message);
          
          // Fallback: try direct insert with plan_name TEXT column
          const { error: directError } = await supabase
            .from('stripe_subscriptions')
            .insert({
              user_id: user.id,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: customerId,
              stripe_price_id: priceId,
              plan_name: normalizedPlanName, // Use plan_name TEXT column
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end || false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          insertError = directError;
          
          if (directError) {
            console.log('   ❌ Direct insert also failed:');
            console.log('   Error message:', directError.message);
            console.log('   Error code:', directError.code);
            console.log('   Full error:', JSON.stringify(directError, null, 2));
          } else {
            console.log('   ✅ Successfully inserted with direct enum cast!\n');
          }
        } else {
          console.log('   ✅ Successfully inserted via RPC function!');
          console.log(`   Subscription ID: ${rpcResult}\n`);
        }

        // 5. Verify the insert
        if (!insertError) {
          console.log('5️⃣ Verifying subscription in database...');
          const { data: verifiedSub } = await supabase
            .from('stripe_subscriptions')
            .select('*')
            .eq('stripe_subscription_id', subscription.id)
            .single();

          if (verifiedSub) {
            console.log('✅ Subscription successfully synced!');
            console.log(`   Database ID: ${verifiedSub.id}`);
            console.log(`   Plan: ${verifiedSub.plan_name || verifiedSub.subscription_plan || 'N/A'}`);
            console.log(`   Status: ${verifiedSub.status}\n`);
          }
        }
      }
    }

    console.log('\n✅ Sync process complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

syncSubscriptionFromStripe();

