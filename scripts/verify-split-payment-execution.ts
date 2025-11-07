import dotenv from 'dotenv';
import Stripe from 'stripe';
import { supabase } from '../src/config/supabase';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

async function verifySplitPayment() {
  const subscriptionId = 'sub_1SQaj9HPF35oYxpn4UiyQuYX';

  console.log('🔍 Verifying Split Payment Execution...\n');
  console.log(`Subscription ID: ${subscriptionId}\n`);

  try {
    // 1. Get subscription details
    console.log('1️⃣ Fetching subscription from Stripe...');
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Customer: ${subscription.customer}`);
    console.log(`   Current period: ${new Date(subscription.current_period_start * 1000).toISOString()} - ${new Date(subscription.current_period_end * 1000).toISOString()}\n`);

    // 2. Get invoices for this subscription
    console.log('2️⃣ Fetching invoices for subscription...');
    const invoices = await stripe.invoices.list({
      subscription: subscriptionId,
      limit: 10,
    });

    if (invoices.data.length === 0) {
      console.log('   ⚠️  No invoices found for this subscription\n');
      return;
    }

    console.log(`   ✅ Found ${invoices.data.length} invoice(s):\n`);
    
    for (const invoice of invoices.data) {
      console.log(`   📄 Invoice: ${invoice.id}`);
      console.log(`      Amount: $${(invoice.amount_paid / 100).toFixed(2)} ${invoice.currency.toUpperCase()}`);
      console.log(`      Status: ${invoice.status}`);
      console.log(`      Paid: ${invoice.paid ? '✅' : '❌'}`);
      console.log(`      Date: ${new Date(invoice.created * 1000).toISOString()}`);
      console.log(`      Payment Intent: ${invoice.payment_intent || 'N/A'}\n`);

      // 3. Check for transfers (split payments)
      if (invoice.payment_intent) {
        console.log(`   🔄 Checking transfers for payment intent: ${invoice.payment_intent}`);
        
        // Get payment intent to see if it has transfers
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(invoice.payment_intent as string);
          console.log(`      Payment Intent Status: ${paymentIntent.status}`);
          console.log(`      Amount: $${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}\n`);
        } catch (error) {
          console.log(`      ⚠️  Could not retrieve payment intent: ${error instanceof Error ? error.message : error}\n`);
        }
      }
    }

    // 4. Check for transfers to connected accounts
    console.log('3️⃣ Checking transfers to connected accounts...');
    const transfers = await stripe.transfers.list({
      limit: 20,
    });

    if (transfers.data.length === 0) {
      console.log('   ⚠️  No transfers found in Stripe\n');
    } else {
      console.log(`   ✅ Found ${transfers.data.length} transfer(s):\n`);
      
      // Filter transfers related to this subscription
      const relatedTransfers = transfers.data.filter(t => {
        // Check if transfer description or metadata mentions the subscription
        const description = t.description?.toLowerCase() || '';
        const metadata = t.metadata || {};
        return description.includes(subscriptionId.toLowerCase()) || 
               Object.values(metadata).some(v => String(v).includes(subscriptionId));
      });

      if (relatedTransfers.length > 0) {
        console.log(`   📊 Found ${relatedTransfers.length} transfer(s) related to this subscription:\n`);
        relatedTransfers.forEach((transfer, idx) => {
          console.log(`   ${idx + 1}. Transfer ID: ${transfer.id}`);
          console.log(`      Amount: $${(transfer.amount / 100).toFixed(2)} ${transfer.currency.toUpperCase()}`);
          console.log(`      Destination: ${transfer.destination}`);
          console.log(`      Reversed: ${transfer.reversed ? 'Yes' : 'No'}`);
          console.log(`      Created: ${new Date(transfer.created * 1000).toISOString()}`);
          console.log(`      Description: ${transfer.description || 'N/A'}\n`);
        });
      } else {
        console.log('   ⚠️  No transfers found related to this subscription\n');
        console.log('   ℹ️  Showing all recent transfers for reference:\n');
        transfers.data.slice(0, 5).forEach((transfer, idx) => {
          console.log(`   ${idx + 1}. Transfer ID: ${transfer.id}`);
          console.log(`      Amount: $${(transfer.amount / 100).toFixed(2)}`);
          console.log(`      Destination: ${transfer.destination}`);
          console.log(`      Created: ${new Date(transfer.created * 1000).toISOString()}\n`);
        });
      }
    }

    // 5. Check webhook events
    console.log('4️⃣ Checking webhook events in database...');
    const { data: webhooks, error: webhookError } = await supabase
      .from('stripe_webhook_events')
      .select('stripe_event_id, event_type, processed, created_at')
      .eq('event_type', 'invoice.payment_succeeded')
      .order('created_at', { ascending: false })
      .limit(5);

    if (webhookError) {
      console.error('   ❌ Error fetching webhooks:', webhookError);
    } else if (webhooks && webhooks.length > 0) {
      console.log(`   ✅ Found ${webhooks.length} invoice.payment_succeeded event(s):\n`);
      webhooks.forEach((wh, idx) => {
        console.log(`   ${idx + 1}. Event ID: ${wh.stripe_event_id}`);
        console.log(`      Processed: ${wh.processed ? '✅' : '❌'}`);
        console.log(`      Created: ${wh.created_at}\n`);
      });
    } else {
      console.log('   ⚠️  No invoice.payment_succeeded webhook events found\n');
    }

    // 6. Check partner account IDs from env
    console.log('5️⃣ Partner Account Configuration:');
    const partner1Id = process.env.STRIPE_PARTNER1_ACCOUNT_ID;
    const partner2Id = process.env.STRIPE_PARTNER2_ACCOUNT_ID;
    const agencyId = process.env.STRIPE_AGENCY_ACCOUNT_ID;
    
    console.log(`   Partner 1: ${partner1Id || 'NOT SET'}`);
    console.log(`   Partner 2: ${partner2Id || 'NOT SET'}`);
    console.log(`   Agency: ${agencyId || 'NOT SET'}\n`);

    if (partner1Id && partner2Id) {
      // Check if there are any transfers to these accounts
      const partnerTransfers = transfers.data.filter(t => 
        t.destination === partner1Id || 
        t.destination === partner2Id || 
        (agencyId && t.destination === agencyId)
      );

      if (partnerTransfers.length > 0) {
        console.log(`   ✅ Found ${partnerTransfers.length} transfer(s) to partner accounts:\n`);
        partnerTransfers.forEach((transfer, idx) => {
          const accountName = transfer.destination === partner1Id ? 'Partner 1' :
                             transfer.destination === partner2Id ? 'Partner 2' :
                             transfer.destination === agencyId ? 'Agency' : 'Unknown';
          console.log(`   ${idx + 1}. ${accountName} (${transfer.destination})`);
          console.log(`      Amount: $${(transfer.amount / 100).toFixed(2)}`);
          console.log(`      Reversed: ${transfer.reversed ? 'Yes' : 'No'}`);
          console.log(`      Created: ${new Date(transfer.created * 1000).toISOString()}\n`);
        });
      } else {
        console.log('   ⚠️  No transfers found to partner accounts\n');
      }
    }

    console.log('\n✅ Verification complete!');
    console.log('\n💡 Summary:');
    console.log('   - Check if invoice.payment_succeeded webhook was received');
    console.log('   - Check if transfers were created to partner accounts');
    console.log('   - If no transfers found, the split payment may not have executed');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

verifySplitPayment();

