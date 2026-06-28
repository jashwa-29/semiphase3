import { Request, Response } from 'express';
import { z } from 'zod';
import { ExamApplication } from '../models/examApplicationModel';
import { HallTicket } from '../models/hallTicketModel';
import { Student } from '../models/studentModel';
import { Institute } from '../models/instituteModel';
import { Course } from '../models/courseModel';
import { Batch } from '../models/batchModel';
import { sendSuccess, sendError } from '../utils/responseFormatter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getFileUrl = (filePath: string) => {
  if (filePath.startsWith('http')) return filePath;
  const normalized = filePath.replace(/\\/g, '/');
  const uploadsIndex = normalized.indexOf('uploads/');
  return uploadsIndex !== -1
    ? `${process.env.BASE_URL || 'http://localhost:5000'}/${normalized.substring(uploadsIndex)}`
    : filePath;
};

/** Resolve the institute document for the logged-in institute user */
const resolveInstitute = async (userId: string) =>
  Institute.findOne({ user: userId, status: 'Approved' });

/** Ensure the institute role user owns this application */
const assertOwnership = async (application: any, userId: string) => {
  const institute = await Institute.findOne({ user: userId });
  return institute && institute._id.toString() === application.institute.toString();
};

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const parseJsonArray = (val: unknown): unknown => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return [val]; }
  }
  return val;
};

const jsonStringArray = z.preprocess(parseJsonArray, z.array(z.string().min(1)));

const examApplySchema = z.object({
  courseId:   z.string().min(1, 'Course ID is required'),
  batchId:    z.string().min(1, 'Batch ID is required'),
  studentIds: z.preprocess(parseJsonArray, z.array(z.string().min(1)).min(1, 'At least one student must be selected')),
  utrNumber:  z.string().optional(),
  subjects:   z.preprocess(parseJsonArray, z.array(z.string().min(1)).min(1, 'At least one subject is required')),
});

const examUpdateSchema = z.object({
  subjects:   z.preprocess(parseJsonArray, z.array(z.string().min(1)).min(1)).optional(),
  studentIds: z.array(z.string().min(1)).min(1).optional(),
});

const reviewExamSchema = z.object({
  status:        z.enum(['Approved', 'Rejected']),
  scheduledDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  remarks:       z.string().optional(),
});

const publishScheduleSchema = z.object({
  examVenue:     z.string().min(1, 'Exam venue is required'),
  examCenter:    z.string().min(1, 'Exam center is required'),
  reportingTime: z.string().min(1, 'Reporting time is required'),
  scheduledDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  subjectSchedules: z.array(z.object({
    subject: z.string(),
    date: z.string().transform(val => new Date(val)),
    time: z.string()
  })).optional(),
});

// ─── UC 4.1: Apply for Exam (Institute) ──────────────────────────────────────

export const applyForExam = async (req: Request, res: Response) => {
  try {
    const validatedData = examApplySchema.parse(req.body);

    const institute = await resolveInstitute(req.user._id);
    if (!institute) {
      return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
    }

    // Optional exam fee receipt
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const examFeeReceiptUrl = files?.['examFeeReceipt']?.length ? getFileUrl(files['examFeeReceipt'][0].path) : undefined;

    // Verify course & batch
    const course = await Course.findOne({ _id: validatedData.courseId, institute: institute._id });
    if (!course) return sendError({ req, res, statusCode: 404, message: 'Specified Course does not exist under this institute.' });

    const batch = await Batch.findOne({ _id: validatedData.batchId, course: course._id });
    if (!batch) return sendError({ req, res, statusCode: 404, message: 'Specified Batch does not exist.' });

    // Validate students
    const students = await Student.find({
      _id: { $in: validatedData.studentIds },
      institute: institute._id,
      course: course._id,
      batch: batch._id,
    });

    if (students.length !== validatedData.studentIds.length) {
      return sendError({ req, res, statusCode: 400, message: 'One or more students do not exist or do not belong to the specified course/batch.' });
    }

    // Fetch fee records for examination fees
    const FeeRecord = require('../models/feeRecordModel').FeeRecord;
    const feeRecords = await FeeRecord.find({
      student: { $in: validatedData.studentIds },
      paymentPurpose: 'Examination fee'
    });
    const paidStudentIds = new Set(feeRecords.map((f: any) => f.student.toString()));

    // Eligibility check
    const ineligible = students.filter(s => !(s.attendancePercentage >= 75 && s.thesisApproved && paidStudentIds.has(s._id.toString())));
    if (ineligible.length > 0) {
      return sendError({
        req, res, statusCode: 400,
        message: 'Cannot apply for exam. One or more selected students are ineligible.',
        errors: ineligible.map(s => ({ studentId: s._id, name: `${s.firstName} ${s.lastName}`, reason: 'Ineligible student criteria not met (attendance, thesis, or exam fee)' })),
      });
    }

    // Duplicate check
    const existing = await ExamApplication.findOne({
      batch: batch._id,
      students: { $in: validatedData.studentIds },
      status: { $in: ['Pending', 'Approved', 'SchedulePublished'] },
    });
    if (existing) {
      return sendError({ req, res, statusCode: 400, message: 'An exam application already exists for one or more selected students in this batch.' });
    }

    const application = await ExamApplication.create({
      institute: institute._id,
      course: course._id,
      batch: batch._id,
      students: validatedData.studentIds,
      subjects: validatedData.subjects,
      status: 'Pending',
      utrNumber: validatedData.utrNumber,
      examFeeReceiptUrl,
    });

    return sendSuccess({ req, res, statusCode: 201, message: 'Exam application submitted successfully', data: application });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── GET All Exam Applications ────────────────────────────────────────────────

export const listExamApplications = async (req: Request, res: Response) => {
  try {
    const query: any = {};

    // Optional filters
    if (req.query.status)  query.status  = req.query.status;
    if (req.query.courseId) query.course = req.query.courseId;
    if (req.query.batchId)  query.batch  = req.query.batchId;

    if (req.user.role === 'institute') {
      const institute = await resolveInstitute(req.user._id);
      if (!institute) return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      query.institute = institute._id;
    }

    const applications = await ExamApplication.find(query)
      .populate('institute', 'orgName')
      .populate('course', 'name')
      .populate('batch', 'year')
      .populate('students', 'firstName lastName enrollmentId email')
      .sort({ createdAt: -1 });

    return sendSuccess({ req, res, message: 'Exam applications retrieved successfully', data: applications });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── GET Exam Application by ID ───────────────────────────────────────────────

export const getExamApplicationById = async (req: Request, res: Response) => {
  try {
    const application = await ExamApplication.findById(req.params.id)
      .populate('institute', 'orgName instituteAddress')
      .populate('course', 'name')
      .populate('batch', 'year')
      .populate('students', 'firstName lastName enrollmentId email attendancePercentage thesisApproved remittedToAcademy');

    if (!application) return sendError({ req, res, statusCode: 404, message: 'Exam application not found' });

    if (req.user.role === 'institute') {
      const owns = await assertOwnership(application, req.user._id);
      if (!owns) return sendError({ req, res, statusCode: 403, message: 'Unauthorized to access this application' });
    }

    return sendSuccess({ req, res, message: 'Exam application retrieved successfully', data: application });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── UPDATE Exam Application (Institute — Pending only) ───────────────────────

export const updateExamApplication = async (req: Request, res: Response) => {
  try {
    const validatedData = examUpdateSchema.parse(req.body);

    const institute = await resolveInstitute(req.user._id);
    if (!institute) return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });

    const application = await ExamApplication.findOne({ _id: req.params.id, institute: institute._id });
    if (!application) return sendError({ req, res, statusCode: 404, message: 'Exam application not found or unauthorized' });

    if (application.status !== 'Pending') {
      return sendError({ req, res, statusCode: 400, message: 'Only Pending applications can be updated.' });
    }

    if (validatedData.subjects?.length) application.subjects = validatedData.subjects;

    if (validatedData.studentIds?.length) {
      const students = await Student.find({
        _id: { $in: validatedData.studentIds },
        institute: institute._id,
        course: application.course,
        batch: application.batch,
      });
      if (students.length !== validatedData.studentIds.length) {
        return sendError({ req, res, statusCode: 400, message: 'One or more students do not exist or do not belong to this course/batch.' });
      }
      const FeeRecord = require('../models/feeRecordModel').FeeRecord;
      const feeRecords = await FeeRecord.find({
        student: { $in: validatedData.studentIds },
        paymentPurpose: 'Examination fee'
      });
      const paidStudentIds = new Set(feeRecords.map((f: any) => f.student.toString()));

      const ineligible = students.filter(s => !(s.attendancePercentage >= 75 && s.thesisApproved && paidStudentIds.has(s._id.toString())));
      if (ineligible.length > 0) {
        return sendError({
          req, res, statusCode: 400,
          message: 'One or more updated students are ineligible.',
          errors: ineligible.map(s => ({ studentId: s._id, name: `${s.firstName} ${s.lastName}`, reason: 'Ineligible student criteria not met (attendance, thesis, or exam fee)' })),
        });
      }
      application.students = validatedData.studentIds.map((id: string) => id as any);
    }

    await application.save();
    return sendSuccess({ req, res, message: 'Exam application updated successfully', data: application });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── DELETE Exam Application (Institute — Pending only) ───────────────────────

export const deleteExamApplication = async (req: Request, res: Response) => {
  try {
    const institute = await resolveInstitute(req.user._id);
    if (!institute) return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });

    const application = await ExamApplication.findOne({ _id: req.params.id, institute: institute._id });
    if (!application) return sendError({ req, res, statusCode: 404, message: 'Exam application not found or unauthorized' });

    if (application.status !== 'Pending') {
      return sendError({ req, res, statusCode: 400, message: 'Only Pending applications can be cancelled/deleted.' });
    }

    await ExamApplication.findByIdAndDelete(req.params.id);
    return sendSuccess({ req, res, message: 'Exam application cancelled and deleted successfully', data: { deletedId: req.params.id } });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── UC 4.2 Step 1: Review Exam Application (Board) ──────────────────────────

export const reviewExamApplication = async (req: Request, res: Response) => {
  try {
    const validatedData = reviewExamSchema.parse(req.body);

    const application = await ExamApplication.findById(req.params.id);
    if (!application) return sendError({ req, res, statusCode: 404, message: 'Exam application not found' });

    if (application.status !== 'Pending') {
      return sendError({ req, res, statusCode: 400, message: `Cannot review an application with status "${application.status}". Only Pending applications can be reviewed.` });
    }

    if (validatedData.status === 'Approved' && !validatedData.scheduledDate) {
      return sendError({ req, res, statusCode: 400, message: 'A scheduled date is required to approve the exam application.' });
    }

    application.status = validatedData.status;
    application.remarks = validatedData.remarks || application.remarks;

    if (validatedData.status === 'Approved') {
      application.scheduledDate = validatedData.scheduledDate;
    } else {
      // Rejected — clear schedule data
      application.scheduledDate       = undefined;
      application.examVenue           = undefined;
      application.examCenter          = undefined;
      application.reportingTime       = undefined;
      application.schedulePublishedAt = undefined;
      application.hallTicketsGenerated = false;
    }

    await application.save();
    return sendSuccess({ req, res, message: `Exam application ${validatedData.status.toLowerCase()} successfully`, data: application });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── UC 4.2 Step 2: Publish Exam Schedule (Board) ────────────────────────────

export const publishExamSchedule = async (req: Request, res: Response) => {
  try {
    const validatedData = publishScheduleSchema.parse(req.body);

    const application = await ExamApplication.findById(req.params.id)
      .populate('institute', 'orgName')
      .populate('course', 'name')
      .populate('batch', 'year');

    if (!application) return sendError({ req, res, statusCode: 404, message: 'Exam application not found' });

    if (application.status !== 'Approved') {
      return sendError({ req, res, statusCode: 400, message: `Cannot publish schedule for an application with status "${application.status}". Application must be Approved first.` });
    }

    // Update schedule details
    application.examVenue           = validatedData.examVenue;
    application.examCenter          = validatedData.examCenter;
    application.reportingTime       = validatedData.reportingTime;
    application.schedulePublishedAt = new Date();
    application.status              = 'SchedulePublished';
    
    if (validatedData.subjectSchedules) {
      application.subjectSchedules = validatedData.subjectSchedules;
    }

    // Allow updating the scheduled date if provided
    if (validatedData.scheduledDate) {
      application.scheduledDate = validatedData.scheduledDate;
    }

    await application.save();

    // Send email to institute (mock implementation as Razorpay is in mock mode, assuming email service is similar)
    const instituteDoc = await Institute.findById(application.institute).populate('user');
    if (instituteDoc && instituteDoc.emailAddress) {
      console.log(`[EMAIL MOCK] Sending Exam Schedule Publish Email to: ${instituteDoc.emailAddress}`);
      console.log(`[EMAIL MOCK] Subject: Exam Schedule Published for ${application.course} - ${application.batch}`);
      console.log(`[EMAIL MOCK] Body: Please check your institute panel for the published exam dates.`);
    }

    return sendSuccess({
      req, res,
      message: 'Exam schedule published successfully. Institute can now generate hall tickets.',
      data: {
        _id:                  application._id,
        status:               application.status,
        scheduledDate:        application.scheduledDate,
        examVenue:            application.examVenue,
        examCenter:           application.examCenter,
        reportingTime:        application.reportingTime,
        schedulePublishedAt:  application.schedulePublishedAt,
        course:               application.course,
        batch:                application.batch,
        subjects:             application.subjects,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── UC 4.3: Generate Hall Tickets (persisted) ───────────────────────────────

export const generateHallTickets = async (req: Request, res: Response) => {
  try {
    const application = await ExamApplication.findById(req.params.id)
      .populate('institute', 'orgName instituteAddress')
      .populate('course', 'name')
      .populate('batch', 'year')
      .populate('students', 'firstName lastName enrollmentId contactNumber documents');

    if (!application) return sendError({ req, res, statusCode: 404, message: 'Exam application not found' });

    // Role guard for institute
    if (req.user.role === 'institute') {
      const owns = await assertOwnership(application, req.user._id);
      if (!owns) return sendError({ req, res, statusCode: 403, message: 'Unauthorized to access this application' });
    }

    if (application.status !== 'SchedulePublished') {
      return sendError({
        req, res, statusCode: 400,
        message: `Hall tickets can only be generated after the schedule is published. Current status: "${application.status}".`,
      });
    }

    if (!application.examVenue || !application.examCenter || !application.reportingTime || !application.scheduledDate) {
      return sendError({ req, res, statusCode: 400, message: 'Exam schedule is incomplete. Venue, center, reporting time, and date are all required.' });
    }

    const instituteDoc   = application.institute as any;
    const courseDoc      = application.course    as any;
    const batchDoc       = application.batch     as any;
    const studentsArr    = application.students  as any[];

    // Idempotent: delete existing tickets for this application before regenerating
    await HallTicket.deleteMany({ examApplication: application._id });

    const now       = Date.now();
    const tickets   = await Promise.all(
      studentsArr.map(async (student: any) => {
        const ticketId = `HT-${student.enrollmentId}-${now}`;
        return HallTicket.create({
          ticketId,
          examApplication: application._id,
          student:         student._id,
          institute:       application.institute,

          // Student snapshot
          enrollmentId:  student.enrollmentId,
          studentName:   `${student.firstName} ${student.lastName}`,
          contactNumber: student.contactNumber,
          photoUrl:      student.documents?.passportPhotoUrl,

          // Institute snapshot
          instituteName:    instituteDoc.orgName,
          instituteAddress: instituteDoc.instituteAddress,

          // Course / batch snapshot
          courseName: courseDoc.name,
          batchYear:  batchDoc.year,

          // Exam details
          subjects:      application.subjects,
          examDate:      application.scheduledDate,
          examVenue:     application.examVenue,
          examCenter:    application.examCenter,
          reportingTime: application.reportingTime,
        });
      })
    );

    // Mark application
    application.hallTicketsGenerated   = true;
    application.hallTicketsGeneratedAt = new Date();
    await application.save();

    return sendSuccess({
      req, res,
      message: `${tickets.length} hall ticket(s) generated successfully. Use GET /:id/hall-tickets to retrieve them.`,
      data: {
        count:                   tickets.length,
        hallTicketsGeneratedAt:  application.hallTicketsGeneratedAt,
        tickets,
      },
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── GET All Hall Tickets for an Application ──────────────────────────────────

export const listHallTickets = async (req: Request, res: Response) => {
  try {
    const application = await ExamApplication.findById(req.params.id);
    if (!application) return sendError({ req, res, statusCode: 404, message: 'Exam application not found' });

    // Role guard
    if (req.user.role === 'institute') {
      const owns = await assertOwnership(application, req.user._id);
      if (!owns) return sendError({ req, res, statusCode: 403, message: 'Unauthorized to access this application' });
    }

    if (!application.hallTicketsGenerated) {
      return sendError({ req, res, statusCode: 400, message: 'Hall tickets have not been generated yet for this application.' });
    }

    const tickets = await HallTicket.find({ examApplication: req.params.id })
      .populate('student', 'firstName lastName enrollmentId')
      .sort({ enrollmentId: 1 });

    return sendSuccess({
      req, res,
      message: `${tickets.length} hall ticket(s) retrieved successfully`,
      data: tickets,
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── GET Single Hall Ticket by ID ────────────────────────────────────────────

export const getHallTicketById = async (req: Request, res: Response) => {
  try {
    const { id, hid } = req.params;

    const ticket = await HallTicket.findOne({ _id: hid, examApplication: id })
      .populate('student', 'firstName lastName enrollmentId email')
      .populate('institute', 'orgName');

    if (!ticket) return sendError({ req, res, statusCode: 404, message: 'Hall ticket not found' });

    // Role guard
    if (req.user.role === 'institute') {
      const application = await ExamApplication.findById(id);
      if (!application) return sendError({ req, res, statusCode: 404, message: 'Exam application not found' });
      const owns = await assertOwnership(application, req.user._id);
      if (!owns) return sendError({ req, res, statusCode: 403, message: 'Unauthorized to access this hall ticket' });
    }

    return sendSuccess({ req, res, message: 'Hall ticket retrieved successfully', data: ticket });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── Download Hall Ticket (marks isDownloaded=true) ──────────────────────────

export const downloadHallTicket = async (req: Request, res: Response) => {
  try {
    const { id, hid } = req.params;

    const ticket = await HallTicket.findOne({ _id: hid, examApplication: id });
    if (!ticket) return sendError({ req, res, statusCode: 404, message: 'Hall ticket not found' });

    // Role guard
    if (req.user.role === 'institute') {
      const application = await ExamApplication.findById(id);
      if (!application) return sendError({ req, res, statusCode: 404, message: 'Exam application not found' });
      const owns = await assertOwnership(application, req.user._id);
      if (!owns) return sendError({ req, res, statusCode: 403, message: 'Unauthorized to download this hall ticket' });
    }

    // Mark as downloaded
    if (!ticket.isDownloaded) {
      ticket.isDownloaded = true;
      ticket.downloadedAt = new Date();
      await ticket.save();
    }

    return sendSuccess({
      req, res,
      message: 'Hall ticket data ready for download. Use this data to render a printable PDF.',
      data: ticket,
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};
