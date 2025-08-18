import express from 'express';
import authService from '../services/authService';
import { authenticateToken } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';

const router = express.Router();

// Send authentication code to email
router.post('/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await authService.sendAuthCode(email);
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

    const result = await authService.verifyCode(email, code);
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
