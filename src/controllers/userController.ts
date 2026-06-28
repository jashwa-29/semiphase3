import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/userModel';
import { sendSuccess, sendError } from '../utils/responseFormatter';

const createAdminSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'board']).default('admin'),
});

// @desc    Get all users
// @route   GET /api/users
// @access  Public
export const getUsers = async (req: Request, res: Response): Promise<any> => {
  try {
    const users = await User.find({}).select('-password');
    return sendSuccess({
      req,
      res,
      message: 'Users retrieved successfully',
      data: users,
    });
  } catch (error: any) {
    return sendError({
      req,
      res,
      statusCode: 500,
      message: 'Server Error',
      errors: [error.message],
    });
  }
};

// @desc    Create a new admin or board user
// @route   POST /api/users/create-admin
// @access  Private (Super Admin Only)
export const createAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = createAdminSchema.parse(req.body);

    const userExists = await User.findOne({ email: validatedData.email });
    if (userExists) {
      return sendError({ req, res, statusCode: 400, message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);
    const adminUser = await User.create({
      name: validatedData.name,
      email: validatedData.email,
      password: hashedPassword,
      role: validatedData.role,
      isEmailVerified: true, // admin accounts created by super admin are active immediately
    });

    return sendSuccess({
      req,
      res,
      statusCode: 201,
      message: `${validatedData.role === 'board' ? 'Board member' : 'Admin'} created successfully`,
      data: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw error;
    }
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};
