# Stripe Integration for RealVisionAI

This document explains how to set up and use the Stripe integration for subscription management in RealVisionAI.

## Overview

The Stripe integration provides:
- Subscription plan management
- Automatic billing
- Webhook handling for subscription events
- Admin dashboard for plan management
- Database synchronization with Stripe

## Prerequisites

1. **Stripe Account**: Create a Stripe account at [stripe.com](https://stripe.com)
2. **Node.js Backend**: Ensure your backend is running with the updated code
3. **Supabase Database**: Run the database migration script
4. **Environment Variables**: Configure Stripe API keys

## Setup Instructions

### 1. Database Migration

Run the SQL script in your Supabase SQL editor:

```sql
-- Run the contents of stripe-integration-update.sql
```

This script will:
- Add Stripe-related columns to existing tables
- Create new tables for subscriptions and webhooks
- Set up RLS policies and functions
- Create views for easy data access

### 2. Environment Configuration

Add these variables to your `.env` file:

```bash
# Stripe Configuration


```

### 3. Stripe Dashboard Setup

#### Create Products and Prices

1. Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/products)
2. Create products for each subscription plan:
   - **Free Plan**: $0/month
   - **Basic Plan**: $19.99/month
   - **Premium Plan**: $49.99/month
   - **Enterprise Plan**: $199.99/month

3. For each product, create recurring prices:
   - Set billing interval to "monthly"
   - Set currency to "USD"
   - Add metadata:
     - `plan_name`: The plan identifier (e.g., "basic", "premium")
     - `monthly_limit`: Generation limit (e.g., "100", "500")
     - `concurrent_limit`: Concurrent generations (e.g., "2", "5")

#### Webhook Configuration

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to your environment variables

### 4. Backend Installation

Install the Stripe package:

```bash
npm install stripe
```

### 5. Frontend Updates

The AdminDashboard has been updated with:
- Stripe integration tab
- Plan management with Stripe sync
- Real-time subscription status
- Webhook monitoring

## Usage

### Admin Dashboard

#### Plans Tab
- View all subscription plans
- Create new plans (automatically creates Stripe products)
- Edit existing plans
- Delete plans (archives Stripe products)
- Sync plans with Stripe

#### Stripe Tab
- Monitor Stripe integration status
- View webhook configuration
- Sync products and prices
- Check subscription counts

### API Endpoints

#### Plan Management
- `GET /api/admin/plans` - Get all plans
- `POST /api/admin/plans` - Create new plan
- `PUT /api/admin/plans/:id` - Update plan
- `DELETE /api/admin/plans/:id` - Delete plan

#### Stripe Integration
- `GET /api/admin/stripe/products` - Get Stripe products
- `POST /api/admin/stripe/sync` - Sync with Stripe

### Database Functions

The integration provides several database functions:

```sql
-- Get user subscription summary
SELECT get_user_subscription_summary('user-uuid');

-- Get plan pricing information
SELECT * FROM get_plan_pricing_info();

-- Update subscription status
SELECT update_subscription_status('sub_id', 'active', '2024-01-01', '2024-02-01');
```

## Subscription Flow

### 1. User Signs Up
- User creates account (gets free plan by default)
- No Stripe customer created yet

### 2. User Subscribes
- Frontend creates Stripe checkout session
- User completes payment
- Stripe webhook creates subscription record
- User plan is automatically updated

### 3. Subscription Management
- Users can upgrade/downgrade plans
- Cancellations are handled via Stripe
- Failed payments trigger automatic plan changes

### 4. Billing
- Monthly recurring charges
- Automatic invoice generation
- Payment failure handling

## Webhook Handling

The system automatically handles these Stripe events:

- **Subscription Created**: Creates local subscription record
- **Subscription Updated**: Updates plan and limits
- **Subscription Deleted**: Downgrades user to free plan
- **Payment Succeeded**: Ensures subscription remains active
- **Payment Failed**: Marks subscription as past due

## Security Features

- **Row Level Security (RLS)**: Users can only access their own data
- **Admin-only Access**: Stripe management requires admin privileges
- **Webhook Verification**: Ensures webhook authenticity
- **API Key Protection**: Stripe keys are stored securely

## Testing

### Test Mode
Use Stripe test keys for development:
- Test card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

### Test Scenarios
1. Create subscription
2. Update subscription
3. Cancel subscription
4. Handle payment failure
5. Test webhook delivery

## Production Deployment

### 1. Switch to Live Keys
- Replace test keys with live keys
- Update webhook endpoints
- Test with small amounts

### 2. Monitoring
- Monitor webhook delivery
- Check subscription sync status
- Review payment success rates

### 3. Backup
- Regular database backups
- Stripe data export
- Webhook event logs

## Troubleshooting

### Common Issues

#### Webhook Not Receiving Events
- Check webhook endpoint URL
- Verify webhook secret
- Check server logs for errors

#### Plans Not Syncing
- Verify Stripe API keys
- Check plan metadata format
- Review database permissions

#### Subscription Not Updating
- Check webhook event processing
- Verify database triggers
- Review RLS policies

### Debug Commands

```sql
-- Check webhook events
SELECT * FROM stripe_webhook_events ORDER BY created_at DESC;

-- View subscription status
SELECT * FROM stripe_subscriptions WHERE status = 'active';

-- Check plan rules
SELECT * FROM plan_rules WHERE is_active = true;
```

## Support

For issues with:
- **Stripe Integration**: Check webhook logs and API responses
- **Database**: Verify SQL functions and triggers
- **Frontend**: Check browser console and network requests
- **Backend**: Review server logs and error messages

## Next Steps

1. **Implement Frontend Checkout**: Add Stripe Elements for payment
2. **Add Usage Tracking**: Monitor generation limits
3. **Implement Dunning**: Handle failed payments gracefully
4. **Add Analytics**: Track subscription metrics
5. **Multi-currency Support**: Add support for different currencies

## Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Checkout](https://stripe.com/docs/checkout)
- [Stripe Billing](https://stripe.com/docs/billing)
