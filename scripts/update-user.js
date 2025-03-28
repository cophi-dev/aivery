require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable');
  process.exit(1);
}

async function updateUserNickname() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create a model without schema validation
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');

    // Find the user
    const userId = '67e45550414750fb9f19d87c';
    const user = await User.findById(userId);
    
    if (!user) {
      console.error('User not found');
      process.exit(1);
    }
    
    console.log('Found user:', user.name, user.email);
    console.log('Current nickname:', user.nickname);
    
    // Update nickname
    user.nickname = 'Cophi';
    await user.save();
    console.log('Nickname updated to "Cophi"');
    
    // Verify update
    const updatedUser = await User.findById(userId);
    console.log('Verified nickname:', updatedUser.nickname);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateUserNickname(); 