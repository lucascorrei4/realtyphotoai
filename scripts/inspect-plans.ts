
import { supabase } from '../src/config/supabase';

async function inspectPlans() {
  console.log('Inspecting plan_rules...');

  const { data: plans, error } = await supabase
    .from('plan_rules')
    .select('*');

  if (error) {
    console.error('Error fetching plans:', error);
    return;
  }

  console.log(`Found ${plans?.length} plans.`);
  plans?.forEach(p => {
      console.log(`Plan: ${p.plan_name} (ID: ${p.id})`);
      console.log(`  Display Name: ${p.display_name}`);
      console.log(`  Monthly Gen Limit (Display Credits): ${p.monthly_generations_limit}`);
      console.log(`  Price: ${p.price_per_month}`);
  });
}

inspectPlans().catch(console.error);

