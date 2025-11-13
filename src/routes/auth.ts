import express from 'express';
import authService from '../services/authService';
import { ConversionEventPayload } from '../services/conversionEventService';
import { ConversionEventService } from '../services/conversionEventService';
import { authenticateToken } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';

const router = express.Router();

const buildConversionMetadata = (req: express.Request): Partial<ConversionEventPayload> => {
  const forwardedForHeader = req.headers['x-forwarded-for'];
  const forwardedFor = Array.isArray(forwardedForHeader) ? forwardedForHeader[0] : forwardedForHeader;
  const userAgentHeader = req.headers['user-agent'];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
  const refererHeader = req.headers.referer || req.headers.referrer;
  const referer = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader;

  const ipCandidate = forwardedFor?.split(',')[0]?.trim() ?? req.ip;
  const amount = typeof req.body.amount === 'number' ? req.body.amount : undefined;
  const currency = typeof req.body.currency === 'string' ? req.body.currency : undefined;
  const createdAt = typeof req.body.createdAt === 'string' ? req.body.createdAt : undefined;

  const metadata: Partial<ConversionEventPayload> = {};

  if (typeof req.body.firstName === 'string') {
    metadata.firstName = req.body.firstName;
  }

  if (typeof req.body.lastName === 'string') {
    metadata.lastName = req.body.lastName;
  }

  if (typeof req.body.phone === 'string') {
    metadata.phone = req.body.phone;
  }

  if (typeof req.body.fbp === 'string') {
    metadata.fbp = req.body.fbp;
  }

  if (typeof req.body.fbc === 'string') {
    metadata.fbc = req.body.fbc;
  }

  if (typeof userAgent === 'string') {
    metadata.userAgent = userAgent;
  }

  if (typeof ipCandidate === 'string' && ipCandidate.length > 0) {
    metadata.ip = ipCandidate;
  }

  if (amount !== undefined) {
    metadata.amount = amount;
  }

  if (currency) {
    metadata.currency = currency;
  }

  if (createdAt) {
    metadata.createdAt = createdAt;
  }

  if (typeof req.body.externalId === 'string') {
    metadata.externalId = req.body.externalId;
  }

  // Extract UTM parameters from query string
  const queryUtm = req.query;
  if (typeof queryUtm.utm_source === 'string') {
    metadata.utmSource = queryUtm.utm_source;
  }
  if (typeof queryUtm.utm_medium === 'string') {
    metadata.utmMedium = queryUtm.utm_medium;
  }
  if (typeof queryUtm.utm_campaign === 'string') {
    metadata.utmCampaign = queryUtm.utm_campaign;
  }
  if (typeof queryUtm.utm_content === 'string') {
    metadata.utmContent = queryUtm.utm_content;
  }
  if (typeof queryUtm.utm_term === 'string') {
    metadata.utmTerm = queryUtm.utm_term;
  }

  // Also check request body for UTM parameters
  if (typeof req.body.utmSource === 'string') {
    metadata.utmSource = req.body.utmSource;
  }
  if (typeof req.body.utmMedium === 'string') {
    metadata.utmMedium = req.body.utmMedium;
  }
  if (typeof req.body.utmCampaign === 'string') {
    metadata.utmCampaign = req.body.utmCampaign;
  }
  if (typeof req.body.utmContent === 'string') {
    metadata.utmContent = req.body.utmContent;
  }
  if (typeof req.body.utmTerm === 'string') {
    metadata.utmTerm = req.body.utmTerm;
  }

  // Extract UTM from referer URL if no explicit UTM parameters found
  if (referer && !metadata.utmSource && !metadata.utmMedium && !metadata.utmCampaign) {
    const refererUtm = ConversionEventService.extractUtmParameters(referer);
    if (refererUtm.utm_source) {
      metadata.utmSource = refererUtm.utm_source;
    }
    if (refererUtm.utm_medium) {
      metadata.utmMedium = refererUtm.utm_medium;
    }
    if (refererUtm.utm_campaign) {
      metadata.utmCampaign = refererUtm.utm_campaign;
    }
    if (refererUtm.utm_content) {
      metadata.utmContent = refererUtm.utm_content;
    }
    if (refererUtm.utm_term) {
      metadata.utmTerm = refererUtm.utm_term;
    }
  }

  // Set eventSourceUrl if referer is present
  if (referer) {
    metadata.eventSourceUrl = referer;
  }

  return metadata;
};

// Send authentication code to email
router.post('/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const conversionMetadata = buildConversionMetadata(req);
    const result = await authService.sendAuthCode(email, conversionMetadata);
    return res.json(result);
  } catch (error) {
    logger.error('Error sending auth code:', error as Error);
    return res.status(500).json({ error: 'Failed to send authentication code' });
  }
});

// Verify code and authenticate user
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const conversionMetadata = buildConversionMetadata(req);
    const result = await authService.verifyCode(email, code, conversionMetadata);
    return res.json(result);
  } catch (error) {
    logger.error('Error verifying code:', error as Error);
    return res.status(500).json({ error: 'Failed to verify authentication code' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const profile = await authService.getUserProfile(userId);
    
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    return res.json(profile);
  } catch (error) {
    logger.error('Error getting user profile:', error as Error);
    return res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { name, phone } = req.body;
    
    const success = await authService.updateUserProfile(userId, { name, phone });
    if (success) {
      const updatedProfile = await authService.getUserProfile(userId);
      return res.json(updatedProfile);
    } else {
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  } catch (error) {
    logger.error('Error updating user profile:', error as Error);
    return res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Get user statistics
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const stats = await authService.getUserStatistics(userId);
    return res.json(stats);
  } catch (error) {
    logger.error('Error getting user statistics:', error as Error);
    return res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

// Refresh user token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const newToken = await authService.generateTokenFromId(userId);
    return res.json({ token: newToken });
  } catch (error) {
    logger.error('Error refreshing token:', error as Error);
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
});

export default router;
