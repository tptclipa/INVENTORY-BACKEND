const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

// Load env vars
dotenv.config();

// Connect to database
mongoose.connect(process.env.MONGODB_URI);

const createAdminUser = async () => {
  try {
    // Check if admin already exists
    const adminExists = await User.findOne({ role: 'admin' });

    if (adminExists) {
      console.log('Admin user already exists');
      console.log('Username:', adminExists.username);
      console.log('Email:', adminExists.email);
      
      // Update the password and name if not set
      adminExists.password = 'T3sda1234';
      if (!adminExists.name) {
        adminExists.name = 'Administrator';
      }
      await adminExists.save();
      console.log('Admin password updated to: T3sda1234');
    } else {
      // Create new admin user
      const admin = await User.create({
        name: 'Administrator',
        username: 'admin',
        email: 'admin@tesda.gov.ph',
        password: 'T3sda1234',
        role: 'admin'
      });

      console.log('Admin user created successfully!');
      console.log('Username:', admin.username);
      console.log('Email:', admin.email);
      console.log('Password: T3sda1234');
      console.log('Role:', admin.role);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();
