import express from 'express';
import { login, register, getProfile } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/profile', authenticate, getProfile);

export default router;
