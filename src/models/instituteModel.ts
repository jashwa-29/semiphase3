import mongoose, { Document, Schema } from 'mongoose';

export interface IInstitute extends Document {
  user: mongoose.Types.ObjectId;
  orgName: string;
  constitutionType: string;
  instituteAddress: string;
  registeredOfficeAddress: string;
  phoneNumber: string;
  emailAddress: string;
  commencementDate: Date;
  seatsRequested: number;
  officePhone?: string;
  website?: string;
  headName: string;
  headDesignation: string;
  hodName: string;
  bedCount: number;
  physicianAvailability: 'Yes' | 'No';
  physicianExperience: number;
  courseDirectorEMQualified: 'Yes' | 'No';
  emFacultyCount: number;
  teachingSpace: 'Yes' | 'No';
  nabhStatus: 'Yes' | 'No';
  paymentBankName?: string;
  paymentTxnNo?: string;
  paymentTxnDate?: string;
  authorizedRepName?: string;
  authorizedRepDesignation?: string;
  facultyCommitmentLetterUrl: string;
  documents: {
    equipmentListUrl?: string;
    facultyListUrl?: string;
    emergencyOPDStatisticsUrl?: string;
    libraryBookListUrl?: string;
    trainingMannequinListUrl?: string;
    diagnosticEquipmentListUrl?: string;
    declarationLetterUrl?: string;
    inspectionPaymentReceiptUrl?: string;
    applicantSignatureUrl?: string;
    hodSignatureAndSealUrl?: string;
    headOfInstitutionSignatureAndSealUrl?: string;
  };
  status: 'Pending Review' | 'Approved' | 'Rejected';
  paymentStatus: 'Pending' | 'Completed';
  inspectionTriggered: boolean;
  remarks?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}

const instituteSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    orgName: { type: String, required: true },
    constitutionType: { 
      type: String, 
      required: true,
      enum: ['University', 'State Government', 'Autonomous Body', 'Union Territory', 'Society', 'Trust', 'Society / Trust']
    },
    instituteAddress: { type: String, required: true },
    registeredOfficeAddress: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    emailAddress: { type: String, required: true },
    commencementDate: { type: Date, required: true },
    seatsRequested: { type: Number, required: true },
    officePhone: { type: String, default: '' },
    website: { type: String, default: '' },
    headName: { type: String, required: true },
    headDesignation: { type: String, required: true },
    hodName: { type: String, required: true },
    bedCount: { type: Number, required: true },
    physicianAvailability: { type: String, enum: ['Yes', 'No'], default: 'Yes' },
    physicianExperience: { type: Number, required: true },
    courseDirectorEMQualified: { type: String, enum: ['Yes', 'No'], default: 'Yes' },
    emFacultyCount: { type: Number, required: true },
    teachingSpace: { type: String, enum: ['Yes', 'No'], default: 'Yes' },
    nabhStatus: { type: String, enum: ['Yes', 'No'], default: 'Yes' },
    paymentBankName: { type: String, default: '' },
    paymentTxnNo: { type: String, default: '' },
    paymentTxnDate: { type: String, default: '' },
    authorizedRepName: { type: String, default: '' },
    authorizedRepDesignation: { type: String, default: '' },
    facultyCommitmentLetterUrl: { type: String, required: true },
    applicationDate: { type: Date },
    cityAndState: { type: String },
    pincode: { type: String },
    contactNumbers: { type: String },
    emailId: { type: String },
    documents: {
      equipmentListUrl: { type: String, required: true },
      facultyListUrl: { type: String, required: true },
      emergencyOPDStatisticsUrl: { type: String, required: true },
      libraryBookListUrl: { type: String, required: true },
      trainingMannequinListUrl: { type: String, required: true },
      diagnosticEquipmentListUrl: { type: String, required: true },
      declarationLetterUrl: { type: String, required: true },
      inspectionPaymentReceiptUrl: { type: String },
      applicantSignatureUrl: { type: String },
      hodSignatureAndSealUrl: { type: String },
      headOfInstitutionSignatureAndSealUrl: { type: String },
    },
    status: {
      type: String,
      enum: ['Pending Review', 'Approved', 'Rejected'],
      default: 'Pending Review',
      index: true
    },
    paymentStatus: {
      type: String, 
      enum: ['Pending', 'Completed'],
      default: 'Pending'
    },
    inspectionTriggered: {
      type: Boolean,
      default: false
    },
    remarks: {
      type: String,
      default: ''
    },
    razorpayOrderId: {
      type: String,
      default: ''
    },
    razorpayPaymentId: {
      type: String,
      default: ''
    },
    razorpaySignature: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
  }
);

export const Institute = mongoose.model<IInstitute>('Institute', instituteSchema);