// src/utils/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ MISSING GEMINI API KEY.");
}

const genAI = new GoogleGenerativeAI(apiKey);

// --- 🛠️ DEBUGGER: List Available Models ---
// This runs once when the app loads to tell us what models your key can access.
(async () => {
  if (!apiKey) return;
  try {
    // We cannot list models directly via the SDK in browser easily without advanced config,
    // so we try a direct fetch to test the key permissions.
    console.log("🔍 Checking Gemini API Access...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    await model.generateContent("Test");
    console.log("✅ Gemini 1.5 Flash is WORKING!");
  } catch (error) {
    console.error("❌ Gemini Access Failed:", error.message);
    console.warn(
      "👉 ACTION REQUIRED: Go to Google Cloud Console > Search 'Generative Language API' > Click ENABLE."
    );
  }
})();

// Defaulting to the most standard model string
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const fetchAICommentary = async (ballData) => {
  if (!apiKey) return null;

  const { batter, bowler, runs, isWicket, isWide, isNoBall, wicketType } =
    ballData;

  let eventDescription = "";
  if (isWicket)
    eventDescription = `WICKET! ${batter} is out (${wicketType}). Bowler: ${bowler}.`;
  else if (isWide) eventDescription = `Wide ball by ${bowler}.`;
  else if (isNoBall) eventDescription = `No Ball by ${bowler}.`;
  else if (runs === 4)
    eventDescription = `FOUR runs by ${batter} off ${bowler}.`;
  else if (runs === 6)
    eventDescription = `SIX runs by ${batter} off ${bowler}.`;
  else if (runs === 0) eventDescription = `Dot ball. ${bowler} to ${batter}.`;
  else eventDescription = `${runs} run(s) by ${batter} off ${bowler}.`;

  const prompt = `
    Act as a cricket commentator. 
    Describe: ${eventDescription}
    Max 15 words. High energy.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    // Suppress alert, just log
    return null;
  }
};

export const fetchMatchAnalysis = async (match, currentInnings) => {
  if (!apiKey) return null;

  const { score, wickets, over, overBallCount, battingTeam } = currentInnings;
  const target = match.meta?.target;

  const prompt = `
    Analyze cricket match.
    Batting: ${battingTeam}. Score: ${score}/${wickets}. Overs: ${over}.${overBallCount}.
    ${target ? `Target: ${target}.` : "Batting First."}
    
    1. Status?
    2. Advice?
    Short bullet points.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    return null;
  }
};
