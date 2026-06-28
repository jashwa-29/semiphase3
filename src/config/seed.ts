import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User } from '../models/userModel';

dotenv.config();

export const seedSuperAdmin = async () => {
  try {
    const superAdminEmail = 'superadmin@academy.com';
    const superAdminExists = await User.findOne({ email: superAdminEmail });

    if (!superAdminExists) {
      console.log('Seeding Academy Super Admin...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('SuperAdmin123!', salt);

      await User.create({
        name: 'Academy Super Admin',
        email: superAdminEmail,
        password: hashedPassword,
        role: 'super_admin',
        isEmailVerified: true,
      });

      console.log('Academy Super Admin seeded successfully! 🎉');
    } else {
      console.log('Academy Super Admin already exists. Skipping seed.');
    }
  } catch (error: any) {
    console.error(`Error seeding Super Admin: ${error.message}`);
  }
};

// If run directly via command line
if (require.main === module) {
  const runSeeder = async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/my_database');
      console.log('MongoDB Connected for seeding.');
      await seedSuperAdmin();
      await mongoose.disconnect();
      console.log('MongoDB Disconnected after seeding.');
      process.exit(0);
    } catch (err: any) {
      console.error(`Seeder connection error: ${err.message}`);
      process.exit(1);
    }
  };
  runSeeder();
}
