import { GoogleGenAI, Type } from "@google/genai";
import { CustomerData } from "../types";

export const parseCustomerDataWithGemini = async (text: string): Promise<Partial<CustomerData>> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Extract the following information from the text to fill a payment slip:
    - Customer Name (fullName)
    - Customer ID (customerId)
    - Contract ID (contractId)
    - Transfer Content (transferContent) - The specific string to use for bank transfer memo. If not explicitly stated, use the Contract ID.
    - Address (address)
    - Total Amount (amount) - convert to number
    - Deadline Date (deadline) - format YYYY-MM-DD. If year is not specified, assume next occurrence.

    Text to process:
    "${text}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullName: { type: Type.STRING },
            customerId: { type: Type.STRING },
            contractId: { type: Type.STRING },
            transferContent: { type: Type.STRING },
            address: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            deadline: { type: Type.STRING, description: "YYYY-MM-DD format" },
          },
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return result as Partial<CustomerData>;
  } catch (error) {
    console.error("Gemini parsing error:", error);
    throw error;
  }
};