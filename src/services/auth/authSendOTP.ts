// auth-send-otp Edge Function
// Sends OTP to user email for authentication
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
// Email service function using the Brevo (Sendinblue) REST API
async function sendOTPEmail({ to, otpCode, isNewUser }) {
  console.log('Starting email send process with Brevo API...');
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) {
    console.error("BREVO_API_KEY environment variable is not set.");
    throw new Error("Email service is not configured.");
  }
  const subject = isNewUser ? "Welcome to PastorAgenda - Verify Your Email" : "Your PastorAgenda Login Code";
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">PastorAgenda</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
          ${isNewUser ? 'Welcome to your pastoral scheduling platform!' : 'Your secure login code'}
        </p>
      </div>
      
      <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e293b; margin-top: 0;">
          ${isNewUser ? 'Welcome! Verify Your Email' : 'Your Login Code'}
        </h2>
        
        <p style="font-size: 16px; margin-bottom: 25px;">
          ${isNewUser ? `Welcome to PastorAgenda! We're excited to help you manage your pastoral appointments and schedule.` : `Here's your secure login code for PastorAgenda.`}
        </p>
        
        <div style="background: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 25px; text-align: center; margin: 25px 0;">
          <p style="margin: 0 0 15px 0; color: #64748b; font-size: 14px;">Your verification code:</p>
          <div style="background: #0ea5e9; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 15px; border-radius: 6px; display: inline-block; font-family: monospace;">
            ${otpCode}
          </div>
        </div>
        
        <p style="font-size: 14px; color: #64748b; margin: 20px 0;">
          This code will expire in <strong>10 minutes</strong> for your security.
        </p>
        
        ${isNewUser ? `
        <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="color: #065f46; margin: 0 0 10px 0; font-size: 16px;">What's Next?</h3>
          <ul style="color: #047857; margin: 0; padding-left: 20px;">
            <li>Verify your email with the code above</li>
            <li>Set up your pastoral profile</li>
            <li>Create your first event type</li>
            <li>Start receiving appointment bookings</li>
          </ul>
        </div>
        ` : ''}
        
        <p style="font-size: 14px; color: #64748b; margin-top: 30px;">
          If you didn't request this code, please ignore this email. Your account remains secure.
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
  `.trim();
  const emailPayload = {
    sender: {
      name: "PastorAgenda",
      email: "noreply@pastoragenda.com"
    },
    to: [
      {
        email: to
      }
    ],
    subject: subject,
    htmlContent: htmlContent
  };
  try {
    console.log('Sending email via Brevo API to:', to);
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
      console.error("Brevo API error response:", errorBody);
      throw new Error(`Failed to send email. Status: ${response.status}, Response: ${errorBody}`);
    }
    const data = await response.json();
    console.log('Email sent successfully via Brevo API:', data.messageId);
  } catch (apiError) {
    console.error('Error calling Brevo API:', apiError);
    throw apiError;
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
    const { email } = await req.json();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return new Response(JSON.stringify({
        error: "Valid email address is required"
      }), {
        headers: corsHeaders,
        status: 400
      });
    }
    // App Store Reviewer Exception - Skip OTP generation and email sending
    const REVIEWER_EMAIL = 'pastoragendaapp@gmail.com';
    if (email === REVIEWER_EMAIL) {
      console.log('App Store reviewer account detected, skipping OTP generation and email sending');
      return new Response(JSON.stringify({
        message: "OTP sent successfully",
        success: true
      }), {
        headers: corsHeaders,
        status: 200
      });
    }
    // Check if user exists to determine if this is a new user
    const { data: existingUser } = await supabase.from('profiles').select('id').eq('email', email).single();
    const isNewUser = !existingUser;
    // Generate and store OTP using database function
    console.log('Attempting to call send_otp function for email:', email);
    const { data: otpCode, error: otpError } = await supabase.rpc('send_otp', {
      user_email: email
    });
    let finalOtpCode = otpCode;
    if (otpError || !finalOtpCode) {
      console.error('Error generating OTP from DB or OTP is null:', otpError);
      // Fallback: Generate OTP directly if database function fails
      console.log('Using fallback OTP generation');
      finalOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
      console.log('Fallback OTP generated:', finalOtpCode);
    }
    if (!finalOtpCode) {
      console.error('No OTP code available');
      return new Response(JSON.stringify({
        error: "No OTP code generated"
      }), {
        headers: corsHeaders,
        status: 500
      });
    }
    console.log(`Generated OTP for ${email}: ${finalOtpCode}`);
    // Send OTP email
    try {
      await sendOTPEmail({
        to: email,
        otpCode: finalOtpCode,
        isNewUser: isNewUser
      });
      console.log('Email process completed successfully for:', email);
    } catch (emailError) {
      console.error("Error sending OTP email:", emailError);
    // Don't fail the request if email fails - OTP is still generated
    }
    return new Response(JSON.stringify({
      message: "OTP sent successfully",
      success: true
    }), {
      headers: corsHeaders,
      status: 200
    });
  } catch (error) {
    console.error("Error in main handler:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: error.message
    }), {
      headers: corsHeaders,
      status: 500
    });
  }
});
