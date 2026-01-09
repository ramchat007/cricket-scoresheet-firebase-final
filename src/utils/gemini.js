import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export const fetchAICommentary = async (ballContext) => {
  if (!genAI) return null;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `
      Write a 1-sentence cricket commentary.
      ${ballContext.bowler} to ${ballContext.batter}.
      Outcome: ${ballContext.runs} runs. ${ballContext.isWicket ? "WICKET!" : ""} ${ballContext.extras ? `(${ballContext.extras})` : ""}
      Context: ${ballContext.matchSituation}.
      Make it exciting.
    `;
    const result = await model.generateContent(prompt);
    return (await result.response).text();
  } catch (error) {
    console.error("Gemini Error", error);
    return null;
  }
};

// ✅ UPDATED MATCH ANALYSIS
export const fetchMatchAnalysis = async (matchData, inningData) => {
  if (!genAI) return null;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // 1. Determine Context (1st vs 2nd Innings)
    const currentInningIndex = matchData.currentInnings || 0;
    let contextPrompt = "";

    if (currentInningIndex === 0) {
        // 1st Innings: Focus on Setting a Total
        contextPrompt = `
            It is the 1st Innings.
            Batting Team: ${inningData.battingTeam}
            Score: ${inningData.score}/${inningData.wickets}
            Overs: ${inningData.over}.${inningData.overBallCount}
            Analyze the projected score and current momentum.
        `;
    } else {
        // 2nd Innings: Focus on the Chase
        const inn1Score = matchData.innings[0]?.score || 0;
        const target = inn1Score + 1;
        const runsNeeded = target - inningData.score;
        // Estimate balls remaining (assuming T20/10 over logic if not explicit, but passed via text if possible)
        // ideally matchData.meta.overs exists
        const totalOvers = parseInt(matchData.meta?.overs || 20); 
        const ballsBowled = (inningData.over * 6) + inningData.overBallCount;
        const ballsRemaining = (totalOvers * 6) - ballsBowled;

        contextPrompt = `
            It is the 2nd Innings (The Chase).
            Target: ${target}
            Current Score: ${inningData.score}/${inningData.wickets}
            Equation: Need ${runsNeeded} runs in ${ballsRemaining} balls.
            Analyze the Required Run Rate and pressure situation. 
            Who is favored to win?
        `;
    }

    const prompt = `
      You are an expert cricket coach.
      ${contextPrompt}
      
      Give 2 short, punchy lines of strategic insight. 
      Do NOT state the obvious stats, give *insight*.
    `;

    const result = await model.generateContent(prompt);
    return (await result.response).text();
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};