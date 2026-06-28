import express from 'express';
import { protect, authorize } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/uploadMiddleware';
import {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
  getBatchesByCourse,
  addStudent,
  recordStudentFee,
  listFeeRecords,
  getPayableAmount,
  recordRemittance,
  listStudents,
  updateAcademicMetrics,
  evaluateEligibility,
  getRemittances,
  getStudentById,
  updateStudent,
  deleteStudent,
} from '../controllers/academicController';

const router = express.Router();

// ==========================================
// COURSE CRUD Routes
// ==========================================
router.get('/courses', protect, authorize('institute', 'admin', 'board', 'super_admin'), getCourses);
router.get('/courses/:courseId', protect, authorize('institute', 'admin', 'board', 'super_admin'), getCourseById);
router.post('/courses', protect, authorize('institute'), createCourse);
router.put('/courses/:courseId', protect, authorize('institute', 'admin', 'super_admin'), updateCourse);
router.delete('/courses/:courseId', protect, authorize('institute', 'admin', 'super_admin'), deleteCourse);

// ==========================================
// BATCH CRUD Routes
// ==========================================
router.get('/batches', protect, authorize('institute', 'admin', 'board', 'super_admin'), getBatches);
router.get('/batches/:batchId', protect, authorize('institute', 'admin', 'board', 'super_admin'), getBatchById);
router.get('/batches/course/:courseId', protect, authorize('institute', 'admin', 'board', 'super_admin'), getBatchesByCourse);
router.post('/batches', protect, authorize('institute'), createBatch);
router.put('/batches/:batchId', protect, authorize('institute', 'admin', 'super_admin'), updateBatch);
router.delete('/batches/:batchId', protect, authorize('institute', 'admin', 'super_admin'), deleteBatch);

// ==========================================
// STUDENT MANAGEMENT Routes
// ==========================================
router.post(
  '/students',
  protect,
  authorize('institute'),
  upload.fields([
    { name: 'passportPhoto', maxCount: 1 },
    { name: 'mbbsCertificate', maxCount: 1 },
    { name: 'medicalCouncilRegistrationCertificate', maxCount: 1 },
    { name: 'fmgeResultCopy', maxCount: 1 },
    { name: 'paymentReceipt', maxCount: 1 },
    { name: 'semiMembershipForm', maxCount: 1 },
  ]),
  addStudent
);

// ==========================================
// STUDENT FEE RECORDING Routes
// ==========================================
router.get(
  '/students/:studentId/fees',
  protect,
  authorize('institute', 'admin', 'super_admin', 'board'),
  listFeeRecords
);
router.post(
  '/students/:studentId/fees',
  protect,
  authorize('institute'),
  upload.fields([{ name: 'paymentReceipt', maxCount: 1 }]),
  recordStudentFee
);

// GET all fee records for the institute
router.get(
  '/fees',
  protect,
  authorize('institute', 'admin', 'super_admin', 'board'),
  listFeeRecords
);

// ==========================================
// ACADEMY REMITTANCE Routes
// ==========================================
router.get('/remittance/payable', protect, authorize('institute'), getPayableAmount);
router.get('/remittance', protect, authorize('institute', 'admin', 'board', 'super_admin'), getRemittances);
router.post(
  '/remittance',
  protect,
  authorize('institute'),
  upload.fields([{ name: 'paymentReceipt', maxCount: 1 }]),
  recordRemittance
);

// ==========================================
// ELIGIBILITY ENGINE Routes
// ==========================================
router.get('/students', protect, authorize('institute', 'admin', 'board', 'super_admin'), listStudents);
router.get('/students/:studentId', protect, authorize('institute', 'admin', 'board', 'super_admin'), getStudentById);

router.put(
  '/students/:studentId',
  protect,
  authorize('institute', 'admin', 'super_admin'),
  upload.fields([
    { name: 'passportPhoto', maxCount: 1 },
    { name: 'mbbsCertificate', maxCount: 1 },
    { name: 'medicalCouncilRegistrationCertificate', maxCount: 1 },
    { name: 'fmgeResultCopy', maxCount: 1 },
    { name: 'paymentReceipt', maxCount: 1 },
    { name: 'semiMembershipForm', maxCount: 1 },
  ]),
  updateStudent
);

router.delete('/students/:studentId', protect, authorize('institute', 'admin', 'super_admin'), deleteStudent);

router.patch(
  '/students/:studentId/academic-metrics',
  protect,
  authorize('institute', 'admin', 'super_admin', 'board'),
  upload.fields([{ name: 'thesisDocument', maxCount: 1 }]),
  updateAcademicMetrics
);
router.get('/students/:studentId/eligibility', protect, authorize('institute', 'admin', 'board', 'super_admin'), evaluateEligibility);

export default router;