// auth-validate-token Edge Function
// Validates JWT token and returns user information
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { encode, decode } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
// JWT verification function (embedded to match our creation method)
const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-super-secret-jwt-key-change-this-in-production';
async function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }
    const [headerB64, payloadB64, signatureB64] = parts;
    // Verify signature
    const expectedSignature = await createSignature(`${headerB64}.${payloadB64}`);
    if (signatureB64 !== expectedSignature) {
      console.error('Invalid JWT signature');
      return null;
    }
    // Decode payload
    const payloadJson = new TextDecoder().decode(decode(payloadB64));
    const payload = JSON.parse(payloadJson);
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error('JWT token expired');
      return null;
    }
    return payload;
  } catch (error) {
    console.error('Error verifying JWT:', error);
    return null;
  }
}
async function createSignature(data) {
  // Convert hex string to binary data if needed
  let keyData;
  if (JWT_SECRET.length === 128 && /^[0-9a-fA-F]+$/.test(JWT_SECRET)) {
    // It's a hex string, convert to binary
    const hexBytes = JWT_SECRET.match(/.{2}/g) || [];
    keyData = new Uint8Array(hexBytes.map((byte)=>parseInt(byte, 16)));
  } else {
    // It's a regular string, encode as UTF-8
    keyData = new TextEncoder().encode(JWT_SECRET);
  }
  const key = await crypto.subtle.importKey('raw', keyData, {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, [
    'sign'
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return encode(new Uint8Array(signature));
}
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      headers: corsHeaders,
      status: 405
    });
  }
  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({
        error: "Token is required"
      }), {
        headers: corsHeaders,
        status: 400
      });
    }
    // Verify JWT token
    console.log('Verifying JWT token...');
    const payload = await verifyJWT(token);
    if (!payload) {
      return new Response(JSON.stringify({
        error: "Invalid or expired token"
      }), {
        headers: corsHeaders,
        status: 401
      });
    }
    console.log('JWT token verified for user:', payload.userId);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    // Get user profile
    console.log('Fetching profile for user ID:', payload.userId);
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id, email, full_name, alias, email_verified, last_login_at').eq('id', payload.userId).single();
    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({
        error: "User profile not found"
      }), {
        headers: corsHeaders,
        status: 404
      });
    }
    console.log('Profile found for user:', profile.email);
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        alias: profile.alias,
        email_verified: profile.email_verified,
        last_login_at: profile.last_login_at
      }
    }), {
      headers: corsHeaders,
      status: 200
    });
  } catch (error) {
    console.error('Error in validate-token function:', error);
    return new Response(JSON.stringify({
      error: "Internal server error"
    }), {
      headers: corsHeaders,
      status: 500
    });
  }
});
