import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/responseFormatter';

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  // Log full stack trace for unhandled errors
  console.error(`🔥 Unhandled Error at [${req.method} ${req.originalUrl}]:`, err);
  
  const errors = err.errors || [];
  
  if (err.name === 'ZodError') {
    const zodIssues = err.errors ?? err.issues ?? [];

    return sendError({
      req,
      res,
      statusCode: 400,
      message: 'Validation failed',
      errors: zodIssues.map((e: any) => ({
        field: (e.path || []).join('.'),
        code: e.code,
        message: e.message
      }))
    });
  }

  sendError({
    req,
    res,
    statusCode,
    message: err.message || 'Internal Server Error',
    errors: process.env.NODE_ENV === 'production' ? [] : [{ message: err.message, stack: err.stack, ...errors }]
  });
};
