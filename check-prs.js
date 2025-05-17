require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Load models
    const ExercisePRModel = require('./src/lib/db/models/exercisePR').default;
    
    // Find all situp PRs
    const situpPRs = await ExercisePRModel.find({ 
      exerciseName: /sit.*up/i
    }).sort({ value: -1 });
    
    console.log('Situp PRs found:', situpPRs.length);
    console.log(JSON.stringify(situpPRs, null, 2));
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 