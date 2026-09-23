const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/user');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database connected for admin seeding...');

    const adminEmail = process.env.INITIAL_ADMIN_EMAIL.toLowerCase().trim();
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      if (existingAdmin.role !== 'admin') {
        console.error('The configured initial admin email already belongs to a non-admin account.');
        process.exit(1);
      }

      if (existingAdmin.status === 'pending') {
        existingAdmin.isVerified = true;
        existingAdmin.status = 'active';
        await existingAdmin.save();
        console.log(`Initial Admin account activated successfully: ${existingAdmin.email}`);
      } else if (existingAdmin.status === 'suspended') {
        console.log('Initial Admin account is suspended. Its status was not changed.');
      } else {
        console.log('Initial Admin account already exists and is active. Skipping seed.');
      }
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, salt);

    const adminUser = new User({
      firstName: process.env.INITIAL_ADMIN_FIRSTNAME,
      lastName: process.env.INITIAL_ADMIN_LASTNAME,
      email: adminEmail,
      password: hashedPassword,
      phoneNumber: process.env.INITIAL_ADMIN_PHONE,
      role: 'admin',
      isVerified: true,
      status: 'active',
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
