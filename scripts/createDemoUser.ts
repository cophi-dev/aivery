import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM way to get __dirname equivalent
// const __filename = fileURLToPath(import.meta.url); // No longer needed
// const __dirname = path.dirname(__filename); // No longer needed

// Load environment variables from .env.local file at the root
// dotenv.config({ path: path.resolve(__dirname, '../.env.local') }); // Remove dotenv config

// --- Remove this debug line ---
// console.log('DEBUG: MONGODB_URI loaded:', process.env.MONGODB_URI);
// --------------------------

// Use path aliases configured in tsconfig.json
import dbConnect from '@/lib/db/mongodb';
import UserModel from '@/lib/db/models/user';

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@example.com';
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'demoPassword123'; // Use a more secure default if needed
const DEMO_NAME = 'Demo User';

async function createDemoUser() {
  console.log('Connecting to database...');
  await dbConnect();
  console.log('Database connected.');

  try {
    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: DEMO_EMAIL });
    if (existingUser) {
      console.log(`User with email ${DEMO_EMAIL} already exists.`);
      // Optionally update the existing user's password or details here if needed
      // For now, we'll just exit.
      return;
    }

    console.log(`Creating demo user: ${DEMO_NAME} (${DEMO_EMAIL})`);

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, saltRounds);
    console.log('Password hashed.');

    // Create the user document
    const newUser = new UserModel({
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      password: hashedPassword,
      // Add any other required fields from your UserSchema with default/demo values
      // e.g., tier: 'free', emailVerified: new Date(), etc.
       tier: 'free', // Assuming 'free' is a valid default tier
       // Ensure all *required* fields in your UserSchema are provided
    });

    // Save the user
    await newUser.save();
    console.log('Demo user created successfully!');
    console.log(`ID: ${newUser._id}`);

  } catch (error) {
    console.error('Error creating demo user:', error);
  } finally {
    // Disconnect from the database
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

createDemoUser(); 