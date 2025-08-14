import { Router } from 'express';
import authRoutes from './auth';
import companyRoutes from './companies';
import whatsappRoutes from './whatsapp';
import adminRoutes from './admin';
import analyticsRoutes from './analytics';

const router = Router();

// Unified API v1 structure
router.use('/auth', authRoutes);
router.use('/companies', companyRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/admin', adminRoutes);
router.use('/analytics', analyticsRoutes);

export default router;