import { brandColors } from "./branding";

export const incidents = [
  {
    id: 1,
    category: "Flooding",
    location: "Bonuan Binloc, Dagupan City, Pangasinan",
    status: "For Verification",
    time: "8 min ago",
    color: "#f59e0b",
    priority: "High",
    daysAgo: 1,
    coords: [120.3486, 16.0795],
  },
  {
    id: 2,
    category: "Road Hazard",
    location: "Poblacion, San Carlos City, Pangasinan",
    status: "Assigned",
    time: "21 min ago",
    color: brandColors.tealDark,
    priority: "Normal",
    daysAgo: 3,
    coords: [120.34, 16.0432],
  },
  {
    id: 3,
    category: "Fire",
    location: "Poblacion, Alaminos City, Pangasinan",
    status: "Responding",
    time: "34 min ago",
    color: "#ef5b5b",
    priority: "High",
    daysAgo: 5,
    coords: [120.3555, 16.0358],
  },
  {
    id: 4,
    category: "Street Light Issue",
    location: "Poblacion, Urdaneta City, Pangasinan",
    status: "Resolved",
    time: "48 min ago",
    color: "#2cc88a",
    priority: "Normal",
    daysAgo: 8,
    coords: [120.3335, 16.035],
  },
  {
    id: 5,
    category: "Suspicious Activity",
    location: "Poblacion, Lingayen, Pangasinan",
    status: "Verified",
    time: "52 min ago",
    color: brandColors.tealDark,
    priority: "Normal",
    daysAgo: 12,
    coords: [120.329, 16.0503],
  },
];

export const features = [
  [
    "report",
    "Incident Reporting",
    "Submit clear, structured reports in minutes.",
  ],
  ["pin", "GPS Location", "Pin the exact area that needs attention."],
  [
    "camera",
    "Photo & Video Evidence",
    "Attach context to support verification.",
  ],
  [
    "layers",
    "Duplicate Detection",
    "Group similar reports for a clearer response.",
  ],
  [
    "shield",
    "Authorized Verification",
    "Keep information credible and accountable.",
  ],
  [
    "priority",
    "Priority Classification",
    "Route urgent cases to the right teams faster.",
  ],
  [
    "track",
    "Incident Tracking",
    "Follow every update from report to resolution.",
  ],
  ["bell", "Status Notifications", "Stay informed when report status changes."],
  ["map", "Community Safety Map", "See verified concerns around your area."],
  [
    "chart",
    "Safety Analytics",
    "Understand patterns with actionable insights.",
  ],
  ["history", "Response History", "Maintain a transparent activity record."],
  [
    "users",
    "Role-Based Access",
    "Protect workflows with responsible permissions.",
  ],
];

export const roles = [
  ["Citizen", "Citizens", "Submit and track community safety reports."],
  [
    "Barangay",
    "Barangay Personnel",
    "Review, verify, and manage local reports.",
  ],
  [
    "LGU",
    "LGU Safety & Disaster Offices",
    "Prioritize, assign, and coordinate incidents.",
  ],
  [
    "Police",
    "Police Partner Agencies",
    "Respond to referred incidents when necessary.",
  ],
  [
    "Admin",
    "System Administrators",
    "Manage users, security, and platform activity.",
  ],
];
