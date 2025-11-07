import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

async function verifyAccountTypes() {
  console.log('🔍 Verifying Connected Account Types...\n');

  const accountIds = {
    partner1: process.env.STRIPE_PARTNER1_ACCOUNT_ID || '',
    partner2: process.env.STRIPE_PARTNER2_ACCOUNT_ID || '',
    agency: process.env.STRIPE_AGENCY_ACCOUNT_ID || '',
  };

  if (!accountIds.partner1 || !accountIds.partner2 || !accountIds.agency) {
    console.error('❌ Missing account IDs in .env file');
    console.log('Required:');
    console.log('  STRIPE_PARTNER1_ACCOUNT_ID');
    console.log('  STRIPE_PARTNER2_ACCOUNT_ID');
    console.log('  STRIPE_AGENCY_ACCOUNT_ID');
    return;
  }

  console.log('📋 Account IDs:');
  console.log(`   Partner 1: ${accountIds.partner1}`);
  console.log(`   Partner 2: ${accountIds.partner2}`);
  console.log(`   Agency: ${accountIds.agency}\n`);

  const accounts = [
    { name: 'Partner 1', id: accountIds.partner1 },
    { name: 'Partner 2', id: accountIds.partner2 },
    { name: 'Agency', id: accountIds.agency },
  ];

  let allValid = true;

  for (const account of accounts) {
    try {
      console.log(`🔍 Checking ${account.name} (${account.id})...`);
      
      const stripeAccount = await stripe.accounts.retrieve(account.id);
      
      const accountType = stripeAccount.type || 'unknown';
      const isExpress = accountType === 'express';
      const isCustom = accountType === 'custom';
      const isStandard = accountType === 'standard';
      const canReceiveTransfers = isExpress || isCustom;

      console.log(`   ✅ Account Type: ${accountType.toUpperCase()}`);
      console.log(`   ${canReceiveTransfers ? '✅' : '❌'} Can Receive Transfers: ${canReceiveTransfers ? 'YES' : 'NO'}`);
      console.log(`   ${stripeAccount.charges_enabled ? '✅' : '❌'} Charges Enabled: ${stripeAccount.charges_enabled}`);
      console.log(`   ${stripeAccount.payouts_enabled ? '✅' : '❌'} Payouts Enabled: ${stripeAccount.payouts_enabled}`);

      if (isStandard) {
        console.log(`   ⚠️  WARNING: Standard accounts CANNOT receive platform-initiated transfers!`);
        console.log(`   💡 Action Required: Upgrade to Express or Custom account type.`);
        allValid = false;
      } else if (canReceiveTransfers) {
        console.log(`   ✅ Account type is compatible with split payments!`);
      }

      // Check capabilities (only for Express/Custom accounts)
      if (canReceiveTransfers) {
        try {
          const transfersCapability = await stripe.accounts.retrieveCapability(account.id, 'transfers');
          console.log(`   📊 Transfers Capability: ${transfersCapability.status}`);
          if (transfersCapability.status !== 'active') {
            console.log(`   ⚠️  WARNING: Transfers capability is not active!`);
            allValid = false;
          }
        } catch (capError) {
          console.log(`   ⚠️  Could not check transfers capability: ${(capError as Error).message}`);
        }
      } else {
        console.log(`   ⚠️  Standard accounts don't support transfers capability`);
      }

      console.log('');
    } catch (error) {
      console.error(`   ❌ Error retrieving account ${account.id}:`, (error as Error).message);
      allValid = false;
      console.log('');
    }
  }

  console.log('\n' + '='.repeat(60));
  if (allValid) {
    console.log('✅ All accounts are compatible with split payments!');
    console.log('   You can proceed with automatic split payment setup.');
  } else {
    console.log('❌ Some accounts are NOT compatible with split payments!');
    console.log('   Action Required: Upgrade Standard accounts to Express or Custom.');
    console.log('\n📚 Documentation:');
    console.log('   - Express Accounts: https://stripe.com/docs/connect/express-accounts');
    console.log('   - Custom Accounts: https://stripe.com/docs/connect/custom-accounts');
    console.log('   - Account Types: https://stripe.com/docs/connect/account-types');
  }
  console.log('='.repeat(60) + '\n');
}

verifyAccountTypes().catch(console.error);

