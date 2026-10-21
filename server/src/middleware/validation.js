const { body, param, validationResult } = require('express-validator');
const { getPangasinanZipCode } = require('../utils/pangasinanLocations');
const { getBarangay, validStreet } = require('../utils/registrationLocations');
const policies = require('../../../shared/legalPolicies.json');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateCitizenRegistration = [
  body('legalAcceptance.accepted').custom((value) => value === true)
    .withMessage('You must agree to the Terms and Conditions and acknowledge the Privacy Policy.'),
  body('legalAcceptance.termsVersion').custom((value) => value === policies.termsVersion)
    .withMessage('Please review and accept the current Terms and Conditions.'),
  body('legalAcceptance.privacyVersion').custom((value) => value === policies.privacyVersion)
    .withMessage('Please review and acknowledge the current Privacy Policy.'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required.')
    .matches(/^[A-Z]/)
    .withMessage('First name must start with an uppercase letter.'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required.')
    .matches(/^[A-Z]/)
    .withMessage('Last name must start with an uppercase letter.'),
  body('middleInitial')
    .optional()
    .isLength({ max: 1 })
    .withMessage('Middle initial must be a single character.')
    .matches(/^[A-Z]?$/)
    .withMessage('Middle initial must be uppercase.'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .custom((value) => value.endsWith('@gmail.com'))
    .withMessage('Only @gmail.com email addresses are allowed.'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number.')
    .matches(/[\W_]/)
    .withMessage('Password must contain at least one special character.'),
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required.')
    .matches(/^(09|\+639)\d{9}$/)
    .withMessage('Please provide a valid Philippine mobile number (e.g., 09123456789 or +639123456789).'),
  body('address')
    .notEmpty()
    .withMessage('Address object is required.'),
  body('address.barangay')
    .isString().withMessage('Select a barangay.').bail().trim()
    .custom((value, { req }) => Boolean(getBarangay(req.body.address?.municipalityOrCity, value)))
    .withMessage('Select a barangay belonging to your city or municipality.'),
  body('address.municipalityOrCity')
    .notEmpty()
    .withMessage('Municipality or city address is required.')
    .bail()
    .custom((value) => Boolean(getPangasinanZipCode(value)))
    .withMessage('Select a municipality or city in Pangasinan.'),
  body('address.street')
    .isString().withMessage('Street Address is required.').bail()
    .custom(validStreet).withMessage('Enter a Street Address of 2–255 characters without control characters or angle brackets.')
    .bail().trim(),
  body('address.landmark')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Landmark must not exceed 255 characters.'),
  validate
];

const validatePersonnelRegistration = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required.')
    .matches(/^[A-Z]/)
    .withMessage('First name must start with an uppercase letter.'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required.')
    .matches(/^[A-Z]/)
    .withMessage('Last name must start with an uppercase letter.'),
  body('middleInitial')
    .optional()
    .isLength({ max: 1 })
    .withMessage('Middle initial must be a single character.')
    .matches(/^[A-Z]?$/)
    .withMessage('Middle initial must be uppercase.'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .custom((value) => value.endsWith('@gmail.com'))
    .withMessage('Only @gmail.com email addresses are allowed.'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number.')
    .matches(/[\W_]/)
    .withMessage('Password must contain at least one special character.'),
  body('role')
    .isIn(['barangay_personnel', 'lgu_personnel', 'police_personnel'])
    .withMessage('Invalid personnel role specified.'),
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required.')
    .matches(/^(09|\+639)\d{9}$/)
    .withMessage('Please provide a valid Philippine mobile number.'),
  body('jurisdiction')
    .notEmpty()
    .withMessage('Jurisdiction object is required.'),
  body('jurisdiction.barangay')
    .if(body('role').equals('barangay_personnel'))
    .notEmpty()
    .withMessage('Barangay jurisdiction is required for barangay personnel.'),
  body('jurisdiction.municipalityOrCity')
    .notEmpty()
    .withMessage('Municipality or city jurisdiction is required.'),
  validate
];

const validateLogin = [
  body('email')
    .isString().bail().trim().toLowerCase()
    .isEmail()
    .withMessage('Please provide a valid email address.'),
  body('password').isString().bail().notEmpty().withMessage('Password is required.'),
  validate
];

const validateMfaCode = [
  body('mfaToken').isString().isLength({ min: 20, max: 2048 }).withMessage('MFA session is invalid.'),
  body('code').isString().trim().matches(/^\d{6}$/).withMessage('Enter the six-digit authenticator code.'),
  validate
];

const validateMfaSetup = [
  body('mfaToken').isString().isLength({ min: 20, max: 2048 }).withMessage('MFA session is invalid.'),
  validate
];

const validateMfaSettingsCode = [
  body('code').isString().trim().matches(/^\d{6}$/).withMessage('Enter the six-digit code from your authenticator app.'),
  validate
];

const validateMfaRecovery = [
  body('mfaToken').isString().isLength({ min: 20, max: 2048 }).withMessage('MFA session is invalid.'),
  body('recoveryCode').isString().trim().matches(/^[A-Za-z0-9-]{10,40}$/).withMessage('Enter a valid recovery code.'),
  validate
];

const validateIncidentCreation = [
  body('incidentType')
    .notEmpty().withMessage('Incident type is required.')
    .isIn([
      'Suspicious activities',
      'Missing or vulnerable persons',
      'Harassment or unsafe encounters',
      'Dangerous road incidents',
      'People requiring assistance',
      'Public fire or smoke incidents',
      'People needing assistance during flooding'
    ])
    .withMessage('Invalid incident type selected.'),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required.')
    .isLength({ min: 10, max: 5000 }).withMessage('Description must be between 10 and 5000 characters long.'),
  body('citizenUrgency')
    .notEmpty().withMessage('Suggested urgency is required.')
    .isIn(['Low', 'Medium', 'High'])
    .withMessage('Suggested urgency must be Low, Medium, or High.'),
  body('location.address')
    .notEmpty().withMessage('Location address is required.'),
  body('location.address.barangay')
    .trim()
    .notEmpty().withMessage('Barangay is required.'),
  body('location.address.municipalityOrCity')
    .trim()
    .notEmpty().withMessage('Municipality or city is required.')
    .bail()
    .custom((value) => Boolean(getPangasinanZipCode(value)))
    .withMessage('Select a municipality or city in Pangasinan.'),
  body('location.address.street')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 255 }).withMessage('Street must not exceed 255 characters.'),
  body('location.address.zipCode')
    .optional()
    .isString().withMessage('ZIP code must be a string.')
    .bail()
    .trim()
    .custom((value) => value === '' || /^\d{4}$/.test(value)).withMessage('ZIP code must contain four digits.'),
  body('location.address.landmark')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 255 }).withMessage('Landmark must not exceed 255 characters.'),
  body('location.latitude')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90.'),
  body('location.longitude')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180.'),
  body('location').custom(async (location) => {
    const { validateIncidentCoordinates } = await import('../../../shared/incidentProvince.mjs');
    const error = validateIncidentCoordinates(location || {});
    if (error) throw new Error(error);
    const { validateMunicipalityCoordinates } = await import('../../../shared/incidentMunicipality.mjs');
    const municipalityError = validateMunicipalityCoordinates({ ...location, municipalityOrCity: location?.address?.municipalityOrCity });
    if (municipalityError) throw new Error(municipalityError);
    return true;
  }),
  body('mediaEvidence')
    .optional()
    .isArray({ max: 5 }).withMessage('Media evidence must contain no more than 5 URLs.'),
  body('mediaEvidence.*')
    .optional()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Each media evidence item must be an HTTP(S) URL.'),
  validate
];

const validateIncidentProcessing = [
  param('id')
    .isMongoId().withMessage('Invalid incident ID format.'),
  body('status')
    .optional()
    .isIn(['Submitted', 'Under Barangay Review', 'Verified', 'Rejected', 'In Progress', 'Resolved', 'Closed'])
    .withMessage('Invalid status value.'),
  body('severity')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Critical'])
    .withMessage('Invalid severity level.'),
  body('assignedAgency')
    .optional()
    .isIn(['Barangay', 'LGU', 'Police', 'Unassigned'])
    .withMessage('Invalid assigned agency.'),
  body('escalationAgency')
    .optional()
    .isIn(['LGU', 'Police'])
    .withMessage('Escalation agency must be LGU or Police.'),
  body('handlingDecision')
    .optional()
    .isIn(['Barangay'])
    .withMessage('Handling decision must be Barangay.'),
  body('assignedPersonnel')
    .optional()
    .isMongoId()
    .withMessage('Invalid assigned personnel user ID format.'),
  body('remarks')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Remarks must be between 1 and 2000 characters long.'),
  body('closureConfirmed')
    .optional()
    .isBoolean()
    .withMessage('closureConfirmed must be true or false.')
    .toBoolean(),
  validate
];

const validateForgotPassword = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address.'),
  validate
];

const validateResetPassword = [
  param('token')
    .notEmpty().withMessage('Reset token is required.'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.')
    .matches(/[\W_]/).withMessage('Password must contain at least one special character.'),
  validate
];

module.exports = {
  validateCitizenRegistration,
  validatePersonnelRegistration,
  validateLogin,
  validateMfaCode,
  validateMfaSetup,
  validateMfaSettingsCode,
  validateMfaRecovery,
  validateIncidentCreation,
  validateIncidentProcessing,
  validateForgotPassword,
  validateResetPassword
};
