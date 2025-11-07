import dotenv from 'dotenv';
import { supabase } from '../src/config/supabase';

dotenv.config();

async function inspectStripeSubscriptions() {
  console.log('🔍 Inspecting stripe_subscriptions table...\n');

  try {
    // 1. Check table structure by attempting a query
    console.log('1️⃣ Checking table structure...');
    const { error: structureError } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .limit(0);
    
    if (structureError) {
      console.log('⚠️  Error accessing table:', structureError.message);
      console.log('   This might indicate a schema mismatch\n');
    } else {
      console.log('✅ Table is accessible\n');
    }

    // 2. Check existing subscriptions
    console.log('2️⃣ Checking existing subscriptions...');
    const { data: subscriptions, error: subError } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (subError) {
      console.error('❌ Error fetching subscriptions:', subError);
    } else {
      console.log(`📊 Found ${subscriptions?.length || 0} subscription(s):\n`);
      if (subscriptions && subscriptions.length > 0) {
        subscriptions.forEach((sub, idx) => {
          console.log(`   ${idx + 1}. ID: ${sub.id}`);
          console.log(`      User ID: ${sub.user_id}`);
          console.log(`      Stripe Subscription ID: ${sub.stripe_subscription_id}`);
          console.log(`      Plan: ${sub.plan_name || sub.subscription_plan || 'N/A'}`);
          console.log(`      Status: ${sub.status}`);
          console.log(`      Created: ${sub.created_at}`);
          console.log('');
        });
      } else {
        console.log('   ⚠️  Table is empty - no subscriptions found\n');
      }
    }

    // 3. Check user profiles with subscriptions
    console.log('3️⃣ Checking user profiles with paid plans...');
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, email, subscription_plan, stripe_customer_id, monthly_generations_limit')
      .neq('subscription_plan', 'free')
      .not('stripe_customer_id', 'is', null)
      .limit(10);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
    } else {
      console.log(`👥 Found ${users?.length || 0} user(s) with paid plans:\n`);
      if (users && users.length > 0) {
        users.forEach((user, idx) => {
          console.log(`   ${idx + 1}. Email: ${user.email}`);
          console.log(`      Plan: ${user.subscription_plan}`);
          console.log(`      Stripe Customer ID: ${user.stripe_customer_id}`);
          console.log(`      Monthly Limit: ${user.monthly_generations_limit}`);
          console.log('');
        });
      }
    }

    // 4. Try to get one row to see actual structure
    console.log('4️⃣ Attempting to see table structure by checking columns...');
    const { data: sampleRow, error: sampleError } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .limit(1)
      .single();

    if (sampleError && sampleError.code !== 'PGRST116') {
      console.log('   ℹ️  Table structure (from error):', sampleError.message);
    } else if (sampleRow) {
      console.log('   ✅ Sample row structure:');
      console.log('   Columns:', Object.keys(sampleRow).join(', '));
    } else {
      console.log('   ℹ️  Table is empty, checking via information_schema...');
    }

    // 5. Check webhook events
    console.log('\n5️⃣ Checking recent webhook events...');
    const { data: webhooks, error: webhookError } = await supabase
      .from('stripe_webhook_events')
      .select('stripe_event_id, event_type, processed, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (webhookError) {
      console.error('❌ Error fetching webhooks:', webhookError);
    } else {
      console.log(`📨 Found ${webhooks?.length || 0} recent webhook event(s):\n`);
      if (webhooks && webhooks.length > 0) {
        webhooks.forEach((wh, idx) => {
          console.log(`   ${idx + 1}. Type: ${wh.event_type}`);
          console.log(`      Processed: ${wh.processed ? '✅' : '❌'}`);
          console.log(`      Event ID: ${wh.stripe_event_id}`);
          console.log(`      Created: ${wh.created_at}`);
          console.log('');
        });
      }
    }

    console.log('\n✅ Inspection complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. If table is empty, check webhook processing');
    console.log('   2. Verify the table schema matches the code expectations');
    console.log('   3. Check if enum casting is needed for subscription_plan column');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

inspectStripeSubscriptions();

