import mongoose, { Document, Schema } from 'mongoose';

export interface IExamApplication extends Document {
  institute: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  batch: mongoose.Types.ObjectId;
  students: mongoose.Types.ObjectId[];
  subjects: string[];

  // Status lifecycle: Pending → Approved → SchedulePublished | Rejected
  status: 'Pending' | 'Approved' | 'SchedulePublished' | 'Rejected';

  // Set during Review (Approve step)
  scheduledDate?: Date;
  remarks?: string;

  // Set during Publish Schedule step
  examVenue?: string;
  examCenter?: string;
  reportingTime?: string;
  schedulePublishedAt?: Date;
  subjectSchedules?: { subject: string; date: Date; time: string }[];

  // Hall ticket tracking
  hallTicketsGenerated: boolean;
  hallTicketsGeneratedAt?: Date;

  // Exam fee payment (now optional as fee is collected elsewhere)
  utrNumber?: string;
  examFeeReceiptUrl?: string;
}

const examApplicationSchema: Schema = new Schema(
  {
    institute: {
      type: Schema.Types.ObjectId,
      ref: 'Institute',
      required: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    batch: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
    },
    students: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
      },
    ],
    subjects: {
      type: [String],
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'SchedulePublished', 'Rejected'],
      default: 'Pending',
    },

    // Review step
    scheduledDate: { type: Date },
    remarks: { type: String },

    // Publish Schedule step
    examVenue:           { type: String },
    examCenter:          { type: String },
    reportingTime:       { type: String },
    schedulePublishedAt: { type: Date },
    subjectSchedules: [
      {
        subject: { type: String, required: true },
        date: { type: Date, required: true },
        time: { type: String, required: true }
      }
    ],

    // Hall ticket tracking
    hallTicketsGenerated:   { type: Boolean, default: false },
    hallTicketsGeneratedAt: { type: Date },

    // Exam fee payment
    utrNumber: {
      type: String,
      required: false,
    },
    examFeeReceiptUrl: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

export const ExamApplication = mongoose.model<IExamApplication>('ExamApplication', examApplicationSchema);
