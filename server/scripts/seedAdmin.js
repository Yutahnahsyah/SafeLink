const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/user');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database connected for admin seeding...');

    // Check if any admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin account already exists. Skipping seed.');
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, salt);

    const adminUser = new User({
      firstName: process.env.INITIAL_ADMIN_FIRSTNAME,
      lastName: process.env.INITIAL_ADMIN_LASTNAME,
      email: process.env.INITIAL_ADMIN_EMAIL,
      password: hashedPassword,
      phoneNumber: process.env.INITIAL_ADMIN_PHONE,
      role: 'admin',
      isVerified: true,
      jurisdiction: {
        barangay: 'All',
        municipalityOrCity: 'All'
      }
    });

    await adminUser.save();
    console.log(`Initial Admin account created successfully: ${adminUser.email}`);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding admin account:', err);
    process.exit(1);
  }
};

seedAdmin();