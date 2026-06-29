import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { connectDB } from './config/db';
import { seedSuperAdmin } from './config/seed';
import userRoutes from './routes/userRoutes';
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/authRoutes';
import instituteRoutes from './routes/instituteRoutes';
import academicRoutes from './routes/academicRoutes';
import examRoutes from './routes/examRoutes';
import { notFound, errorHandler } from './middlewares/errorMiddleware';

dotenv.config();

// Connect to database and seed Super Admin
const initApp = async () => {
  await connectDB();
  await seedSuperAdmin();
};
initApp();

const app = express();
const PORT = process.env.PORT || 5003;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

if (process.env.FRONTEND_URL) {
  const cleanFrontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
  allowedOrigins.push(cleanFrontendUrl);
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// Add request ID and detailed request/response logger middleware
app.use((req: any, res: any, next) => {
  req.requestId = uuidv4();
  
  const startTime = Date.now();
  console.log(`\n--- 📥 [${req.requestId}] Incoming Request: ${req.method} ${req.originalUrl}`);
  if (req.body && Object.keys(req.body).length > 0) {
    const loggedBody = { ...req.body };
    if (loggedBody.password) loggedBody.password = '[HIDDEN]';
    console.log(`[${req.requestId}] Request Body:`, JSON.stringify(loggedBody, null, 2));
  }

  // Intercept res.json to log the response
  const originalJson = res.json;
  res.json = function (body: any) {
    const duration = Date.now() - startTime;
    console.log(`--- 📤 [${req.requestId}] Response JSON Sent: ${res.statusCode} (took ${duration}ms)`);
    console.log(`[${req.requestId}] Response Body:`, JSON.stringify(body, null, 2));
    return originalJson.apply(this, arguments);
  };

  // Intercept res.send to log the response
  const originalSend = res.send;
  res.send = function (body: any) {
    const duration = Date.now() - startTime;
    console.log(`--- 📤 [${req.requestId}] Response Send Sent: ${res.statusCode} (took ${duration}ms)`);
    if (typeof body === 'string') {
      console.log(`[${req.requestId}] Response Body:`, body.length > 500 ? body.substring(0, 500) + '...' : body);
    }
    return originalSend.apply(this, arguments);
  };

  next();
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/institutes', instituteRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/exams', examRoutes);

// Basic Route
app.get('/', (req: Request, res: Response) => {
  res.send('Backend server is running with MVC Architecture!');
});

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
