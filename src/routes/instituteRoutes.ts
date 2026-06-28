import express from 'express';
import { 
  applyInstitute, 
  createRazorpayOrder, 
  verifyRazorpayPayment, 
  reviewApplication,
  getMyApplication,
  listApplications,
  toggleInspection
} from '../controllers/instituteController';
import { protect, authorize } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/uploadMiddleware';

const router = express.Router();

// Get current institute's application
router.get('/my-application', protect, authorize('institute'), getMyApplication);

// Submit application
router.post(
  '/apply',
  protect,
  authorize('institute'),
  upload.fields([
    { name: 'facultyCommitmentLetter', maxCount: 1 },
    { name: 'equipmentList', maxCount: 1 },
    { name: 'facultyList', maxCount: 1 },
    { name: 'emergencyOPDStatistics', maxCount: 1 },
    { name: 'libraryBookList', maxCount: 1 },
    { name: 'trainingMannequinList', maxCount: 1 },
    { name: 'diagnosticEquipmentList', maxCount: 1 },
    { name: 'declarationLetter', maxCount: 1 },
    { name: 'inspectionPaymentReceipt', maxCount: 1 },
    { name: 'applicantSignature', maxCount: 1 },
    { name: 'hodSignatureAndSeal', maxCount: 1 },
    { name: 'headOfInstitutionSignatureAndSeal', maxCount: 1 },
  ]),
  applyInstitute
);

// Razorpay payment endpoints
router.post('/payment/create-order', protect, authorize('institute'), createRazorpayOrder);
router.post('/payment/verify', protect, authorize('institute'), verifyRazorpayPayment);

// Legacy/backwards compatibility route for older clients or postman scripts
router.post('/payment', protect, authorize('institute'), verifyRazorpayPayment);

// Board routes
router.get('/applications', protect, authorize('board', 'admin', 'super_admin'), listApplications);
router.post('/:instituteId/review', protect, authorize('board', 'admin', 'super_admin'), reviewApplication);
router.patch('/:instituteId/inspection', protect, authorize('board', 'admin', 'super_admin'), toggleInspection);

export default router;
