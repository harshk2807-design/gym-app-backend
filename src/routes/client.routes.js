import express from 'express';
import {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  renewPlan,
  addPayment,
  bulkDelete,
} from '../controllers/client.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes
router.use(authenticate);

router.get('/', getAllClients);
router.get('/:id', getClientById);
router.post('/', createClient);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);
router.post('/:id/renew', renewPlan);
router.post('/:id/payment', addPayment);
router.post('/bulk-delete', bulkDelete);


export default router;
