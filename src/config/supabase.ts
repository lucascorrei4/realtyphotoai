import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://suqyzhfeifogeupavirb.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

// Create Supabase client with service role key for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create Supabase client for user operations (with limited permissions)
export const createUserSupabaseClient = (accessToken: string) => {
  return createClient(supabaseUrl, accessToken, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export default supabase;
