import dotenv from 'dotenv';
import { supabase } from '../src/config/supabase';

dotenv.config();

async function checkSchema() {
  console.log('🔍 Checking stripe_subscriptions table structure...\n');

  try {
    // Try to get a sample row to see what columns exist
    const { data: sample, error: sampleError } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log('❌ Error querying table:', sampleError.message);
      console.log('   Code:', sampleError.code);
    } else if (sample && sample.length > 0) {
      console.log('✅ Sample row columns:', Object.keys(sample[0]).join(', '));
      console.log('   Sample data:', JSON.stringify(sample[0], null, 2));
    } else {
      console.log('ℹ️  Table is empty, checking via information_schema...');
    }

    // Check if RPC function exists
    console.log('\n🔍 Checking if RPC function exists...');
    const { error: rpcError } = await supabase.rpc('create_stripe_subscription', {
      p_user_id: 'test',
      p_stripe_subscription_id: 'test',
      p_stripe_customer_id: 'test',
      p_stripe_price_id: 'test',
      p_plan_name: 'premium',
      p_status: 'active',
      p_current_period_start: new Date().toISOString(),
      p_current_period_end: new Date().toISOString(),
      p_cancel_at_period_end: false
    });

    if (rpcError) {
      console.log('⚠️  RPC function error:', rpcError.message);
      console.log('   Code:', rpcError.code);
      console.log('   Details:', rpcError.details);
      console.log('   Hint:', rpcError.hint);
    } else {
      console.log('✅ RPC function exists and accepts parameters');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkSchema();

