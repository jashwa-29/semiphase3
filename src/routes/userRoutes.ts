import express from 'express';
import { getUsers, createAdmin } from '../controllers/userController';
import { protect, authorize } from '../middlewares/authMiddleware';

const router = express.Router();

router.route('/').get(protect, authorize('super_admin'), getUsers);
router.post('/create-admin', protect, authorize('super_admin'), createAdmin);

export default router;
