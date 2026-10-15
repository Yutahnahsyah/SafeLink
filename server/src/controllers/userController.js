const User = require('../models/user');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Get a safe account directory for administrator maintenance
// @route   GET /api/users
const getUserList = async (req, res) => {
  try {
    const users = await User.find({})
      .select('_id firstName lastName middleInitial email role status isVerified jurisdiction createdAt')
      .sort({ lastName: 1, firstName: 1 });

    return res.status(200).json(users);
  } catch (err) {
    console.error('Error fetching user list:', err.message);
    return res.status(500).json({ message: 'Server error fetching users.' });
  }
};

// @desc    Get list of authorized personnel for incident assignment
// @route   GET /api/users/personnel
const getPersonnelList = async (req, res) => {
  try {
    const query = {
      role: { $in: ['barangay_personnel', 'lgu_personnel', 'police_personnel'] },
      isVerified: true,
      status: 'active'
    };

    if (req.user.role === 'lgu_personnel') {
      const municipalityOrCity = req.user.jurisdiction?.municipalityOrCity?.trim();
      if (!municipalityOrCity) {
        return res.status(403).json({
          message: 'Access denied: your LGU account has no municipality or city jurisdiction.'
        });
      }
      query['jurisdiction.municipalityOrCity'] = {
        $regex: new RegExp(`^${escapeRegExp(municipalityOrCity)}$`, 'i')
      };
    }

    const personnel = await User.find(query)
      .select('_id firstName lastName role jurisdiction email')
      .sort({ lastName: 1, firstName: 1 });

    res.status(200).json(personnel);
  } catch (err) {
    console.error('Error fetching personnel list:', err.message);
    res.status(500).json({ message: 'Server error fetching personnel list.' });
  }
};

module.exports = { getPersonnelList, getUserList };
