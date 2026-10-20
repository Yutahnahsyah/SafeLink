const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const { PANGASINAN_LOCATIONS } = require('../utils/pangasinanLocations');
const { recordAuditEvent } = require('../utils/auditLog');
const { getBarangay } = require('../utils/registrationLocations');
const personnelRoles = ['barangay_personnel', 'lgu_personnel', 'police_personnel'];

// The legacy LGU routes remain fixed to LGU; generic admin routes set this context.
async function preparePersonnelAccount(req, res, next) {
  req.personnelManagement = true;
  if (req.method === 'POST' && !req.params.id) {
    if (!personnelRoles.includes(req.body?.role)) return res.status(400).json({ message: 'Choose a supported personnel role.', errors: [{ path: 'role', msg: 'Only Barangay, LGU and Police personnel may be provisioned here.' }] });
    req.accountRole = req.body.role;
    return next();
  }
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid account ID.' });
  try {
    const user = await User.findById(req.params.id);
    if (!user || !personnelRoles.includes(user.role)) return res.status(404).json({ message: 'Personnel account not found.' });
    req.managedPersonnel = user;
    req.accountRole = user.role;
    return next();
  } catch { return res.status(500).json({ message: 'Unable to load the personnel account.' }); }
}

const fields = ['firstName', 'lastName', 'middleInitial', 'email', 'phoneNumber', 'municipalityOrCity', 'status'];
const municipality = (value) => PANGASINAN_LOCATIONS.find((item) => item.municipalityOrCity === value)?.municipalityOrCity;
const validateAccount = [
  body('firstName').isString().bail().trim().isLength({ min: 1, max: 80 }).withMessage('Enter a first name of up to 80 characters.'),
  body('lastName').isString().bail().trim().isLength({ min: 1, max: 80 }).withMessage('Enter a last name of up to 80 characters.'),
  body('middleInitial').optional().isString().bail().trim().matches(/^[A-Z]?$/).withMessage('Use one uppercase middle initial.'),
  body('email').optional().isString().bail().trim().isLength({ max: 254 }).isEmail().withMessage('Enter a valid official email address.'),
  body('phoneNumber').isString().bail().matches(/^(09|\+639)\d{9}$/).withMessage('Enter a Philippine mobile number.'),
  body('municipalityOrCity').isString().bail().custom((value) => Boolean(municipality(value))).withMessage('Select a municipality or city in Pangasinan.'),
  body('status').custom((value, { req }) => {
    if (req.personnelManagement && req.method === 'PATCH') {
      if (value !== undefined) throw new Error('Manage suspension and reactivation in Account Management.');
      return true;
    }
    if (!['active', 'suspended'].includes(value)) throw new Error('Select active or suspended.');
    return true;
  }),
  (req, res, next) => {
    const errors = validationResult(req).array().map(({ path, msg }) => ({ path, msg }));
    req.body ||= {};
    const allowed = [...fields, ...(req.personnelManagement ? ['barangay', ...(req.method === 'POST' ? ['role'] : [])] : [])];
    if (Object.keys(req.body).some((key) => !allowed.includes(key))) errors.push({ path: 'role', msg: 'Unsupported account fields. Passwords and elevated roles cannot be supplied.' });
    if (req.accountRole === 'barangay_personnel' && !getBarangay(req.body.municipalityOrCity, req.body.barangay)) errors.push({ path: 'barangay', msg: 'Select a barangay belonging to the assigned municipality.' });
    if (req.accountRole !== 'barangay_personnel' && req.body.barangay) errors.push({ path: 'barangay', msg: 'Only Barangay personnel require a barangay assignment.' });
    if (req.method === 'POST' && !req.body.email) errors.push({ path: 'email', msg: 'Official email is required.' });
    if (req.method === 'PATCH' && 'email' in req.body) errors.push({ path: 'email', msg: 'Email changes require a verified recovery process.' });
    if (errors.length) return res.status(400).json({ message: 'Please correct the highlighted fields.', errors });
    next();
  }
];
const publicUser = (user) => ({
  _id: user._id, firstName: user.firstName, lastName: user.lastName, middleInitial: user.middleInitial,
  email: user.email, phoneNumber: user.phoneNumber, role: user.role, jurisdiction: user.jurisdiction,
  status: user.status, isVerified: user.isVerified, createdAt: user.createdAt, updatedAt: user.updatedAt, lastLoginAt: user.lastLoginAt
});
async function createLguAccount(req, res) {
  res.set('Cache-Control', 'no-store');
  try {
    const email = req.body.email.toLowerCase().trim();
    if (await User.findOne({ email })) return res.status(409).json({ message: 'Account already exists with this email.', errors: [{ path: 'email', msg: 'This email is already registered.' }] });
    // 192 random bits; prefix guarantees compatibility with the existing password policy.
    const password = `Sl!9${crypto.randomBytes(24).toString('base64url')}`;
    const { firstName, lastName, middleInitial, phoneNumber, status, municipalityOrCity } = req.body;
    const role = req.accountRole || 'lgu_personnel';
    const user = new User({ firstName, lastName, middleInitial, phoneNumber, status, email,
      role, isVerified: true, jurisdiction: { municipalityOrCity, barangay: role === 'barangay_personnel' ? getBarangay(municipalityOrCity, req.body.barangay).name : null },
      password: await bcrypt.hash(password, 10) });
    await user.save();
    await recordAuditEvent({ req, targetUser: user._id, action: role === 'lgu_personnel' ? 'LGU_ACCOUNT_CREATED' : 'PERSONNEL_ACCOUNT_CREATED', outcome: 'success', details: { role: user.role, newStatus: user.status, newMunicipality: municipalityOrCity } });
    return res.status(201).json({ message: 'Personnel Account Created Successfully', user: publicUser(user),
      initialCredentials: { username: email, password } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Account already exists with this email.', errors: [{ path: 'email', msg: 'This email is already registered.' }] });
    return res.status(500).json({ message: 'Account creation failed. Check the directory before retrying if the connection was interrupted.' });
  }
}
async function updateLguAccount(req, res) {
  res.set('Cache-Control', 'no-store');
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid account ID.' });
  try {
    const user = req.managedPersonnel || await User.findById(req.params.id);
    if (!user || (!req.personnelManagement && user.role !== 'lgu_personnel')) return res.status(404).json({ message: 'Personnel account not found.' });
    const previousStatus = user.status;
    const previousMunicipality = user.jurisdiction?.municipalityOrCity;
    for (const key of ['firstName', 'lastName', 'middleInitial', 'phoneNumber']) user[key] = req.body[key];
    // Generic personnel edits never carry an account-status snapshot. Accounts
    // owns suspension/reactivation; retain the legacy LGU API contract.
    if (!req.personnelManagement) user.status = req.body.status;
    user.jurisdiction = { municipalityOrCity: req.body.municipalityOrCity, barangay: user.role === 'barangay_personnel' ? getBarangay(req.body.municipalityOrCity, req.body.barangay).name : null };
    await user.save();
    const prefix = user.role === 'lgu_personnel' ? 'LGU' : 'PERSONNEL';
    const action = `${prefix}_ACCOUNT_${previousStatus === user.status ? 'UPDATED' : user.status === 'active' ? 'ENABLED' : 'DISABLED'}`;
    await recordAuditEvent({ req, targetUser: user._id, action, outcome: 'success', details: { previousStatus, newStatus: user.status, previousMunicipality, newMunicipality: user.jurisdiction.municipalityOrCity } });
    return res.json({ message: 'Personnel account updated.', user: publicUser(user) });
  } catch { return res.status(500).json({ message: 'Unable to update the account.' }); }
}
async function requestLguPasswordReset(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid account ID.' });
  try {
    const user = req.managedPersonnel || await User.findById(req.params.id);
    if (!user || (!req.personnelManagement && user.role !== 'lgu_personnel')) return res.status(404).json({ message: 'Personnel account not found.' });
    req.body = { email: user.email };
    await recordAuditEvent({ req, targetUser: user._id, action: user.role === 'lgu_personnel' ? 'LGU_PASSWORD_RESET_REQUESTED' : 'PERSONNEL_PASSWORD_RESET_REQUESTED', outcome: 'success', details: { role: user.role } });
    return require('./authController').forgotPassword(req, res);
  } catch { return res.status(500).json({ message: 'Unable to initiate password reset.' }); }
}
module.exports = { preparePersonnelAccount, validateAccount, createLguAccount, updateLguAccount, requestLguPasswordReset };
