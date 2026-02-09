const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

// Load env vars
dotenv.config();

// Connect to database
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const createUser = async () => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ username: 'user' });
    
    if (existingUser) {
      console.log('Regular user already exists');
      process.exit(0);
    }

    // Create regular user
    const user = await User.create({
      name: 'Regular User',
      username: 'user',
      email: 'user@tesda.gov.ph',
      password: 'user123',
      role: 'user'
    });

    console.log('Regular user created successfully!');
    console.log('Name: Regular User');
    console.log('Username: user');
    console.log('Password: user123');
    console.log('Email: user@tesda.gov.ph');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error);
    process.exit(1);
  }
};

createUser();
