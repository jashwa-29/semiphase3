import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/userModel';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';  
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail';

const registerSchema = z.object({
  name: z.string().min(1, 'Health Care Organization Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'OTP is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const generateToken = (id: string, type: 'access' | 'refresh') => {
  const secret = type === 'access' ? process.env.JWT_SECRET || 'secret' : process.env.JWT_REFRESH_SECRET || 'refresh_secret';
  const expiresIn = type === 'access' ? '15m' : '7d';
  return jwt.sign({ id }, secret, { expiresIn });
};

export const register = async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      return sendError({ req, res, statusCode: 400, message: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);

    const verificationToken = crypto.randomBytes(20).toString('hex');

    const user = await User.create({
      name: validatedData.name,
      email: validatedData.email,
      password: hashedPassword,
      verificationToken,
      role: 'institute',
    });

    // In a real app, send an email with the verificationToken here
    try {
      const verificationLink = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;
      await sendEmail({
        email: user.email,
        subject: 'Email Verification - Semi Phase 3',
        message: `Welcome to Semi Phase 3! Please verify your email by clicking: ${verificationLink}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #333333; text-align: center;">Verify Your Email</h2>
            <p>Hello ${user.name},</p>
            <p>Thank you for registering. Please click the button below to verify your email address and activate your account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" style="background-color: #0146d8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email</a>
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #0146d8;">${verificationLink}</p>
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999999; text-align: center;">This is an automated email. Please do not reply.</p>
          </div>
        `
      });
    } catch (emailErr: any) {
      console.error('Email verification sending failed:', emailErr.message);
    }

    return sendSuccess({
      req,
      res,
      statusCode: 201,
      message: 'Registration successful. Please verify your email.',
      data: {
        userId: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error; // Let error middleware handle it
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validatedData.email });
    if (!user || !user.password) {
      return sendError({ req, res, statusCode: 401, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(validatedData.password, user.password);
    if (!isMatch) {
      return sendError({ req, res, statusCode: 401, message: 'Invalid email or password' });
    }

    if (!user.isEmailVerified) {
      return sendError({ req, res, statusCode: 403, message: 'Please verify your email address before logging in.' });
    }

    const accessToken = generateToken(user._id.toString(), 'access');
    const refreshToken = generateToken(user._id.toString(), 'refresh');

    return sendSuccess({
      req,
      res,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  // In a real application, you might want to blacklist the token or remove refresh token from db
  return sendSuccess({ req, res, message: 'Logout successful' });
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return sendError({ req, res, statusCode: 400, message: 'Refresh token is required' });


    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'refresh_secret') as any;
    const accessToken = generateToken(decoded.id, 'access');

    return sendSuccess({ req, res, message: 'Token refreshed', data: { accessToken } });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 401, message: 'Invalid or expired refresh token' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return sendError({ req, res, statusCode: 404, message: 'User not found' });

    // Restrict forgot password to super_admin and institute roles
    if (user.role !== 'super_admin' && user.role !== 'institute') {
      return sendError({
        req,
        res,
        statusCode: 403,
        message: 'Password reset via OTP is only available for Super Admin and Institute roles.'
      });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = otp;
    user.resetPasswordExpires = new Date(Date.now() + 600000); // 10 minutes
    await user.save();

    // Send email with OTP
    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset OTP - Semi Phase 3',
        message: `Your One-Time Password (OTP) for resetting password is: ${otp}. This code is valid for 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #333333; text-align: center;">Password Reset OTP</h2>
            <p>Hello ${user.name},</p>
            <p>We received a request to reset your password. Use the following One-Time Password (OTP) to complete the process. This OTP is valid for 10 minutes.</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background-color: #f5f5f5; padding: 10px 20px; border-radius: 5px; border: 1px dashed #cccccc; color: #0146d8; display: inline-block;">${otp}</span>
            </div>
            <p>If you did not request a password reset, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999999; text-align: center;">This is an automated email. Please do not reply.</p>
          </div>
        `
      });
    } catch (emailErr: any) {
      // Revert saved OTP if email sending fails so they can retry
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return sendError({ req, res, statusCode: 500, message: `Email could not be sent: ${emailErr.message}` });
    }

    return sendSuccess({ req, res, message: 'Password reset OTP sent to email' });
  } catch (error: any) {
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const validatedData = resetPasswordSchema.parse(req.body);
    const { token, newPassword } = validatedData; // 'token' here acts as the OTP
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) return sendError({ req, res, statusCode: 400, message: 'Invalid or expired OTP' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return sendSuccess({ req, res, message: 'Password reset successful' });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    return sendError({ req, res, statusCode: 500, message: error.message });
  }
};

const successHtml = (name: string) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verified — Semi Phase 3</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Inter', sans-serif;
        background: #0a0f1e;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      /* animated background blobs */
      body::before {
        content: '';
        position: fixed;
        top: -30%;
        left: -20%;
        width: 600px;
        height: 600px;
        background: radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%);
        border-radius: 50%;
        animation: floatBlob 8s ease-in-out infinite alternate;
      }
      body::after {
        content: '';
        position: fixed;
        bottom: -20%;
        right: -10%;
        width: 500px;
        height: 500px;
        background: radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%);
        border-radius: 50%;
        animation: floatBlob 10s ease-in-out infinite alternate-reverse;
      }
      @keyframes floatBlob {
        from { transform: translate(0, 0) scale(1); }
        to   { transform: translate(40px, 30px) scale(1.08); }
      }
      .card {
        position: relative;
        background: linear-gradient(145deg, #111827, #0f172a);
        border: 1px solid rgba(34,197,94,0.2);
        border-radius: 24px;
        padding: 56px 48px;
        max-width: 480px;
        width: 92%;
        text-align: center;
        box-shadow: 0 0 60px rgba(34,197,94,0.08), 0 25px 60px rgba(0,0,0,0.6);
        animation: slideUp 0.6s cubic-bezier(0.22,1,0.36,1) both;
        z-index: 1;
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(40px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      /* top border accent */
      .card::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 24px;
        padding: 1px;
        background: linear-gradient(135deg, rgba(34,197,94,0.5), rgba(99,102,241,0.2));
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }
      .icon-wrap {
        width: 88px;
        height: 88px;
        margin: 0 auto 28px;
        background: radial-gradient(circle, rgba(34,197,94,0.18) 0%, transparent 70%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: popIn 0.5s 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
      }
      @keyframes popIn {
        from { opacity: 0; transform: scale(0.4); }
        to   { opacity: 1; transform: scale(1); }
      }
      .icon-wrap svg {
        width: 44px;
        height: 44px;
        stroke: #22c55e;
        stroke-width: 2.5;
        filter: drop-shadow(0 0 12px rgba(34,197,94,0.6));
      }
      .badge {
        display: inline-block;
        background: rgba(34,197,94,0.1);
        border: 1px solid rgba(34,197,94,0.3);
        color: #4ade80;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 2px;
        text-transform: uppercase;
        padding: 5px 14px;
        border-radius: 100px;
        margin-bottom: 20px;
        animation: fadeIn 0.4s 0.5s ease both;
      }
      h1 {
        font-size: 26px;
        font-weight: 700;
        color: #f9fafb;
        margin-bottom: 12px;
        line-height: 1.3;
        animation: fadeIn 0.4s 0.55s ease both;
      }
      p {
        font-size: 15px;
        color: #94a3b8;
        line-height: 1.7;
        margin-bottom: 8px;
        animation: fadeIn 0.4s 0.6s ease both;
      }
      p strong { color: #cbd5e1; }
      .divider {
        width: 48px;
        height: 2px;
        background: linear-gradient(90deg, transparent, #22c55e, transparent);
        border-radius: 2px;
        margin: 28px auto;
        animation: fadeIn 0.4s 0.65s ease both;
      }
      .btn {
        display: inline-block;
        margin-top: 8px;
        padding: 14px 36px;
        background: linear-gradient(135deg, #16a34a, #22c55e);
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        border-radius: 12px;
        text-decoration: none;
        letter-spacing: 0.3px;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 20px rgba(34,197,94,0.35);
        animation: fadeIn 0.4s 0.7s ease both;
      }
      .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 28px rgba(34,197,94,0.5);
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .footer {
        margin-top: 36px;
        font-size: 12px;
        color: #475569;
        animation: fadeIn 0.4s 0.8s ease both;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <div class="badge">✓ Verified</div>
      <h1>Email Verified Successfully!</h1>
      <p>Hello <strong>${name}</strong>, your email address has been confirmed and your account is now fully active.</p>
      <p>You can now sign in and begin your institute onboarding journey.</p>
      <div class="divider"></div>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="btn">
        Proceed to Login →
      </a>
      <div class="footer">Semi Phase 3 &mdash; Institute Onboarding Platform</div>
    </div>
  </body>
  </html>
`;

const failureHtml = (reason: string) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Failed — Semi Phase 3</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Inter', sans-serif;
        background: #0a0f1e;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      body::before {
        content: '';
        position: fixed;
        top: -30%;
        right: -20%;
        width: 600px;
        height: 600px;
        background: radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 70%);
        border-radius: 50%;
        animation: floatBlob 8s ease-in-out infinite alternate;
      }
      body::after {
        content: '';
        position: fixed;
        bottom: -20%;
        left: -10%;
        width: 500px;
        height: 500px;
        background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%);
        border-radius: 50%;
        animation: floatBlob 10s ease-in-out infinite alternate-reverse;
      }
      @keyframes floatBlob {
        from { transform: translate(0, 0) scale(1); }
        to   { transform: translate(40px, 30px) scale(1.08); }
      }
      .card {
        position: relative;
        background: linear-gradient(145deg, #111827, #0f172a);
        border: 1px solid rgba(239,68,68,0.2);
        border-radius: 24px;
        padding: 56px 48px;
        max-width: 480px;
        width: 92%;
        text-align: center;
        box-shadow: 0 0 60px rgba(239,68,68,0.06), 0 25px 60px rgba(0,0,0,0.6);
        animation: slideUp 0.6s cubic-bezier(0.22,1,0.36,1) both;
        z-index: 1;
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(40px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .card::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 24px;
        padding: 1px;
        background: linear-gradient(135deg, rgba(239,68,68,0.4), rgba(99,102,241,0.15));
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }
      .icon-wrap {
        width: 88px;
        height: 88px;
        margin: 0 auto 28px;
        background: radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: popIn 0.5s 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
      }
      @keyframes popIn {
        from { opacity: 0; transform: scale(0.4); }
        to   { opacity: 1; transform: scale(1); }
      }
      .icon-wrap svg {
        width: 44px;
        height: 44px;
        stroke: #ef4444;
        stroke-width: 2.5;
        filter: drop-shadow(0 0 12px rgba(239,68,68,0.55));
      }
      .badge {
        display: inline-block;
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.3);
        color: #f87171;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 2px;
        text-transform: uppercase;
        padding: 5px 14px;
        border-radius: 100px;
        margin-bottom: 20px;
        animation: fadeIn 0.4s 0.5s ease both;
      }
      h1 {
        font-size: 26px;
        font-weight: 700;
        color: #f9fafb;
        margin-bottom: 12px;
        line-height: 1.3;
        animation: fadeIn 0.4s 0.55s ease both;
      }
      p {
        font-size: 15px;
        color: #94a3b8;
        line-height: 1.7;
        margin-bottom: 8px;
        animation: fadeIn 0.4s 0.6s ease both;
      }
      .reason-box {
        background: rgba(239,68,68,0.07);
        border: 1px solid rgba(239,68,68,0.2);
        border-radius: 10px;
        padding: 12px 16px;
        font-size: 13px;
        color: #f87171;
        margin: 16px 0 8px;
        animation: fadeIn 0.4s 0.65s ease both;
      }
      .divider {
        width: 48px;
        height: 2px;
        background: linear-gradient(90deg, transparent, #ef4444, transparent);
        border-radius: 2px;
        margin: 28px auto;
        animation: fadeIn 0.4s 0.65s ease both;
      }
      .btn {
        display: inline-block;
        margin-top: 8px;
        padding: 14px 36px;
        background: linear-gradient(135deg, #b91c1c, #ef4444);
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        border-radius: 12px;
        text-decoration: none;
        letter-spacing: 0.3px;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 20px rgba(239,68,68,0.3);
        animation: fadeIn 0.4s 0.7s ease both;
      }
      .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 28px rgba(239,68,68,0.45);
      }
      .btn-ghost {
        display: inline-block;
        margin-top: 14px;
        padding: 12px 30px;
        background: transparent;
        color: #64748b;
        font-size: 14px;
        font-weight: 500;
        border-radius: 12px;
        text-decoration: none;
        border: 1px solid rgba(100,116,139,0.25);
        transition: color 0.2s, border-color 0.2s;
        animation: fadeIn 0.4s 0.75s ease both;
      }
      .btn-ghost:hover { color: #94a3b8; border-color: rgba(100,116,139,0.5); }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .footer {
        margin-top: 36px;
        font-size: 12px;
        color: #475569;
        animation: fadeIn 0.4s 0.85s ease both;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <div class="badge">✕ Failed</div>
      <h1>Verification Failed</h1>
      <p>We were unable to verify your email address. The link may have already been used or has expired.</p>
      <div class="reason-box">Reason: ${reason}</div>
      <div class="divider"></div>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/register" class="btn">
        Register Again
      </a>
      <br/>
      <a href="mailto:${process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || 'support@semiphase3.com'}" class="btn-ghost">
        Contact Support
      </a>
      <div class="footer">Semi Phase 3 &mdash; Institute Onboarding Platform</div>
    </div>
  </body>
  </html>
`;

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(failureHtml('Invalid or already used verification link.'));
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(successHtml(user.name));
  } catch (error: any) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(failureHtml('An unexpected server error occurred. Please try again later.'));
  }
};
