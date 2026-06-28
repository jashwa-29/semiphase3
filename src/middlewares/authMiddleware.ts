import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/userModel';
import { sendError } from '../utils/responseFormatter';

interface JwtPayload {
  id: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as JwtPayload;

      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return sendError({ req, res, statusCode: 401, message: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      return sendError({ req, res, statusCode: 401, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return sendError({ req, res, statusCode: 401, message: 'Not authorized, no token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError({ req, res, statusCode: 403, message: `User role ${req.user?.role} is not authorized to access this route` });
    }
    next();
  };
};
