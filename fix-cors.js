// fix-cors.js
import { Storage } from "@google-cloud/storage";

// 1. Setup - Replace with your details
const keyFilename = "./service-account.json"; // The file you just downloaded
const projectId = "cricket-scoresheet"; // Found in Project Settings > General
const bucketName = "cricket-scoresheet.appspot.com"; // Found in Storage tab (without gs://)

const storage = new Storage({ keyFilename, projectId });

async function setCors() {
  try {
    await storage.bucket(bucketName).setCorsConfiguration([
      {
        maxAgeSeconds: 3600,
        method: ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
        origin: ["*"], // Allows all domains (including localhost)
        responseHeader: ["Content-Type", "x-goog-resumable"],
      },
    ]);

    console.log(`✅ CORS configuration successfully set for ${bucketName}`);
  } catch (error) {
    console.error("❌ Error setting CORS:", error);
  }
}

setCors();
