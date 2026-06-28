import { Request, Response } from 'express';
import { z } from 'zod';
import { Course } from '../models/courseModel';
import { Batch } from '../models/batchModel';
import { Student } from '../models/studentModel';
import { FeeRecord } from '../models/feeRecordModel';
import { Remittance } from '../models/remittanceModel';
import { Institute } from '../models/instituteModel';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import path from 'path';

const getFileUrl = (filePath: string) => {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  const filename = path.basename(filePath);
  return `http://localhost:5000/uploads/${filename}`;
};

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const courseCreateSchema = z.object({
  name: z.string().min(1, 'Course Name is required'),
  description: z.string().optional(),
  courseCode: z.string().optional(),
  courseType: z.string().optional(),
  programCategory: z.string().optional(),
  courseDuration: z.string().optional(),
  durationType: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  examinationFee: z.string().optional(),
});

const courseUpdateSchema = z.object({
  name: z.string().min(1, 'Course Name is required').optional(),
  description: z.string().optional(),
  courseCode: z.string().optional(),
  courseType: z.string().optional(),
  programCategory: z.string().optional(),
  courseDuration: z.string().optional(),
  durationType: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  examinationFee: z.string().optional(),
  status: z.enum(['Active', 'Inactive', 'Pending']).optional(),
});

const batchCreateSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  year: z.coerce.number().min(1900).max(2100, 'Invalid batch year'),
  name: z.string().optional(),
  startDate: z.string().optional(),
  seats: z.coerce.number().min(1).optional().default(5),
});

const batchUpdateSchema = z.object({
  name: z.string().optional(),
  year: z.coerce.number().min(1900).max(2100, 'Invalid batch year').optional(),
  startDate: z.string().optional(),
  seats: z.coerce.number().min(1).optional(),
  status: z.enum(['Active', 'Inactive', 'Completed']).optional(),
});

const studentAddSchema = z.object({
  firstName: z.string().min(1, 'First Name is required'),
  lastName: z.string().min(1, 'Last Name is required'),
  homeAddress: z.string().min(1, 'Home Address is required'),
  contactNumber: z.string().regex(/^[0-9]{10,15}$/, 'Must be a valid mobile number format'),
  email: z.string().email('Must be a valid email format'),
  qualification: z.string().min(1, 'Qualification is mandatory'),
  mbbsQualification: z.string().min(1, 'MBBS Qualification is mandatory'),
  yearOfPassing: z.coerce.number().min(1900).max(2100, 'Invalid year of passing'),
  universityName: z.string().min(1, 'University Name is required'),
  medicalCouncilRegistrationNumber: z.string().min(1, 'Medical Council Registration Number is required'),
  isForeignGraduate: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean()
  ),
  fmgeClearanceStatus: z.enum(['Cleared', 'Not Applicable', 'Failed']).default('Not Applicable'),
  courseId: z.string().min(1, 'Course is required'),
  batchId: z.string().min(1, 'Batch is required'),
  courseDirector: z.string().min(1, 'Course Director is required'),
  utrNumber: z.string().min(1, 'UTR Number is required'),
});

const studentUpdateSchema = z.object({
  firstName: z.string().min(1, 'First Name is required').optional(),
  lastName: z.string().min(1, 'Last Name is required').optional(),
  homeAddress: z.string().min(1, 'Home Address is required').optional(),
  contactNumber: z.string().regex(/^[0-9]{10,15}$/, 'Must be a valid mobile number format').optional(),
  email: z.string().email('Must be a valid email format').optional(),
  qualification: z.string().min(1, 'Qualification is mandatory').optional(),
  mbbsQualification: z.string().min(1, 'MBBS Qualification is mandatory').optional(),
  yearOfPassing: z.coerce.number().min(1900).max(2100, 'Invalid year of passing').optional(),
  universityName: z.string().min(1, 'University Name is required').optional(),
  medicalCouncilRegistrationNumber: z.string().min(1, 'Medical Council Registration Number is required').optional(),
  isForeignGraduate: z.preprocess(
    (val) => val === 'true' || val === true || val === 'false' || val === false,
    z.boolean()
  ).optional(),
  fmgeClearanceStatus: z.enum(['Cleared', 'Not Applicable', 'Failed']).optional(),
  courseId: z.string().min(1, 'Course is required').optional(),
  batchId: z.string().min(1, 'Batch is required').optional(),
  courseDirector: z.string().min(1, 'Course Director is required').optional(),
  utrNumber: z.string().min(1, 'UTR Number is required').optional(),
});

const feeRecordSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  paymentMode: z.string().min(1, 'Payment Mode is required'),
  utrNumber: z.string().min(1, 'UTR Number is required'),
  paymentDate: z.string().transform((val) => new Date(val)),
  paymentPurpose: z.string().min(1, 'Payment Purpose is required'),
});

const remittanceSchema = z.object({
  totalAmount: z.coerce.number().min(0.01, 'Total Amount must be greater than 0'),
  utrNumber: z.string().min(1, 'Transaction ID / UTR is required'),
  paymentDate: z.string().transform((val) => new Date(val)),
  studentIds: z.preprocess(
    (val) => (typeof val === 'string' ? JSON.parse(val) : val),
    z.array(z.string()).optional()
  ),
});

// ==========================================
// COURSE CRUD OPERATIONS
// ==========================================

// ─── Create Course ────────────────────────────────────────────────────────────
export const createCourse = async (req: Request, res: Response) => {
  try {
    const validatedData = courseCreateSchema.parse(req.body);

    const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
    if (!institute) {
      return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
    }

    // Check for duplicate course name within the same institute
    const existingCourse = await Course.findOne({ 
      institute: institute._id, 
      name: { $regex: new RegExp(`^${validatedData.name}$`, 'i') } 
    });
    if (existingCourse) {
      return sendError({ req, res, statusCode: 400, message: 'A course with this name already exists for your institute.' });
    }

    const newCourse = await Course.create({
      institute: institute._id,
      ...validatedData,
    });

    return sendSuccess({
      req,
      res,
      statusCode: 201,
      message: 'Course created successfully',
      data: newCourse,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── Get All Courses ──────────────────────────────────────────────────────────
export const getCourses = async (req: Request, res: Response) => {
  try {
    const query: any = {};
    if (req.user.role === 'institute') {
      const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
      if (!institute) {
        return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      }
      query.institute = institute._id;
    }
    const courses = await Course.find(query).sort({ createdAt: -1 });
    return sendSuccess({ req, res, message: 'Courses retrieved successfully', data: courses });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── Get Single Course ────────────────────────────────────────────────────────
export const getCourseById = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const query: any = { _id: courseId };

    if (req.user.role === 'institute') {
      const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
      if (!institute) {
        return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      }
      query.institute = institute._id;
    }

    const course = await Course.findOne(query);
    if (!course) {
      return sendError({ req, res, statusCode: 404, message: 'Course not found' });
    }

    // Get batch count and student count
    const batchCount = await Batch.countDocuments({ course: course._id });
    const studentCount = await Student.countDocuments({ course: course._id });

    return sendSuccess({
      req,
      res,
      message: 'Course retrieved successfully',
      data: {
        ...course.toObject(),
        batchCount,
        studentCount,
      },
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── Update Course ────────────────────────────────────────────────────────────
export const updateCourse = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const validatedData = courseUpdateSchema.parse(req.body);

    const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
    if (!institute) {
      return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
    }

    const course = await Course.findOne({ _id: courseId, institute: institute._id });
    if (!course) {
      return sendError({ req, res, statusCode: 404, message: 'Course not found or does not belong to your institute' });
    }

    // Check for duplicate course name (excluding current course)
    if (validatedData.name) {
      const existingCourse = await Course.findOne({
        _id: { $ne: courseId },
        institute: institute._id,
        name: { $regex: new RegExp(`^${validatedData.name}$`, 'i') }
      });
      if (existingCourse) {
        return sendError({ req, res, statusCode: 400, message: 'A course with this name already exists for your institute.' });
      }
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      { $set: validatedData },
      { new: true, runValidators: true }
    );

    return sendSuccess({
      req,
      res,
      message: 'Course updated successfully',
      data: updatedCourse,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── Delete Course ────────────────────────────────────────────────────────────
export const deleteCourse = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;

    const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
    if (!institute) {
      return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
    }

    const course = await Course.findOne({ _id: courseId, institute: institute._id });
    if (!course) {
      return sendError({ req, res, statusCode: 404, message: 'Course not found or does not belong to your institute' });
    }

    // Check if there are students enrolled in this course
    const studentCount = await Student.countDocuments({ course: courseId });
    if (studentCount > 0) {
      return sendError({
        req,
        res,
        statusCode: 400,
        message: `Cannot delete course. ${studentCount} student(s) are currently enrolled in this course. Please transfer or de-enroll them first.`
      });
    }

    // Check if there are batches associated with this course
    const batchCount = await Batch.countDocuments({ course: courseId });
    if (batchCount > 0) {
      return sendError({
        req,
        res,
        statusCode: 400,
        message: `Cannot delete course. ${batchCount} batch(es) are associated with this course. Please delete the batches first.`
      });
    }

    await Course.findByIdAndDelete(courseId);

    return sendSuccess({
      req,
      res,
      message: 'Course deleted successfully',
      data: { deletedId: courseId },
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ==========================================
// BATCH CRUD OPERATIONS
// ==========================================

// ─── Create Batch ─────────────────────────────────────────────────────────────
export const createBatch = async (req: Request, res: Response) => {
  try {
    const validatedData = batchCreateSchema.parse(req.body);

    const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
    if (!institute) {
      return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
    }

    // Verify course exists
    const course = await Course.findOne({ _id: validatedData.courseId, institute: institute._id });
    if (!course) {
      return sendError({ req, res, statusCode: 404, message: 'Course not found under this institute' });
    }

    // Check for duplicate batch
    const duplicateBatch = await Batch.findOne({ course: course._id, year: validatedData.year });
    if (duplicateBatch) {
      return sendError({ req, res, statusCode: 400, message: `Duplicate batch: A batch for the year ${validatedData.year} already exists for this course.` });
    }

    // Generate batch name if not provided
    const batchName = validatedData.name || `Batch ${validatedData.year}-${String.fromCharCode(65 + (await Batch.countDocuments({ course: course._id })))}`;

    const newBatch = await Batch.create({
      institute: institute._id,
      course: course._id,
      year: validatedData.year,
      name: batchName,
      startDate: validatedData.startDate ? new Date(validatedData.startDate) : new Date(`${validatedData.year}-01-10`),
      seats: validatedData.seats || 5,
      activeFellows: 0,
      status: 'Active',
    });

    return sendSuccess({
      req,
      res,
      statusCode: 201,
      message: 'Batch created successfully',
      data: newBatch,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── Get All Batches ──────────────────────────────────────────────────────────
export const getBatches = async (req: Request, res: Response) => {
  try {
    const query: any = {};
    if (req.user.role === 'institute') {
      const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
      if (!institute) {
        return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      }
      query.institute = institute._id;
    }

    // Populate course details
    const batches = await Batch.find(query)
      .populate('course', 'name courseCode')
      .sort({ year: -1, createdAt: -1 });

    return sendSuccess({ req, res, message: 'Batches retrieved successfully', data: batches });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── Get Single Batch ─────────────────────────────────────────────────────────
export const getBatchById = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const query: any = { _id: batchId };

    if (req.user.role === 'institute') {
      const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
      if (!institute) {
        return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      }
      query.institute = institute._id;
    }

    const batch = await Batch.findOne(query).populate('course', 'name courseCode');
    if (!batch) {
      return sendError({ req, res, statusCode: 404, message: 'Batch not found' });
    }

    // Get student count for this batch
    const studentCount = await Student.countDocuments({ batch: batch._id });

    return sendSuccess({
      req,
      res,
      message: 'Batch retrieved successfully',
      data: {
        ...batch.toObject(),
        studentCount,
      },
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── Update Batch ─────────────────────────────────────────────────────────────
export const updateBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const validatedData = batchUpdateSchema.parse(req.body);

    const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
    if (!institute) {
      return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
    }

    const batch = await Batch.findOne({ _id: batchId, institute: institute._id });
    if (!batch) {
      return sendError({ req, res, statusCode: 404, message: 'Batch not found or does not belong to your institute' });
    }

    // If updating year, check for duplicates
    if (validatedData.year) {
      const duplicateBatch = await Batch.findOne({
        _id: { $ne: batchId },
        course: batch.course,
        year: validatedData.year,
      });
      if (duplicateBatch) {
        return sendError({ req, res, statusCode: 400, message: `A batch for the year ${validatedData.year} already exists for this course.` });
      }
    }

    const updatedBatch = await Batch.findByIdAndUpdate(
      batchId,
      { $set: validatedData },
      { new: true, runValidators: true }
    ).populate('course', 'name courseCode');

    return sendSuccess({
      req,
      res,
      message: 'Batch updated successfully',
      data: updatedBatch,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── Delete Batch ─────────────────────────────────────────────────────────────
export const deleteBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
    if (!institute) {
      return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
    }

    const batch = await Batch.findOne({ _id: batchId, institute: institute._id });
    if (!batch) {
      return sendError({ req, res, statusCode: 404, message: 'Batch not found or does not belong to your institute' });
    }

    // Check if there are students in this batch
    const studentCount = await Student.countDocuments({ batch: batchId });
    if (studentCount > 0) {
      return sendError({
        req,
        res,
        statusCode: 400,
        message: `Cannot delete batch. ${studentCount} student(s) are currently in this batch. Please transfer or de-enroll them first.`
      });
    }

    await Batch.findByIdAndDelete(batchId);

    return sendSuccess({
      req,
      res,
      message: 'Batch deleted successfully',
      data: { deletedId: batchId },
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ─── Get Batches by Course ────────────────────────────────────────────────────
export const getBatchesByCourse = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;

    const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
    if (!institute) {
      return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
    }

    const course = await Course.findOne({ _id: courseId, institute: institute._id });
    if (!course) {
      return sendError({ req, res, statusCode: 404, message: 'Course not found under this institute' });
    }

    const batches = await Batch.find({ course: courseId, institute: institute._id })
      .sort({ year: -1 });

    return sendSuccess({
      req,
      res,
      message: 'Batches retrieved successfully',
      data: batches,
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ==========================================
// STUDENT MANAGEMENT (Existing)
// ==========================================

export const addStudent = async (req: Request, res: Response) => {
  try {
    const validatedData = studentAddSchema.parse(req.body);

    const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
    if (!institute) {
      return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
    }

    const course = await Course.findOne({ _id: validatedData.courseId, institute: institute._id });
    if (!course) {
      return sendError({ req, res, statusCode: 404, message: 'Specified Course does not exist or does not belong to this institute.' });
    }

    const batch = await Batch.findOne({ _id: validatedData.batchId, course: course._id });
    if (!batch) {
      return sendError({ req, res, statusCode: 404, message: 'Specified Batch does not exist under this course.' });
    }

    const existingStudent = await Student.findOne({
      $or: [
        { email: validatedData.email },
        { medicalCouncilRegistrationNumber: validatedData.medicalCouncilRegistrationNumber }
      ]
    });
    if (existingStudent) {
      return sendError({ 
        req, 
        res, 
        statusCode: 400, 
        message: 'Warning: A student with this Email Address or Medical Council Registration Number already exists in the system.' 
      });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const requiredDocFields = [
      'passportPhoto', 'mbbsCertificate', 'medicalCouncilRegistrationCertificate',
      'paymentReceipt', 'semiMembershipForm'
    ];

    for (const field of requiredDocFields) {
      if (!files || !files[field] || files[field].length === 0) {
        return sendError({ req, res, statusCode: 400, message: `Missing mandatory document upload: ${field}` });
      }
    }

    if (validatedData.isForeignGraduate) {
      if (validatedData.fmgeClearanceStatus !== 'Cleared') {
        return sendError({ req, res, statusCode: 400, message: 'FMGE clearance is mandatory for foreign medical graduates.' });
      }
      if (!files || !files['fmgeResultCopy'] || files['fmgeResultCopy'].length === 0) {
        return sendError({ req, res, statusCode: 400, message: 'Missing mandatory document upload: fmgeResultCopy' });
      }
    }

    let enrollmentId = '';
    let isUnique = false;
    while (!isUnique) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      enrollmentId = `SEMI-${batch.year}-${randomSuffix}`;
      const existingEnrollment = await Student.findOne({ enrollmentId });
      if (!existingEnrollment) {
        isUnique = true;
      }
    }

    const student = await Student.create({
      enrollmentId,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      homeAddress: validatedData.homeAddress,
      contactNumber: validatedData.contactNumber,
      email: validatedData.email,
      qualification: validatedData.qualification,
      mbbsQualification: validatedData.mbbsQualification,
      yearOfPassing: validatedData.yearOfPassing,
      universityName: validatedData.universityName,
      medicalCouncilRegistrationNumber: validatedData.medicalCouncilRegistrationNumber,
      isForeignGraduate: validatedData.isForeignGraduate,
      fmgeClearanceStatus: validatedData.fmgeClearanceStatus,
      course: course._id,
      batch: batch._id,
      institute: institute._id,
      courseDirector: validatedData.courseDirector,
      utrNumber: validatedData.utrNumber,
      documents: {
        passportPhotoUrl: getFileUrl(files['passportPhoto'][0].path),
        mbbsCertificateUrl: getFileUrl(files['mbbsCertificate'][0].path),
        medicalCouncilRegistrationCertificateUrl: getFileUrl(files['medicalCouncilRegistrationCertificate'][0].path),
        fmgeResultCopyUrl: files['fmgeResultCopy'] ? getFileUrl(files['fmgeResultCopy'][0].path) : undefined,
        paymentReceiptUrl: getFileUrl(files['paymentReceipt'][0].path),
        semiMembershipFormUrl: getFileUrl(files['semiMembershipForm'][0].path),
      },
      remittedToAcademy: false,
    });

    // Update batch active fellows count
    await Batch.findByIdAndUpdate(batch._id, { $inc: { activeFellows: 1 } });

    return sendSuccess({
      req,
      res,
      statusCode: 201,
      message: 'Student registered successfully',
      data: student,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ==========================================
// FEE RECORDING (Existing)
// ==========================================

export const recordStudentFee = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const validatedData = feeRecordSchema.parse(req.body);

    const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
    if (!institute) {
      return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
    }

    const student = await Student.findOne({ _id: studentId, institute: institute._id });
    if (!student) {
      return sendError({ req, res, statusCode: 404, message: 'Student not found under this institute' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || !files['paymentReceipt'] || files['paymentReceipt'].length === 0) {
      return sendError({ req, res, statusCode: 400, message: 'Payment Receipt Upload is mandatory' });
    }

    const feeRecord = await FeeRecord.create({
      student: student._id,
      amount: validatedData.amount,
      paymentMode: validatedData.paymentMode,
      utrNumber: validatedData.utrNumber,
      paymentReceiptUrl: getFileUrl(files['paymentReceipt'][0].path),
      paymentDate: validatedData.paymentDate,
      paymentPurpose: validatedData.paymentPurpose,
    });

    return sendSuccess({
      req,
      res,
      statusCode: 201,
      message: 'Fee payment transaction recorded successfully',
      data: feeRecord,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

export const listFeeRecords = async (req: Request, res: Response) => {
  try {
    const query: any = {};

    if (req.user.role === 'institute') {
      const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
      if (!institute) {
        return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      }
      // Find student IDs that belong to this institute
      const studentIds = await Student.find({ institute: institute._id }).distinct('_id');
      query.student = { $in: studentIds };
    }

    const records = await FeeRecord.find(query)
      .populate('student', 'firstName lastName enrollmentId email course batch')
      .sort({ createdAt: -1 });

    return sendSuccess({
      req,
      res,
      message: 'Fee records retrieved successfully',
      data: records,
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ==========================================
// REMITTANCE (Existing)
// ==========================================

export const getPayableAmount = async (req: Request, res: Response) => {
  try {
    const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
    if (!institute) {
      return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
    }

    const pendingStudents = await Student.find({ institute: institute._id, remittedToAcademy: false })
      .select('firstName lastName enrollmentId email');

    const ACADEMY_STUDENT_FEE = 50000;
    const count = pendingStudents.length;
    const payableAmount = count * ACADEMY_STUDENT_FEE;

    return sendSuccess({
      req,
      res,
      message: 'Payable remittance calculated successfully',
      data: {
        pendingStudentCount: count,
        standardFeePerStudent: ACADEMY_STUDENT_FEE,
        payableAmount,
        pendingStudents,
      },
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

export const recordRemittance = async (req: Request, res: Response) => {
  try {
    const validatedData = remittanceSchema.parse(req.body);

    const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
    if (!institute) {
      return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || !files['paymentReceipt'] || files['paymentReceipt'].length === 0) {
      return sendError({ req, res, statusCode: 400, message: 'Payment Receipt is mandatory' });
    }

    let studentIdsToRemit = validatedData.studentIds;
    
    if (!studentIdsToRemit || studentIdsToRemit.length === 0) {
      const pendingStudents = await Student.find({ institute: institute._id, remittedToAcademy: false });
      studentIdsToRemit = pendingStudents.map((s) => s._id.toString());
    } else {
      const validatedStudentsCount = await Student.countDocuments({
        _id: { $in: studentIdsToRemit },
        institute: institute._id,
        remittedToAcademy: false,
      });

      if (validatedStudentsCount !== studentIdsToRemit.length) {
        return sendError({
          req,
          res,
          statusCode: 400,
          message: 'One or more specified students are invalid, do not belong to this institute, or are already remitted.',
        });
      }
    }

    if (studentIdsToRemit.length === 0) {
      return sendError({ req, res, statusCode: 400, message: 'No outstanding student remittances found to process.' });
    }

    const remittance = await Remittance.create({
      institute: institute._id,
      totalAmount: validatedData.totalAmount,
      utrNumber: validatedData.utrNumber,
      paymentDate: validatedData.paymentDate,
      paymentReceiptUrl: getFileUrl(files['paymentReceipt'][0].path),
      students: studentIdsToRemit,
    });

    await Student.updateMany(
      { _id: { $in: studentIdsToRemit } },
      { $set: { remittedToAcademy: true, remittanceRecord: remittance._id } }
    );

    return sendSuccess({
      req,
      res,
      statusCode: 201,
      message: 'Academy remittance transaction successfully recorded',
      data: remittance,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

// ==========================================
// ELIGIBILITY ENGINE (Existing)
// ==========================================

const studentMetricsUpdateSchema = z.object({
  attendancePercentage: z.coerce.number().min(0).max(100, 'Attendance must be between 0 and 100').optional(),
  thesisApproved: z.preprocess(
    (val) => val === 'true' || val === true || val === '1',
    z.boolean()
  ).optional(),
  clearThesis: z.preprocess((val) => val === 'true' || val === true || val === '1', z.boolean()).optional(),
  clearAttendance: z.preprocess((val) => val === 'true' || val === true || val === '1', z.boolean()).optional(),
});

export const listStudents = async (req: Request, res: Response) => {
  try {
    const { courseId, batchId, search, isEligible } = req.query;
    const query: any = {};

    if (req.user.role === 'institute') {
      const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
      if (!institute) {
        return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      }
      query.institute = institute._id;
    }

    if (courseId) {
      query.course = courseId;
    }
    if (batchId) {
      query.batch = batchId;
    }
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { enrollmentId: { $regex: search, $options: 'i' } },
      ];
    }

    if (isEligible === 'true') {
      query.remittedToAcademy = true;
      query.attendancePercentage = { $gte: 75 };
      query.thesisApproved = true;
    } else if (isEligible === 'false') {
      query.$or = [
        { remittedToAcademy: false },
        { attendancePercentage: { $lt: 75 } },
        { thesisApproved: false },
      ];
    }

    const students = await Student.find(query)
      .populate('course', 'name')
      .populate('batch', 'year')
      .populate('institute', 'orgName')
      .sort({ createdAt: -1 });

    const formattedStudents = students.map((student) => {
      const isStudentEligible = student.remittedToAcademy && student.attendancePercentage >= 75 && student.thesisApproved;
      return {
        ...student.toObject(),
        isEligible: isStudentEligible,
      };
    });

    return sendSuccess({
      req,
      res,
      message: 'Students list retrieved successfully',
      data: formattedStudents,
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

export const updateAcademicMetrics = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const validatedData = studentMetricsUpdateSchema.parse(req.body);
    const query: any = { _id: studentId };

    if (req.user.role === 'institute') {
      const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
      if (!institute) {
        return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      }
      query.institute = institute._id;
    }

    const student = await Student.findOne(query);
    if (!student) {
      return sendError({ req, res, statusCode: 404, message: 'Student not found or unauthorized' });
    }

    if (validatedData.clearAttendance) {
      student.attendancePercentage = undefined as any; // Or whatever works for mongoose number to clear
      student.set('attendancePercentage', undefined);
    } else if (validatedData.attendancePercentage !== undefined) {
      student.attendancePercentage = validatedData.attendancePercentage;
    }
    
    if (validatedData.clearThesis) {
      student.thesisApproved = false;
      student.documents = {
        ...student.documents,
        thesisDocumentUrl: '',
      } as any;
    } else if (validatedData.thesisApproved !== undefined) {
      student.thesisApproved = validatedData.thesisApproved;
    }

    if (!validatedData.clearThesis && req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (files['thesisDocument'] && files['thesisDocument'].length > 0) {
        student.documents = {
          ...student.documents,
          thesisDocumentUrl: getFileUrl(files['thesisDocument'][0].path),
        } as any;
      }
    }

    await student.save();

    const isStudentEligible = student.remittedToAcademy && student.attendancePercentage >= 75 && student.thesisApproved;

    return sendSuccess({
      req,
      res,
      message: 'Student academic metrics updated successfully',
      data: {
        ...student.toObject(),
        isEligible: isStudentEligible,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

export const evaluateEligibility = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const query: any = { _id: studentId };

    if (req.user.role === 'institute') {
      const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
      if (!institute) {
        return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      }
      query.institute = institute._id;
    }

    const student = await Student.findOne(query)
      .populate('course', 'name')
      .populate('batch', 'year');
    if (!student) {
      return sendError({ req, res, statusCode: 404, message: 'Student not found or unauthorized' });
    }

    const checklist = {
      feeStatus: {
        status: student.remittedToAcademy ? 'Paid' : 'Pending',
        isValid: student.remittedToAcademy,
        description: student.remittedToAcademy
          ? 'Remittance payment to academy has been completed.'
          : 'Fee remittance payment of INR 50,000 to the academy is outstanding.',
      },
      attendance: {
        value: student.attendancePercentage,
        threshold: 75,
        isValid: student.attendancePercentage >= 75,
        description: student.attendancePercentage >= 75
          ? `Attendance is ${student.attendancePercentage}%, which meets the minimum 75% requirement.`
          : `Attendance is ${student.attendancePercentage}%, which is below the minimum 75% requirement.`,
      },
      thesisApproval: {
        status: student.thesisApproved ? 'Approved' : 'Pending',
        isValid: student.thesisApproved,
        description: student.thesisApproved
          ? 'Thesis evaluation has been approved by the board.'
          : 'Thesis submission is pending approval or has not been approved.',
      },
    };

    const isEligible = checklist.feeStatus.isValid && checklist.attendance.isValid && checklist.thesisApproval.isValid;

    return sendSuccess({
      req,
      res,
      message: 'Student eligibility evaluated successfully',
      data: {
        student: {
          id: student._id,
          enrollmentId: student.enrollmentId,
          firstName: student.firstName,
          lastName: student.lastName,
          course: student.course,
          batch: student.batch,
        },
        checklist,
        isEligible,
        decision: isEligible ? 'Eligible' : 'Not Eligible',
      },
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

export const getRemittances = async (req: Request, res: Response) => {
  try {
    const query: any = {};
    if (req.user.role === 'institute') {
      const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
      if (!institute) {
        return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      }
      query.institute = institute._id;
    }

    const remittances = await Remittance.find(query)
      .populate('institute', 'orgName')
      .populate('students', 'firstName lastName enrollmentId')
      .sort({ createdAt: -1 });

    return sendSuccess({
      req,
      res,
      message: 'Remittances retrieved successfully',
      data: remittances,
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

export const getStudentById = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const query: any = { _id: studentId };

    if (req.user.role === 'institute') {
      const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
      if (!institute) {
        return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      }
      query.institute = institute._id;
    }

    const student = await Student.findOne(query)
      .populate('course', 'name')
      .populate('batch', 'year')
      .populate('institute', 'orgName');

    if (!student) {
      return sendError({ req, res, statusCode: 404, message: 'Student not found or unauthorized' });
    }

    const isStudentEligible = student.remittedToAcademy && student.attendancePercentage >= 75 && student.thesisApproved;
    const formattedStudent = {
      ...student.toObject(),
      isEligible: isStudentEligible,
    };

    return sendSuccess({
      req,
      res,
      message: 'Student retrieved successfully',
      data: formattedStudent,
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

export const updateStudent = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const validatedData = studentUpdateSchema.parse(req.body);

    const query: any = { _id: studentId };

    if (req.user.role === 'institute') {
      const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
      if (!institute) {
        return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      }
      query.institute = institute._id;
    }

    const student = await Student.findOne(query);
    if (!student) {
      return sendError({ req, res, statusCode: 404, message: 'Student not found or unauthorized' });
    }

    // Verify course if updated
    if (validatedData.courseId) {
      const course = await Course.findById(validatedData.courseId);
      if (!course) {
        return sendError({ req, res, statusCode: 404, message: 'Specified Course does not exist.' });
      }
      student.course = course._id;
    }

    // Verify batch if updated
    if (validatedData.batchId) {
      const batch = await Batch.findById(validatedData.batchId);
      if (!batch) {
        return sendError({ req, res, statusCode: 404, message: 'Specified Batch does not exist.' });
      }
      // If batch is changing, update activeFellows count in old and new batches
      if (student.batch.toString() !== batch._id.toString()) {
        await Batch.findByIdAndUpdate(student.batch, { $inc: { activeFellows: -1 } });
        await Batch.findByIdAndUpdate(batch._id, { $inc: { activeFellows: 1 } });
        student.batch = batch._id;
      }
    }

    // Update other fields
    if (validatedData.firstName) student.firstName = validatedData.firstName;
    if (validatedData.lastName) student.lastName = validatedData.lastName;
    if (validatedData.homeAddress) student.homeAddress = validatedData.homeAddress;
    if (validatedData.contactNumber) student.contactNumber = validatedData.contactNumber;
    if (validatedData.email) student.email = validatedData.email;
    if (validatedData.qualification) student.qualification = validatedData.qualification;
    if (validatedData.mbbsQualification) student.mbbsQualification = validatedData.mbbsQualification;
    if (validatedData.yearOfPassing) student.yearOfPassing = validatedData.yearOfPassing;
    if (validatedData.universityName) student.universityName = validatedData.universityName;
    if (validatedData.medicalCouncilRegistrationNumber) student.medicalCouncilRegistrationNumber = validatedData.medicalCouncilRegistrationNumber;
    if (validatedData.isForeignGraduate !== undefined) student.isForeignGraduate = validatedData.isForeignGraduate;
    if (validatedData.fmgeClearanceStatus) student.fmgeClearanceStatus = validatedData.fmgeClearanceStatus;
    if (validatedData.courseDirector) student.courseDirector = validatedData.courseDirector;
    if (validatedData.utrNumber) student.utrNumber = validatedData.utrNumber;

    // Handle files if uploaded
    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const docFields = [
        'passportPhoto', 'mbbsCertificate', 'medicalCouncilRegistrationCertificate',
        'fmgeResultCopy', 'paymentReceipt', 'semiMembershipForm'
      ];
      
      const newDocs: any = { ...student.documents };
      for (const field of docFields) {
        if (files && files[field] && files[field].length > 0) {
          newDocs[`${field}Url`] = getFileUrl(files[field][0].path);
        }
      }
      student.documents = newDocs;
    }

    await student.save();

    const isStudentEligible = student.remittedToAcademy && student.attendancePercentage >= 75 && student.thesisApproved;
    
    // Fetch updated student with populate
    const updatedStudent = await Student.findById(student._id)
      .populate('course', 'name')
      .populate('batch', 'year')
      .populate('institute', 'orgName');

    const formattedStudent = {
      ...updatedStudent?.toObject(),
      isEligible: isStudentEligible,
    };

    return sendSuccess({
      req,
      res,
      message: 'Student updated successfully',
      data: formattedStudent,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const query: any = { _id: studentId };

    if (req.user.role === 'institute') {
      const institute = await Institute.findOne({ user: req.user._id, status: 'Approved' });
      if (!institute) {
        return sendError({ req, res, statusCode: 403, message: 'Access Denied: Your institute application is not approved yet.' });
      }
      query.institute = institute._id;
    }

    const student = await Student.findOne(query);
    if (!student) {
      return sendError({ req, res, statusCode: 404, message: 'Student not found or unauthorized' });
    }

    // Decrement active fellows in batch
    if (student.batch) {
      await Batch.findByIdAndUpdate(student.batch, { $inc: { activeFellows: -1 } });
    }

    await Student.deleteOne({ _id: student._id });

    return sendSuccess({
      req,
      res,
      message: 'Student deleted/de-enrolled successfully',
      data: { studentId },
    });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};