import mongoose, { Document, Schema } from 'mongoose';

export interface IStudent extends Document {
  enrollmentId: string;
  firstName: string;
  lastName: string;
  homeAddress: string;
  contactNumber: string;
  email: string;
  qualification: string;
  mbbsQualification: string;
  yearOfPassing: number;
  universityName: string;
  medicalCouncilRegistrationNumber: string;
  isForeignGraduate: boolean;
  fmgeClearanceStatus?: 'Cleared' | 'Not Applicable' | 'Failed';
  course: mongoose.Types.ObjectId;
  batch: mongoose.Types.ObjectId;
  institute: mongoose.Types.ObjectId;
  courseDirector: string;
  utrNumber: string;
  documents: {
    passportPhotoUrl: string;
    mbbsCertificateUrl: string;
    medicalCouncilRegistrationCertificateUrl: string;
    fmgeResultCopyUrl?: string;
    paymentReceiptUrl: string;
    semiMembershipFormUrl: string;
    thesisDocumentUrl?: string;
  };
  remittedToAcademy: boolean;
  remittanceRecord?: mongoose.Types.ObjectId;
  attendancePercentage: number;
  thesisApproved: boolean;
}

const studentSchema: Schema = new Schema(
  {
    enrollmentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    homeAddress: {
      type: String,
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    qualification: {
      type: String,
      required: true,
    },
    mbbsQualification: {
      type: String,
      required: true,
    },
    yearOfPassing: {
      type: Number,
      required: true,
    },
    universityName: {
      type: String,
      required: true,
    },
    medicalCouncilRegistrationNumber: {
      type: String,
      required: true,
    },
    isForeignGraduate: {
      type: Boolean,
      required: true,
      default: false,
    },
    fmgeClearanceStatus: {
      type: String,
      enum: ['Cleared', 'Not Applicable', 'Failed'],
      default: 'Not Applicable',
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
    institute: {
      type: Schema.Types.ObjectId,
      ref: 'Institute',
      required: true,
    },
    courseDirector: {
      type: String,
      required: true,
    },
    utrNumber: {
      type: String,
      required: true,
    },
    documents: {
      passportPhotoUrl: { type: String, required: true },
      mbbsCertificateUrl: { type: String, required: true },
      medicalCouncilRegistrationCertificateUrl: { type: String, required: true },
      fmgeResultCopyUrl: { type: String },
      paymentReceiptUrl: { type: String, required: true },
      semiMembershipFormUrl: { type: String, required: true },
      thesisDocumentUrl: { type: String },
    },
    remittedToAcademy: {
      type: Boolean,
      required: true,
      default: false,
    },
    attendancePercentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    thesisApproved: {
      type: Boolean,
      required: true,
      default: false,
    },
    remittanceRecord: {
      type: Schema.Types.ObjectId,
      ref: 'Remittance',
    },
  },
  {
    timestamps: true,
  }
);

export const Student = mongoose.model<IStudent>('Student', studentSchema);
