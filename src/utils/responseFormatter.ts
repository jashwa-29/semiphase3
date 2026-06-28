import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';

interface SuccessResponseParams {
  req?: Request;
  res: Response;
  message?: string;
  data?: any;
  statusCode?: number;
}

interface ErrorResponseParams {
  req?: Request;
  res: Response;
  message?: string;
  errors?: any[];
  statusCode?: number;
}

export const sendSuccess = ({ req, res, message = 'Operation successful', data = {}, statusCode = 200 }: SuccessResponseParams) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    errors: [],
    timestamp: new Date().toISOString(),
    requestId: (req as any)?.requestId || uuidv4(),
  });
};

export const sendError = ({ req, res, message = 'Operation failed', errors = [], statusCode = 400 }: ErrorResponseParams) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
    requestId: (req as any)?.requestId || uuidv4(),
  });
};
