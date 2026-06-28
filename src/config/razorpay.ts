import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

// Check if keys are properly configured in .env
export const isRazorpayConfigured = !!(keyId && keySecret);

let razorpayInstance: any = null;

if (isRazorpayConfigured) {
  try {
    razorpayInstance = new Razorpay({
      key_id: keyId as string,
      key_secret: keySecret as string,
    });
  } catch (error) {
    console.error('Failed to initialize Razorpay SDK:', error);
  }
} else {
  console.warn(
    'WARNING: Razorpay credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are missing from .env. Running in Mock Mode.'
  );
}

export default razorpayInstance;
export { keyId, keySecret };
