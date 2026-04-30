import { GoogleGenerativeAI } from '@google/generative-ai'

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY

export const genAI = new GoogleGenerativeAI(geminiApiKey)

export const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0,
  },
})
