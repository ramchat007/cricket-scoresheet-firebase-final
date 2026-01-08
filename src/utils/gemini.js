// src/utils/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Get Key
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// 2. Debug Log (Check console to see if this prints)
if (!apiKey) {
  console.error("❌ MISSING GEMINI API KEY. Check your .env file.");
} else {
  console.log("✅ Gemini API Key found:", apiKey.substring(0, 4) + "...");
}

const genAI = new GoogleGenerativeAI(apiKey);

// 3. FIX: Use 'gemini-pro' (Stable) instead of 'gemini-1.5-flash' (Beta/New)
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

/**
 * Generates a short, exciting cricket commentary line.
 */
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
    eventDescription = `FOUR runs scored by ${batter} off ${bowler}.`;
  else if (runs === 6)
    eventDescription = `SIX runs scored by ${batter} off ${bowler}.`;
  else if (runs === 0) eventDescription = `Dot ball. ${bowler} to ${batter}.`;
  else eventDescription = `${runs} run(s) scored by ${batter} off ${bowler}.`;

  const prompt = `
    Act as an exciting cricket commentator (like Danny Morrison or Ravi Shastri).
    Describe this specific ball event in 1 short sentence (max 15 words).
    Be energetic for boundaries/wickets, and analytical for dots/singles.
    Event: ${eventDescription}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return null;
  }
};

/**
 * Generates Match Analysis / Coach Advice
 */
export const fetchMatchAnalysis = async (match, currentInnings) => {
  if (!apiKey) return null;

  const { score, wickets, over, overBallCount, battingTeam } = currentInnings;
  const target = match.meta?.target;

  const prompt = `
    Analyze this cricket match situation in 2 bullet points.
    Batting Team: ${battingTeam}. Score: ${score}/${wickets}. Overs: ${over}.${overBallCount}.
    ${target ? `Chasing Target: ${target}.` : "Batting First."}
    
    1. What is the current position? (Good/Bad)
    2. What should the batting team do next? (Aggressive/Defensive)
    Keep it very short and direct.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};
