/**
 * Script to sync all subscription plans with Stripe
 * Creates products and prices (monthly/yearly) for all active plans in the database
 * 
 * Usage: npx ts-node scripts/sync-stripe-plans.ts
 */

import dotenv from 'dotenv';
import stripeCheckoutService from '../src/services/stripeCheckoutService';
import { logger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

async function syncPlans() {
  try {
    console.log('🚀 Starting Stripe plans sync...\n');

    const result = await stripeCheckoutService.syncAllPlansWithStripe();

    console.log('\n📊 Sync Results:');
    console.log(`✅ Successfully synced: ${result.synced} plans`);
    console.log(`❌ Failed: ${result.failed} plans\n`);

    if (result.results.length > 0) {
      console.log('📋 Detailed Results:');
      result.results.forEach((planResult) => {
        if (planResult.success) {
          console.log(`\n✅ ${planResult.planName}:`);
          console.log(`   Product ID: ${planResult.productId}`);
          console.log(`   Monthly Price ID: ${planResult.monthlyPriceId}`);
          console.log(`   Yearly Price ID: ${planResult.yearlyPriceId}`);
        } else {
          console.log(`\n❌ ${planResult.planName}:`);
          console.log(`   Error: ${planResult.error}`);
        }
      });
    }

    if (result.success) {
      console.log('\n🎉 All plans synced successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some plans failed to sync. Check the errors above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error syncing plans:', error);
    logger.error('Error in sync script:', error as Error);
    process.exit(1);
  }
}

// Run the sync
syncPlans();

