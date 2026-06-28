import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User } from './models/userModel';
import { Institute } from './models/instituteModel';
import { Course } from './models/courseModel';
import { Batch } from './models/batchModel';
import { Student } from './models/studentModel';

dotenv.config();

const seedTestData = async () => {
  try {
    console.log('Clearing old test data...');
    // Delete existing test user if any
    const testEmail = 'hospital@swiflare.com';
    const oldUser = await User.findOne({ email: testEmail });
    if (oldUser) {
      await Student.deleteMany({ institute: { $in: [oldUser._id] } }); // delete using query matches
      const oldInst = await Institute.findOne({ user: oldUser._id });
      if (oldInst) {
        await Student.deleteMany({ institute: oldInst._id });
        await Course.deleteMany({ institute: oldInst._id });
        await Batch.deleteMany({ institute: oldInst._id });
        await Institute.deleteOne({ _id: oldInst._id });
      }
      await User.deleteOne({ _id: oldUser._id });
    }

    console.log('Creating test institute user...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Password123!', salt);

    const user = await User.create({
      name: 'Swiflare General Hospital',
      email: testEmail,
      password: hashedPassword,
      role: 'institute',
      isEmailVerified: true,
    });

    console.log('Creating approved Institute profile...');
    const institute = await Institute.create({
      user: user._id,
      orgName: 'Swiflare General Hospital',
      constitutionType: 'Trust',
      instituteAddress: '123 Healthcare Boulevard, Sector 4, Mumbai',
      registeredOfficeAddress: '456 Swiflare Corporate Plaza, Mumbai',
      phoneNumber: '9876543210',
      emailAddress: testEmail,
      commencementDate: new Date('2027-06-30'),
      seatsRequested: 5,
      officePhone: '022-12345678',
      website: 'https://swiflare.com',
      headName: 'Dr. Rajesh Khanna',
      headDesignation: 'Dean & Executive Director',
      hodName: 'Dr. Ananya Sen',
      bedCount: 15,
      physicianAvailability: 'Yes',
      physicianExperience: 36,
      courseDirectorEMQualified: 'Yes',
      emFacultyCount: 3,
      teachingSpace: 'Yes',
      nabhStatus: 'Yes',
      facultyCommitmentLetterUrl: 'http://example.com/commitment.pdf',
      documents: {
        equipmentListUrl: 'http://example.com/equipment.pdf',
        facultyListUrl: 'http://example.com/faculty.pdf',
        emergencyOPDStatisticsUrl: 'http://example.com/opd.pdf',
        libraryBookListUrl: 'http://example.com/library.pdf',
        trainingMannequinListUrl: 'http://example.com/mannequins.pdf',
        diagnosticEquipmentListUrl: 'http://example.com/diagnostic.pdf',
        declarationLetterUrl: 'http://example.com/declaration.pdf',
      },
      status: 'Approved',
      paymentStatus: 'Completed',
    });

    console.log('Creating test Course...');
    const course = await Course.create({
      name: 'Emergency Medicine',
      description: 'Residency Training Program in Emergency Medicine',
      institute: institute._id,
    });

    console.log('Creating test Batch...');
    const batch = await Batch.create({
      course: course._id,
      year: 2026,
      institute: institute._id,
    });

    console.log('Creating 5 test Students with varying metrics...');
    const studentsData = [
      {
        enrollmentId: 'SEMI-2026-1001',
        firstName: 'Aarav',
        lastName: 'Sharma',
        email: 'aarav.sharma@example.com',
        remittedToAcademy: true,
        attendancePercentage: 85,
        thesisApproved: true,
        utrNumber: 'UTR111111',
      },
      {
        enrollmentId: 'SEMI-2026-1002',
        firstName: 'Neha',
        lastName: 'Patel',
        email: 'neha.patel@example.com',
        remittedToAcademy: true,
        attendancePercentage: 68, // Fail (attendance < 75%)
        thesisApproved: true,
        utrNumber: 'UTR222222',
      },
      {
        enrollmentId: 'SEMI-2026-1003',
        firstName: 'Rahul',
        lastName: 'Verma',
        email: 'rahul.verma@example.com',
        remittedToAcademy: true,
        attendancePercentage: 92,
        thesisApproved: false, // Fail (thesis not approved)
        utrNumber: 'UTR333333',
      },
      {
        enrollmentId: 'SEMI-2026-1004',
        firstName: 'Priya',
        lastName: 'Nair',
        email: 'priya.nair@example.com',
        remittedToAcademy: false, // Fail (fee pending)
        attendancePercentage: 88,
        thesisApproved: true,
        utrNumber: 'UTR444444',
      },
      {
        enrollmentId: 'SEMI-2026-1005',
        firstName: 'Karan',
        lastName: 'Malhotra',
        email: 'karan.malhotra@example.com',
        remittedToAcademy: false, // Fail (multiple conditions)
        attendancePercentage: 62, // Fail
        thesisApproved: false, // Fail
        utrNumber: 'UTR555555',
      },
    ];

    for (const s of studentsData) {
      await Student.create({
        ...s,
        homeAddress: '456 Residency Road, Mumbai',
        contactNumber: '9988776655',
        qualification: 'MBBS',
        mbbsQualification: 'MBBS Degree',
        yearOfPassing: 2025,
        universityName: 'MUHS University',
        medicalCouncilRegistrationNumber: `MC-${s.enrollmentId}`,
        isForeignGraduate: false,
        fmgeClearanceStatus: 'Not Applicable',
        course: course._id,
        batch: batch._id,
        institute: institute._id,
        courseDirector: 'Dr. Rajesh Khanna',
        documents: {
          passportPhotoUrl: 'http://example.com/photo.jpg',
          mbbsCertificateUrl: 'http://example.com/mbbs.pdf',
          medicalCouncilRegistrationCertificateUrl: 'http://example.com/registration.pdf',
          paymentReceiptUrl: 'http://example.com/receipt.pdf',
          semiMembershipFormUrl: 'http://example.com/membership.pdf',
        },
      });
    }

    console.log('Test data seeded successfully! 🎉');
    console.log(`Login Email: ${testEmail}`);
    console.log(`Login Password: Password123!`);
  } catch (error: any) {
    console.error(`Error seeding test data: ${error.message}`);
  }
};

const runSeeder = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/my_database');
    console.log('MongoDB Connected for seeding test data.');
    await seedTestData();
    await mongoose.disconnect();
    console.log('MongoDB Disconnected after seeding.');
    process.exit(0);
  } catch (err: any) {
    console.error(`Seeder connection error: ${err.message}`);
    process.exit(1);
  }
};

runSeeder();
