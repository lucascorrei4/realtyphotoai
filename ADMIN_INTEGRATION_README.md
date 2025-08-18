# RealtyPhotoAI Admin Integration

This document provides a comprehensive guide to setting up and using the new admin integration system for RealtyPhotoAI.

## 🚀 Features

### Authentication System
- **Email + Code Authentication**: Simple login/signup with email verification codes
- **Automatic Account Creation**: New users get accounts automatically on first login
- **JWT Token Management**: Secure session management with JWT tokens
- **Role-Based Access Control**: User, Admin, and Super Admin roles

### User Management
- **Subscription Plans**: Free, Basic, Premium, and Enterprise tiers
- **Usage Tracking**: Monitor generation counts and success rates per user
- **Model Access Control**: Restrict AI model access based on subscription plans
- **User Statistics**: Detailed analytics for each user

### Admin Dashboard
- **System Overview**: Real-time system statistics and metrics
- **User Management**: View, edit, and manage all users
- **Plan Management**: Configure subscription plans and limits
- **System Settings**: Control global system parameters

### Database Integration
- **Supabase Backend**: PostgreSQL database with Row Level Security
- **Automatic Triggers**: Real-time user statistics updates
- **Scalable Architecture**: Built for production use

## 🛠️ Setup Instructions

### 1. Database Setup

#### Run the Supabase SQL Script
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase-setup.sql`
4. Execute the script

#### Get Your Supabase Credentials
1. Go to Project Settings > API
2. Copy the following values:
   - Project URL
   - `service_role` key (for backend)
   - `anon` key (for frontend)

### 2. Backend Configuration

#### Install Dependencies
```bash
npm install @supabase/supabase-js jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

#### Environment Variables
Create a `.env` file in your backend root:
```env
# Supabase Configuration
SUPABASE_URL=https://suqyzhfeifogeupavirb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret_here

# Other existing variables...
```

### 3. Frontend Configuration

#### Install Dependencies
```bash
cd frontend
npm install @supabase/supabase-js recharts
```

#### Environment Variables
Create a `.env` file in your frontend directory:
```env
REACT_APP_SUPABASE_URL=https://suqyzhfeifogeupavirb.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
REACT_APP_API_BASE_URL=http://localhost:3000/api
```

### 4. Create Your First Super Admin

After setting up the database and creating your first user through the frontend:

1. Go to your Supabase SQL Editor
2. Run this command (replace with your actual user ID):
```sql
UPDATE public.user_profiles 
SET role = 'super_admin' 
WHERE email = 'your-email@example.com';
```

## 📊 Database Schema

### Core Tables

#### `user_profiles`
- Extends Supabase auth.users
- Stores user subscription and usage data
- Tracks generation limits and statistics

#### `generations`
- Records all AI generation attempts
- Tracks success/failure rates
- Links to user profiles

#### `plan_rules`
- Defines subscription plan limits
- Controls model access permissions
- Configurable pricing and features

#### `admin_settings`
- System-wide configuration
- Rate limiting and maintenance settings
- Plan default configurations

### Key Functions

#### `get_user_statistics(user_uuid)`
Returns comprehensive user statistics including:
- Total generations
- Success rate percentage
- Monthly usage vs. limits
- Model breakdown

#### `check_user_generation_limit(user_uuid, model_type)`
Validates if a user can perform a generation:
- Checks monthly limits
- Verifies model access permissions
- Returns boolean result

## 🔐 Authentication Flow

### 1. User Requests Code
```
POST /api/auth/send-code
Body: { "email": "user@example.com" }
```

### 2. User Verifies Code
```
POST /api/auth/verify-code
Body: { "email": "user@example.com", "code": "123456" }
```

### 3. JWT Token Issued
- Token contains user ID, role, and subscription plan
- Valid for 7 days by default
- Used for all subsequent API calls

## 🎯 API Endpoints

### Authentication Routes
- `POST /api/auth/send-code` - Send verification code
- `POST /api/auth/verify-code` - Verify code and login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `GET /api/auth/statistics` - Get user statistics

### Admin Routes
- `GET /api/admin/stats` - System overview statistics
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/:id` - Update user
- `PATCH /api/admin/users/:id/toggle-status` - Activate/deactivate user
- `PATCH /api/admin/users/:id/change-plan` - Change user subscription
- `GET /api/admin/plans` - List all plans
- `PUT /api/admin/plans/:id` - Update plan rules

## 🎨 Frontend Components

### Pages
- **`/auth`** - Login/signup page
- **`/settings`** - User settings and statistics
- **`/admin`** - Admin dashboard (admin only)

### Key Components
- **AuthContext** - Manages authentication state
- **ProtectedRoute** - Guards routes requiring authentication
- **AdminRoute** - Guards admin-only routes

## 🔒 Security Features

### Row Level Security (RLS)
- Users can only access their own data
- Admins can view all user data
- Super admins have full system access

### JWT Token Security
- Tokens expire after 7 days
- Contains minimal user information
- Verified on every protected request

### Rate Limiting
- Configurable per-endpoint limits
- Prevents abuse and ensures fair usage
- Separate limits for processing endpoints

## 📈 Usage Tracking

### What Gets Tracked
- **Generation Attempts**: Every AI model usage
- **Success Rates**: Percentage of successful generations
- **Model Usage**: Breakdown by AI model type
- **Monthly Limits**: Usage vs. subscription limits

### Statistics Available
- Total generations (lifetime)
- Monthly usage and remaining quota
- Success rate percentage
- Model-specific usage counts

## 🚀 Production Deployment

### Environment Variables
Ensure all environment variables are set in production:
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` (use a strong, unique secret)
- `NODE_ENV=production`

### Security Considerations
- Use HTTPS in production
- Set appropriate CORS origins
- Monitor rate limiting effectiveness
- Regular security audits

### Scaling
- Supabase handles database scaling automatically
- Consider Redis for session management in high-traffic scenarios
- Implement proper logging and monitoring

## 🐛 Troubleshooting

### Common Issues

#### "SUPABASE_SERVICE_ROLE_KEY is required"
- Check your `.env` file
- Ensure the key is copied correctly from Supabase
- Restart your backend server

#### "User profile not found"
- Verify the database setup script ran successfully
- Check if RLS policies are enabled
- Ensure user exists in `user_profiles` table

#### Authentication failures
- Verify JWT_SECRET is set correctly
- Check token expiration
- Ensure proper Authorization headers

### Debug Mode
Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

## 📚 Additional Resources

### Supabase Documentation
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Functions](https://supabase.com/docs/guides/database/functions)
- [API Reference](https://supabase.com/docs/reference/javascript/introduction)

### JWT Best Practices
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [Token Management](https://auth0.com/docs/secure/tokens)

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase logs in your dashboard
3. Check backend logs for detailed error messages
4. Verify database schema matches the setup script

---

**Note**: This integration system is designed to be production-ready but should be thoroughly tested in your specific environment before deployment.
