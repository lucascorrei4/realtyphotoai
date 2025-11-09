// auth-verify-otp Edge Function
// Verifies OTP and returns JWT token
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
// JWT service functions (embedded to avoid import issues)
const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-super-secret-jwt-key-change-this-in-production';
async function createJWT(payload) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + 365 * 24 * 60 * 60 // 1 year expiration
  };
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  const encodedHeader = encode(JSON.stringify(header));
  const encodedPayload = encode(JSON.stringify(fullPayload));
  const signature = await createSignature(`${encodedHeader}.${encodedPayload}`);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
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
// Welcome email function (embedded to avoid import issues)
async function sendWelcomeEmail({ to, userName }) {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) {
    console.log('BREVO_API_KEY not set, skipping welcome email');
    return;
  }
  const emailContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to PastorAgenda!</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to PastorAgenda!</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
          Your pastoral scheduling platform is ready
        </p>
      </div>
      
      <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e293b; margin-top: 0;">Hello ${userName}!</h2>
        
        <p style="font-size: 16px; margin-bottom: 25px;">
          Welcome to PastorAgenda! We're thrilled to have you join our community of pastors who are streamlining their appointment scheduling and connecting with their congregations more effectively.
        </p>
        
        <div style="background: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 25px; margin: 25px 0;">
          <h3 style="color: #0ea5e9; margin-top: 0;">Get Started in 3 Easy Steps:</h3>
          <ol style="color: #374151; padding-left: 20px;">
            <li style="margin-bottom: 10px;"><strong>Complete Your Profile</strong> - Add your bio, photo, and contact information</li>
            <li style="margin-bottom: 10px;"><strong>Create Agendas</strong> - Set up different types of appointments (counseling, prayer, meetings, etc.)</li>
            <li style="margin-bottom: 10px;"><strong>Share Your Link</strong> - Give your congregation your unique booking link</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://pastoragenda.com/dashboard" 
             style="background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Go to Your Dashboard
          </a>
        </div>
        
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">💡 Pro Tips:</h3>
          <ul style="color: #b45309; margin: 0; padding-left: 20px;">
            <li>Set your availability to match your schedule</li>
            <li>Add custom questions to gather important information</li>
            <li>Use the mobile app for on-the-go management</li>
          </ul>
        </div>
        
        <p style="font-size: 14px; color: #64748b; margin-top: 30px;">
          Need help getting started? Our support team is here to assist you every step of the way.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; padding: 20px; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          © 2025 PastorAgenda. All rights reserved.<br>
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `;
  const emailPayload = {
    sender: {
      name: "PastorAgenda",
      email: "welcome@pastoragenda.com"
    },
    to: [
      {
        email: to
      }
    ],
    subject: "Welcome to PastorAgenda! 🎉",
    htmlContent: emailContent
  };
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "api-key": brevoApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emailPayload)
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Brevo API error for welcome email:", errorBody);
      return;
    }
    const data = await response.json();
    console.log('Welcome email sent successfully:', data.messageId);
  } catch (apiError) {
    console.error('Error sending welcome email:', apiError);
  }
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
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { email, otp } = await req.json();
    if (!email || !otp) {
      return new Response(JSON.stringify({
        error: "Email and OTP are required"
      }), {
        headers: corsHeaders,
        status: 400
      });
    }
    // App Store Reviewer Exception
    const REVIEWER_EMAIL = 'pastoragendaapp@gmail.com';
    const REVIEWER_PASSWORD = '000000';
    let isValid = false;
    let isReviewerAccount = false;
    if (email === REVIEWER_EMAIL && otp === REVIEWER_PASSWORD) {
      console.log('App Store reviewer account detected, bypassing OTP verification');
      isValid = true;
      isReviewerAccount = true;
    } else {
      // Verify OTP for regular users
      console.log('Verifying OTP for email:', email);
      const { data: otpValid, error: verifyError } = await supabase.rpc('verify_otp', {
        user_email: email,
        otp_code: otp
      });
      if (verifyError) {
        console.error('Error verifying OTP:', verifyError);
        return new Response(JSON.stringify({
          error: "Failed to verify OTP"
        }), {
          headers: corsHeaders,
          status: 500
        });
      }
      isValid = otpValid;
    }
    if (!isValid) {
      return new Response(JSON.stringify({
        error: "Invalid or expired OTP"
      }), {
        headers: corsHeaders,
        status: 400
      });
    }
    // Get or create user profile
    console.log('Fetching profile for email:', email);
    let { data: profile, error: profileError } = await supabase.from('profiles').select('id, email, full_name, alias, email_verified, created_at').eq('email', email).single();
    let isNewUser = false;
    // If profile doesn't exist, create it for new users
    if (profileError && profileError.code === 'PGRST116') {
      console.log('Profile not found, creating new user profile for:', email);
      // Special handling for reviewer account
      let fullName, alias;
      if (isReviewerAccount) {
        fullName = 'App Store Reviewer';
        alias = 'app-store-reviewer';
      } else {
        // Generate a unique alias for regular new users
        const emailPrefix = email.split('@')[0];
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        alias = `${emailPrefix}-${randomSuffix}`;
        fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      }
      // Create new profile
      const { data: newProfile, error: createError } = await supabase.from('profiles').insert({
        id: crypto.randomUUID(),
        email: email,
        full_name: fullName,
        alias: alias,
        email_verified: true,
        last_login_at: new Date().toISOString()
      }).select('id, email, full_name, alias, email_verified, created_at').single();
      if (createError || !newProfile) {
        console.error('Error creating profile:', createError);
        return new Response(JSON.stringify({
          error: "Failed to create user profile"
        }), {
          headers: corsHeaders,
          status: 500
        });
      }
      profile = newProfile;
      isNewUser = true;
      console.log('New user profile created:', profile.id);
      // Create default event types for new users (skip for reviewer account)
      if (!isReviewerAccount) {
        try {
          console.log('Creating default event types for new user:', profile.id);
          // Default event types with translation keys
          const defaultEventTypes = [
            {
              user_id: profile.id,
              title: 'defaultEventTypes.pastoralCounseling.title',
              duration: 60,
              description: 'defaultEventTypes.pastoralCounseling.description',
              availability_rules: {
                monday: [
                  {
                    from: '09:00',
                    to: '17:00'
                  }
                ],
                tuesday: [
                  {
                    from: '09:00',
                    to: '17:00'
                  }
                ],
                wednesday: [
                  {
                    from: '09:00',
                    to: '17:00'
                  }
                ],
                thursday: [
                  {
                    from: '09:00',
                    to: '17:00'
                  }
                ],
                friday: [
                  {
                    from: '09:00',
                    to: '17:00'
                  }
                ],
                saturday: [],
                sunday: []
              },
              custom_questions: []
            },
            {
              user_id: profile.id,
              title: 'defaultEventTypes.prayerMeeting.title',
              duration: 30,
              description: 'defaultEventTypes.prayerMeeting.description',
              availability_rules: {
                monday: [
                  {
                    from: '10:00',
                    to: '16:00'
                  }
                ],
                tuesday: [
                  {
                    from: '10:00',
                    to: '16:00'
                  }
                ],
                wednesday: [
                  {
                    from: '10:00',
                    to: '16:00'
                  }
                ],
                thursday: [
                  {
                    from: '10:00',
                    to: '16:00'
                  }
                ],
                friday: [
                  {
                    from: '10:00',
                    to: '16:00'
                  }
                ],
                saturday: [],
                sunday: []
              },
              custom_questions: []
            },
            {
              user_id: profile.id,
              title: 'defaultEventTypes.ministryMeeting.title',
              duration: 45,
              description: 'defaultEventTypes.ministryMeeting.description',
              availability_rules: {
                monday: [
                  {
                    from: '14:00',
                    to: '18:00'
                  }
                ],
                tuesday: [
                  {
                    from: '14:00',
                    to: '18:00'
                  }
                ],
                wednesday: [
                  {
                    from: '14:00',
                    to: '18:00'
                  }
                ],
                thursday: [
                  {
                    from: '14:00',
                    to: '18:00'
                  }
                ],
                friday: [
                  {
                    from: '14:00',
                    to: '18:00'
                  }
                ],
                saturday: [],
                sunday: []
              },
              custom_questions: []
            }
          ];
          const { error: eventTypesError } = await supabase.from('event_types').insert(defaultEventTypes);
          if (eventTypesError) {
            console.error('Error creating default event types:', eventTypesError);
          // Don't fail the request if default event types creation fails
          } else {
            console.log('Default event types created successfully for user:', profile.id);
          }
        } catch (eventTypesError) {
          console.error('Error creating default event types:', eventTypesError);
        // Don't fail the request if default event types creation fails
        }
      }
    } else if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({
        error: "Failed to fetch user profile"
      }), {
        headers: corsHeaders,
        status: 500
      });
    } else {
      // Update last login time for existing user
      console.log('Updating last login for existing user:', profile.id);
      await supabase.from('profiles').update({
        last_login_at: new Date().toISOString(),
        email_verified: true
      }).eq('id', profile.id);
    }
    // Use the isNewUser flag we set during profile creation/fetching
    // Create JWT token
    const token = await createJWT({
      userId: profile.id,
      email: profile.email,
      emailVerified: profile.email_verified
    });
    // Send welcome email for new users
    if (isNewUser) {
      try {
        console.log('Sending welcome email to new user:', profile.email);
        await sendWelcomeEmail({
          to: profile.email,
          userName: profile.full_name || 'Pastor'
        });
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
      // Don't fail the request if welcome email fails
      }
    }
    return new Response(JSON.stringify({
      success: true,
      token,
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        alias: profile.alias,
        email_verified: profile.email_verified
      },
      isNewUser
    }), {
      headers: corsHeaders,
      status: 200
    });
  } catch (error) {
    console.error('Error in verify-otp function:', error);
    return new Response(JSON.stringify({
      error: "Internal server error"
    }), {
      headers: corsHeaders,
      status: 500
    });
  }
});
gt