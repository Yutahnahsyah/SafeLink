const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configure Nodemailer transporter with Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// @desc    Register a standard Citizen account (Requires Email Verification)
// @route   POST /api/auth/register-citizen
const registerCitizen = async (req, res) => {
  try {
    // 1. Destructure 'address' alongside your other fields
    const { firstName, lastName, middleInitial, email, password, phoneNumber, address } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    user = new User({
      firstName,
      lastName,
      middleInitial: middleInitial || '',
      email,
      password: hashedPassword,
      phoneNumber,
      address, // 2. Save the address object here
      role: 'citizen',
      isVerified: false, // Set to false until email is verified
      emailVerificationToken: hashedToken,
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    await user.save();

    // Create verification link URL
    const verifyUrl = `http://localhost:5000/api/auth/verify-email/${verificationToken}`;

    // Compose email message
    const mailOptions = {
      from: `"SafeLink System" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Verify Your SafeLink Citizen Account',
      html: `
        <h3>Welcome to SafeLink, ${firstName}!</h3>
        <p>Please click the link below to verify your email address. This link is valid for 24 hours:</p>
        <a href="${verifyUrl}" target="_blank">${verifyUrl}</a>
        <p>If you didn't create this account, please ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      message: 'Citizen account created successfully. Please check your email to verify your account before logging in.'
    });
  } catch (err) {
    console.error('Citizen registration error:', err.message);
    res.status(500).json({ message: 'Server error during citizen registration.' });
  }
};

// @desc    Verify Citizen Email
// @route   GET /api/auth/verify-email/:token
const verifyEmail = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired email verification token.' });
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully! You can now log in to your account.' });
  } catch (err) {
    console.error('Email verification error:', err.message);
    res.status(500).json({ message: 'Server error during email verification.' });
  }
};

// @desc    Register Personnel (Barangay, LGU, Police, Admin) - Restricted to Admins/LGU
// @route   POST /api/auth/register-personnel
const registerPersonnel = async (req, res) => {
  try {
    const { firstName, lastName, middleInitial, email, password, role, jurisdiction, phoneNumber } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'Account already exists with this email.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      firstName,
      lastName,
      middleInitial: middleInitial || '',
      email,
      password: hashedPassword,
      role,
      jurisdiction,
      phoneNumber,
      isVerified: false // Requires admin approval
    });

    await user.save();

    res.status(201).json({
      message: 'Personnel registration submitted successfully. Awaiting administrator approval.',
      user: { id: user._id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error during personnel registration.' });
  }
};

// @desc    Authenticate and Login User/Personnel
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // 1. Check if the account is verified (covers unverified citizens and pending personnel)
    if (!user.isVerified) {
      if (user.role === 'citizen') {
        return res.status(403).json({
          message: 'Please check your email and verify your account before logging in.'
        });
      } else {
        return res.status(403).json({
          message: 'Your account is pending administrator approval.'
        });
      }
    }

    // 2. Check account status (e.g., if suspended)
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Access denied. Your account has been suspended due to a violation.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        jurisdiction: user.jurisdiction
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Logged in successfully.',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

// @desc    Get all personnel accounts pending verification
// @route   GET /api/auth/pending-personnel
const getPendingPersonnel = async (req, res) => {
  try {
    const pendingUsers = await User.find({
      isVerified: false,
      role: { $ne: 'citizen' }
    }).select('-password');

    res.json(pendingUsers);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error fetching pending accounts.' });
  }
};

// @desc    Approve a personnel account
// @route   PUT /api/auth/approve-personnel/:id
const approvePersonnel = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.isVerified = true;
    user.status = 'active'; // Ensure status changes from pending to active
    await user.save();

    res.json({ message: `Account for ${user.firstName} ${user.lastName} has been approved successfully.` });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error during account approval.' });
  }
};

// @desc    Request password reset link/token
// @route   POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Security measure: Do not reveal if email exists or not
      return res.status(200).json({ message: 'If that email exists, a password reset link has been sent.' });
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash token and save to database with 15-minute expiration
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    // Create frontend/API reset link URL
    const resetUrl = `http://localhost:5000/api/auth/reset-password/${resetToken}`;

    // Compose email message
    const mailOptions = {
      from: `"SafeLink System" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'SafeLink Password Reset Request',
      html: `
        <h3>Password Reset Request</h3>
        <p>You requested a password reset for your SafeLink account.</p>
        <p>Please click the link below to reset your password. This link is valid for 15 minutes:</p>
        <a href="${resetUrl}" target="_blank">${resetUrl}</a>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Password reset instructions sent to your email.' });
  } catch (err) {
    console.error('Email send error:', err.message);
    res.status(500).json({ message: 'Server error sending password reset email.' });
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password/:token
const resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() } // Check if token hasn't expired
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset token.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);

    // Clear reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password has been successfully reset. You can now log in.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error during password reset.' });
  }
};

// @desc    Update user account status with hierarchical permission checks
// @route   PATCH /api/auth/users/:id/status
const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body; // Expects 'active', 'suspended', or 'pending'
    const requester = req.user;   // Extracted from JWT middleware

    // 1. Validate status input
    if (!['active', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value provided.' });
    }

    // 2. Find the target user being modified
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    // 3. Enforce Hierarchy & Jurisdiction Rules
    if (requester.role === 'admin') {
      // Admins have absolute power and can modify any account tier
    }
    else if (requester.role === 'lgu_personnel') {
      // Rule A: LGU personnel can only modify citizens or barangay personnel
      const allowedTargetRoles = ['citizen', 'barangay_personnel'];
      if (!allowedTargetRoles.includes(targetUser.role)) {
        return res.status(403).json({
          message: 'Permission denied: LGU personnel cannot suspend or modify other LGU staff, police, or admins.'
        });
      }

      // Rule B: Enforce geographical jurisdiction matching
      const requesterCity = requester.jurisdiction?.municipalityOrCity;

      // Determine target city depending on their role
      let targetCity = null;
      if (targetUser.role === 'citizen') {
        targetCity = targetUser.address?.municipalityOrCity;
      } else if (targetUser.role === 'barangay_personnel') {
        targetCity = targetUser.jurisdiction?.municipalityOrCity;
      }

      // Strict check: Target MUST have a city, and it MUST match the LGU's city
      if (!targetCity || !requesterCity || requesterCity.trim().toLowerCase() !== targetCity.trim().toLowerCase()) {
        return res.status(403).json({
          message: 'Permission denied: You can only manage accounts within your specific municipality or city.'
        });
      }
    }
    else {
      // Citizens, Barangay staff, and Police cannot change account statuses
      return res.status(403).json({
        message: 'Access forbidden: You do not have administrative privileges.'
      });
    }

    // 4. Apply status update if checks pass
    targetUser.status = status;
    await targetUser.save();

    res.status(200).json({
      message: `User account (${targetUser.email}) has been successfully set to ${status}.`,
      user: {
        id: targetUser._id,
        email: targetUser.email,
        role: targetUser.role,
        status: targetUser.status
      }
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error while updating user status.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own active admin account.' });
    }

    if (user.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Only admins can delete admin accounts.' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: `User account (${user.email}) has been successfully deleted.`,
      userId: user._id
    });
  } catch (err) {
    console.error('User deletion error:', err.message);
    res.status(500).json({ message: 'Server error while deleting user.' });
  }
};

module.exports = {
  registerCitizen,
  verifyEmail,
  registerPersonnel,
  loginUser,
  getPendingPersonnel,
  approvePersonnel,
  forgotPassword,
  resetPassword,
  updateUserStatus,
  deleteUser
};