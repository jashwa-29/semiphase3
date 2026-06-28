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
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:5173'];
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

// Add request ID middleware
app.use((req: any, res: Response, next) => {
  req.requestId = uuidv4();
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
