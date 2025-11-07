import dotenv from 'dotenv';
import Stripe from 'stripe';
import { supabase } from '../src/config/supabase';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

async function updateCancelStatus() {
  const subscriptionId = 'sub_1SQaj9HPF35oYxpn4UiyQuYX'; // From inspection

  console.log('🔄 Updating cancel status from Stripe...\n');
  console.log(`Subscription ID: ${subscriptionId}\n`);

  try {
    // Get subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    console.log('📋 Stripe Subscription Status:');
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Cancel at period end: ${subscription.cancel_at_period_end}`);
    console.log(`   Current period end: ${new Date(subscription.current_period_end * 1000).toISOString()}\n`);

    // Update database
    const updateData: any = {
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('stripe_subscriptions')
      .update(updateData)
      .eq('stripe_subscription_id', subscriptionId);

    if (updateError) {
      console.error('❌ Error updating database:', updateError);
    } else {
      console.log('✅ Database updated successfully!');
      console.log(`   Status: ${updateData.status}`);
      console.log(`   Cancel at period end: ${updateData.cancel_at_period_end}`);
    }

    // Verify update
    const { data: updatedSub } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscriptionId)
      .single();

    if (updatedSub) {
      console.log('\n📊 Updated subscription in database:');
      console.log(`   Plan: ${updatedSub.plan_name}`);
      console.log(`   Status: ${updatedSub.status}`);
      console.log(`   Cancel at period end: ${updatedSub.cancel_at_period_end}`);
      console.log(`   Period end: ${updatedSub.current_period_end}`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
  }
}

updateCancelStatus();

