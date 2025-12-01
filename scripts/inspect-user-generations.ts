
import { supabase } from '../src/config/supabase';

async function inspectUser() {
  console.log('Inspecting users...');

  // Search for "rs22" which appears in the screenshot name
  const { data: users, error: userError } = await supabase
    .from('user_profiles')
    .select('*')
    .ilike('name', '%rs22%');

  if (userError) {
    console.error('Error finding user:', userError);
    return;
  }

  console.log(`Found ${users?.length} users matching "rs22"`);

  for (const user of users || []) {
    console.log(`\nUser: ${user.email} (ID: ${user.id})`);
    console.log(`Plan: ${user.subscription_plan}`);

    // 2. Get actual generations details
    const { data: generations } = await supabase
      .from('generations')
      .select('*')
      .eq('user_id', user.id)
      .limit(20); // Just check first 20

    console.log(`Fetched ${generations?.length} generations.`);
    
    if (generations && generations.length > 0) {
        const statuses = generations.reduce((acc: any, g) => {
            acc[g.status] = (acc[g.status] || 0) + 1;
            return acc;
        }, {});
        console.log('Statuses:', statuses);
        
        console.log('Sample Created At:', generations[0].created_at);
        console.log('Sample Deleted:', generations[0].is_deleted);
        
        // Check date parsing test
        const date = new Date(generations[0].created_at);
        console.log('Parsed Date:', date.toString(), 'ISO:', date.toISOString());
        
        const now = new Date();
        const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        console.log('Current Month Start:', currentMonth.toISOString());
        
        const isInMonth = date >= currentMonth;
        console.log('Is Sample In Current Month?', isInMonth);
    }
  }
}

inspectUser().catch(console.error);
