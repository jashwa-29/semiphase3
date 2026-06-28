import express from 'express';
import {
  applyForExam,
  listExamApplications,
  getExamApplicationById,
  updateExamApplication,
  deleteExamApplication,
  reviewExamApplication,
  publishExamSchedule,
  generateHallTickets,
  listHallTickets,
  getHallTicketById,
  downloadHallTicket,
} from '../controllers/examController';
import { protect, authorize } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/uploadMiddleware';

const router = express.Router();

// ==========================================
// EXAM APPLICATION CRUD
// ==========================================

// GET all applications (Institute sees own | Board/Admin sees all)
// Supports filters: ?status=Pending&courseId=&batchId=
router.get('/', protect, listExamApplications);

// GET single application by ID
router.get('/:id', protect, getExamApplicationById);

// POST apply for exam (Institute — with exam fee receipt + subjects)
router.post(
  '/apply',
  protect,
  authorize('institute'),
  upload.fields([{ name: 'examFeeReceipt', maxCount: 1 }]),
  applyForExam
);

// PUT update application — subjects / students (Institute — Pending only)
router.put('/:id', protect, authorize('institute'), updateExamApplication);

// DELETE application (Institute — Pending only)
router.delete('/:id', protect, authorize('institute'), deleteExamApplication);

// ==========================================
// UC 4.2: EXAM APPROVAL & SCHEDULING (Board)
// ==========================================

// Step 1 — Board reviews (Approve / Reject) and sets scheduled date
router.put('/:id/review', protect, authorize('board', 'admin', 'super_admin'), reviewExamApplication);

// Step 2 — Board publishes full exam schedule (venue, center, reporting time)
//           Status transitions: Approved → SchedulePublished
router.put('/:id/publish-schedule', protect, authorize('board', 'admin', 'super_admin'), publishExamSchedule);

// ==========================================
// UC 4.3: HALL TICKET GENERATION
// ==========================================

// POST — System/Institute generates hall tickets (persisted to DB)
//         Requires status = SchedulePublished
router.post('/:id/generate-hall-tickets', protect, generateHallTickets);

// GET  — List all hall tickets for an application
router.get('/:id/hall-tickets', protect, listHallTickets);

// GET  — Get a single hall ticket by its ID
router.get('/:id/hall-tickets/:hid', protect, getHallTicketById);

// GET  — Download a hall ticket (marks isDownloaded=true, returns full data)
router.get('/:id/hall-tickets/:hid/download', protect, downloadHallTicket);

export default router;
