import supabase from '../config/supabase';

/**
 * Checks whether there is a valid Supabase session.
 * Returns true if the access token exists, false otherwise.
 */
export const checkAuthSession = async (): Promise<boolean> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error checking auth session:', error);
      return false;
    }
    return Boolean(session?.access_token);
  } catch (err) {
    console.error('Auth session check failed:', err);
    return false;
  }
};

export default {
  checkAuthSession,
};

