import mongoose, { Document, Schema } from 'mongoose';

export interface IHallTicket extends Document {
  ticketId: string;
  examApplication: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  institute: mongoose.Types.ObjectId;

  // Denormalised student info (snapshot at generation time)
  enrollmentId: string;
  studentName: string;
  contactNumber: string;
  photoUrl?: string;

  // Denormalised institute info
  instituteName: string;
  instituteAddress: string;

  // Denormalised course / batch info
  courseName: string;
  batchYear: number;

  // Exam schedule info
  subjects: string[];
  examDate: Date;
  examVenue: string;
  examCenter: string;
  reportingTime: string;

  // Download tracking
  isDownloaded: boolean;
  downloadedAt?: Date;
}

const hallTicketSchema: Schema = new Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
    },
    examApplication: {
      type: Schema.Types.ObjectId,
      ref: 'ExamApplication',
      required: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    institute: {
      type: Schema.Types.ObjectId,
      ref: 'Institute',
      required: true,
    },

    // Student snapshot
    enrollmentId:  { type: String, required: true },
    studentName:   { type: String, required: true },
    contactNumber: { type: String, required: true },
    photoUrl:      { type: String },

    // Institute snapshot
    instituteName:    { type: String, required: true },
    instituteAddress: { type: String, required: true },

    // Course / batch snapshot
    courseName: { type: String, required: true },
    batchYear:  { type: Number, required: true },

    // Exam details
    subjects:      { type: [String], required: true },
    examDate:      { type: Date,   required: true },
    examVenue:     { type: String, required: true },
    examCenter:    { type: String, required: true },
    reportingTime: { type: String, required: true },

    // Download tracking
    isDownloaded: { type: Boolean, default: false },
    downloadedAt: { type: Date },
  },
  { timestamps: true }
);

export const HallTicket = mongoose.model<IHallTicket>('HallTicket', hallTicketSchema);
