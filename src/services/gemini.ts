import { GoogleGenAI, Type } from "@google/genai";
import { RegionData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function extractRegionCoordinates(
  imageUrl: string,
  regionNames: string[]
): Promise<RegionData[]> {
  const model = "gemini-3-flash-preview";
  
  const base64Data = imageUrl.split(",")[1];
  const mimeType = imageUrl.split(";")[0].split(":")[1];

  const prompt = `Analyze this image and generate highly accurate polygon coordinates for the following regions: ${regionNames.join(", ")}.
  
  For each region:
  1. Trace the visible border as closely as possible.
  2. Use normalized coordinates on a scale of 0 to 1000.
  3. Output the coordinates as a series of x,y points that form a closed polygon.
  4. Ensure the output is clean and optimized.
  
  Return the data as a JSON array of objects, where each object has "name" and "points" (an array of [x, y] number pairs).`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            points: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "[x, y] pair",
              },
            },
          },
          required: ["name", "points"],
        },
      },
    },
  });

  try {
    const data = JSON.parse(response.text);
    return data as RegionData[];
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Invalid response format from AI");
  }
}
