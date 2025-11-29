import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression'; // Add this
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import clientRoutes from './routes/client.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(compression()); // Add this for response compression
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Gym Management API is running',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
