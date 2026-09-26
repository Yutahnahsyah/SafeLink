import { brandColors } from "../branding";

// Illustration only: regional anchor coordinates, not real office locations,
// partnerships, verified connections, or backend incident records.
export const globeLocations = [
  {
    id: "pangasinan",
    name: "Pangasinan Community Network",
    description: "Community reporting area",
    lat: 16.0433,
    lng: 120.3408,
    type: "community",
    color: brandColors.teal,
  },
  {
    id: "barangay",
    name: "Barangay Office",
    description: "Local report verification",
    lat: 18.2,
    lng: 120.6,
    type: "verification",
    color: "#44c69b",
  },
  {
    id: "lgu",
    name: "LGU Safety Office",
    description: "Incident coordination",
    lat: 14.6,
    lng: 121,
    type: "coordination",
    color: brandColors.cyan,
  },
  {
    id: "police",
    name: "Police Partner Agency",
    description: "Referral and response",
    lat: 12.2,
    lng: 123.7,
    type: "response",
    color: brandColors.teal,
  },
  {
    id: "disaster",
    name: "Disaster Response Office",
    description: "Emergency coordination",
    lat: 10.7,
    lng: 125,
    type: "response",
    color: "#44c69b",
  },
];

export const globeConnections = [
  { from: "pangasinan", to: "barangay", color: brandColors.teal, height: 0.2 },
  { from: "barangay", to: "lgu", color: brandColors.cyan, height: 0.32 },
  { from: "lgu", to: "police", color: brandColors.teal, height: 0.22 },
  { from: "police", to: "disaster", color: "#44c69b", height: 0.18 },
  { from: "pangasinan", to: "disaster", color: brandColors.cyan, height: 0.48 },
];

export const dagupanView = { lat: 16.0433, lng: 120.3408 };
