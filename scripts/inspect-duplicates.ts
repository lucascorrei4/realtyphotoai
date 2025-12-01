
import { supabase } from '../src/config/supabase';

async function inspectDuplicates() {
  console.log('Checking for duplicate emails...');
  
  const email = 'lucascorreiaevangelista@gmail.com';

  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', email);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${users?.length} profiles for email ${email}`);
  users?.forEach(u => {
      console.log(`ID: ${u.id}, Plan: ${u.subscription_plan}, Created: ${u.created_at}`);
  });
}

inspectDuplicates().catch(console.error);

