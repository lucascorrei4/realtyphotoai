import dotenv from 'dotenv';
import stripeCheckoutService from '../src/services/stripeCheckoutService';

dotenv.config();

async function manualSplitPayment() {
  const subscriptionId = 'sub_1SQaj9HPF35oYxpn4UiyQuYX';

  console.log('💰 Processing Manual Split Payment...\n');
  console.log(`Subscription ID: ${subscriptionId}\n`);

  try {
    console.log('🔄 Processing split payment...');
    await stripeCheckoutService.processSplitPayment(subscriptionId);
    
    console.log('✅ Split payment processed successfully!');
    console.log('\n💡 Check Stripe Dashboard → Transfers to verify transfers were created.');
    console.log('   You should see transfers to:');
    console.log(`   - Partner 1: ${process.env.STRIPE_PARTNER1_ACCOUNT_ID}`);
    console.log(`   - Partner 2: ${process.env.STRIPE_PARTNER2_ACCOUNT_ID}`);
    if (process.env.STRIPE_AGENCY_ACCOUNT_ID) {
      console.log(`   - Agency: ${process.env.STRIPE_AGENCY_ACCOUNT_ID}`);
    }
    
  } catch (error) {
    console.error('❌ Error processing split payment:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

manualSplitPayment();

