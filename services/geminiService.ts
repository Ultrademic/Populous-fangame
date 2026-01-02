
import { GoogleGenAI, Type } from "@google/genai";
import { GameState } from "../types";

export const getDivineStrategy = async (prompt: string, state: GameState) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `
    You are the "Great Spirit" from the game Populous: The Beginning. 
    You are advising the Shaman of the blue tribe. 
    Use a mystical, commanding, yet helpful tone. 
    Provide strategic advice based on the current game stats:
    - Mana: ${state.mana}
    - Followers: ${state.followers}
    - Enemies Nearby: ${state.enemiesNearby}
    - Buildings: ${state.buildingsCount}
    Keep responses concise but immersive.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });

    return response.text || "The spirits are silent... for now.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The cosmic connection is weak. Try again, Shaman.";
  }
};
