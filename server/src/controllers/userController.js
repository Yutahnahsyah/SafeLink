const User = require('../models/user');

// @desc    Get list of authorized personnel for incident assignment
// @route   GET /api/users/personnel
const getPersonnelList = async (req, res) => {
  try {
    // Find users with personnel roles who are verified and active
    const personnel = await User.find({
      role: { $in: ['barangay_personnel', 'lgu_personnel', 'police_personnel'] },
      isVerified: true,
      status: 'active'
    }).select('_id firstName lastName role jurisdiction email');

    res.status(200).json(personnel);
  } catch (err) {
    console.error('Error fetching personnel list:', err.message);
    res.status(500).json({ message: 'Server error fetching personnel list.' });
  }
};

module.exports = { getPersonnelList };