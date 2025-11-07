/**
 * Verification script to check split payment calculations
 * Run with: npx ts-node scripts/verify-split-payment.ts
 */

// Example: $49.90 subscription
const testAmount = 49.90; // In dollars

// Stripe fees: 2.9% + $0.30
const stripeFees = Math.round(testAmount * 100 * 0.029) + 30; // In cents
const netAmount = (testAmount * 100) - stripeFees; // In cents

// Split percentages
const partner1Percent = 46;
const partner2Percent = 46;
const agencyPercent = 8;

// Calculate splits from NET amount (after fees)
const partner1Amount = Math.round(netAmount * partner1Percent / 100);
const partner2Amount = Math.round(netAmount * partner2Percent / 100);
const agencyAmount = Math.round(netAmount * agencyPercent / 100);

// Platform keeps: Stripe fees
const platformAmount = stripeFees;

// Verify totals
const totalDistributed = partner1Amount + partner2Amount + agencyAmount + platformAmount;
const originalAmount = testAmount * 100;

console.log('=== Split Payment Verification ===\n');
console.log(`Original Amount: $${testAmount.toFixed(2)} (${originalAmount} cents)\n`);

console.log('Stripe Fees Calculation:');
console.log(`  2.9% of $${testAmount.toFixed(2)}: $${(testAmount * 0.029).toFixed(2)}`);
console.log(`  Fixed fee: $0.30`);
console.log(`  Total Stripe Fees: $${(stripeFees / 100).toFixed(2)} (${stripeFees} cents)\n`);

console.log(`Net Amount (after fees): $${(netAmount / 100).toFixed(2)} (${netAmount} cents)\n`);

console.log('Split Distribution (from NET amount):');
console.log(`  Partner 1 (${partner1Percent}%): $${(partner1Amount / 100).toFixed(2)} (${partner1Amount} cents)`);
console.log(`  Partner 2 (${partner2Percent}%): $${(partner2Amount / 100).toFixed(2)} (${partner2Amount} cents)`);
console.log(`  Agency (${agencyPercent}%): $${(agencyAmount / 100).toFixed(2)} (${agencyAmount} cents)`);
console.log(`  Platform (Stripe fees): $${(platformAmount / 100).toFixed(2)} (${platformAmount} cents)\n`);

console.log('Verification:');
console.log(`  Total Distributed: $${(totalDistributed / 100).toFixed(2)} (${totalDistributed} cents)`);
console.log(`  Original Amount: $${(originalAmount / 100).toFixed(2)} (${originalAmount} cents)`);
console.log(`  Difference: $${((originalAmount - totalDistributed) / 100).toFixed(2)} (${originalAmount - totalDistributed} cents)`);
console.log(`  Match: ${totalDistributed === originalAmount ? '✅ YES' : '❌ NO'}\n`);

console.log('Summary:');
console.log(`  Partner 1 receives: ${((partner1Amount / originalAmount) * 100).toFixed(2)}% of gross`);
console.log(`  Partner 2 receives: ${((partner2Amount / originalAmount) * 100).toFixed(2)}% of gross`);
console.log(`  Agency receives: ${((agencyAmount / originalAmount) * 100).toFixed(2)}% of gross`);
console.log(`  Platform keeps: ${((platformAmount / originalAmount) * 100).toFixed(2)}% of gross (Stripe fees)\n`);

// Test with different amounts (using the actual calculation logic)
console.log('\n=== Test with Different Plan Prices ===\n');

const testPrices = [9.99, 29.99, 49.99, 99.99, 199.90];

testPrices.forEach(price => {
  const totalCents = Math.round(price * 100);
  const fees = Math.round(totalCents * 0.029) + 30;
  const net = totalCents - fees;
  const p1 = Math.round(net * 46 / 100);
  const p2 = Math.round(net * 46 / 100);
  const agency = Math.round(net * 8 / 100);
  
  // Calculate rounding difference and adjust partner1
  const distributed = p1 + p2 + agency;
  const roundingDiff = net - distributed;
  const adjustedP1 = p1 + roundingDiff;
  
  const total = adjustedP1 + p2 + agency + fees;
  
  console.log(`$${price.toFixed(2)} plan:`);
  console.log(`  Fees: $${(fees / 100).toFixed(2)}, Net: $${(net / 100).toFixed(2)}`);
  console.log(`  Partner 1: $${(adjustedP1 / 100).toFixed(2)}, Partner 2: $${(p2 / 100).toFixed(2)}, Agency: $${(agency / 100).toFixed(2)}`);
  console.log(`  Total: $${(total / 100).toFixed(2)} (${total === totalCents ? '✅' : '❌'})\n`);
});

