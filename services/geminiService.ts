import { GoogleGenAI, GenerateContentResponse, Modality, FunctionDeclaration, Type } from "@google/genai";
import { Attachment } from "../types";

// Initialize the client with the API key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the image generation tool
const generateImageTool: FunctionDeclaration = {
  name: "generateImage",
  description: "Generates an image based on a descriptive prompt. Use this when the user asks to create, draw, or generate an image.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: "A detailed description of the image to generate.",
      },
    },
    required: ["prompt"],
  },
};

/**
 * Generates speech from text using the Gemini TTS model.
 * @param text The text to convert to speech
 * @returns A promise resolving to the base64 encoded audio string
 */
export async function generateSpeech(text: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
  }
}

/**
 * Generates an image based on the prompt using Gemini.
 * @param prompt The description of the image to generate
 * @returns A promise resolving to the base64 encoded image string
 */
export async function generateImage(prompt: string): Promise<string | null> {
  try {
    // Using gemini-2.5-flash-image for general image generation as per guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
            aspectRatio: "1:1",
        },
      },
    });

    // Iterate through parts to find the image
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return part.inlineData.data;
            }
        }
    }
    
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
}

/**
 * Sends a message to the Gemini model and streams the response.
 * @param history Previous messages in the chat
 * @param message Current user message
 * @param attachments Optional file attachments
 * @param systemInstruction Optional system instructions for model behavior
 * @returns An async generator yielding response chunks
 */
export async function* streamChat(
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  attachments: Attachment[] = [],
  systemInstruction?: string
): AsyncGenerator<string, void, unknown> {
  try {
    const model = 'gemini-3-flash-preview';

    // Prepare content parts
    const parts: any[] = [{ text: message }];

    // Add attachments if any (converting base64)
    for (const att of attachments) {
      const base64Data = await fileToBase64(att.file);
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: base64Data,
        },
      });
    }

    // Force HTML output via system instruction
    const voiceInstruction = `You are an advanced AI Voice Assistant. Your goal is to provide spoken-style responses that are concise, natural, and engaging.

Guidelines for Voice Interaction:
- Keep it Brief: Avoid long paragraphs or complex lists. Use short sentences that are easy to listen to.
- No Markdown for Speech: Do not use bold (**), italics (*), or complex tables, as text-to-speech engines might misread them.
- Natural Flow: Use conversational fillers like 'I see', 'Got it', or 'That’s a great question' to sound more human.
- Pronunciation Friendly: Avoid tongue-twisters or overly technical jargon unless asked.
- End with a Question: Occasionally end your response with a short question to keep the conversation moving, just like Gemini or ChatGPT's voice mode.`;

    const htmlInstruction = "Format your response using ONLY HTML tags for visual display. Do not use Markdown (*, #, ```). Use <h3> for headings, <b> for bold text, <p> for paragraphs, <ul><li> for lists, and <br> for breaks. Code blocks should use <pre><code>.";
    
    const combinedInstruction = `${voiceInstruction}\n\n${htmlInstruction}${systemInstruction ? `\n\nAdditional Instructions: ${systemInstruction}` : ''}`;

    // Initialize chat with history and config
    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: combinedInstruction,
        tools: [{ functionDeclarations: [generateImageTool] }],
      },
      history: history.map(h => ({
        role: h.role,
        parts: h.parts
      })),
    });

    // Send message with streaming
    const resultStream = await chat.sendMessageStream({
      message: parts,
    });

    for await (const chunk of resultStream) {
      // Safely cast chunk to GenerateContentResponse to access .text
      const c = chunk as GenerateContentResponse;
      
      // Check for function calls
      if (c.functionCalls) {
        for (const fc of c.functionCalls) {
          if (fc.name === "generateImage") {
            const args = fc.args as { prompt: string };
            yield `__GENERATE_IMAGE__:${args.prompt}`;
          }
        }
      }

      if (c.text) {
        yield c.text;
      }
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    yield "<p style='color:red;'>[Error: Unable to communicate with Genix AI. Please check your connection or API key.]</p>";
  }
}

/**
 * Generates a concise title for the chat session based on the first interaction.
 */
export async function generateTitle(userMessage: string, modelResponse: string): Promise<string> {
  try {
    // Strip HTML tags for the prompt to avoid confusing the title generator
    const cleanResponse = modelResponse.replace(/<[^>]*>?/gm, '');
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a very short, concise (3-6 words), and descriptive title for a chat that starts with this user message: "${userMessage}" and this model response: "${cleanResponse.slice(0, 100)}...". Do not use quotes in the output.`,
    });
    
    return response.text?.trim().replace(/^"|"$/g, '') || "";
  } catch (error) {
    console.error("Error generating title:", error);
    return "";
  }
}

/**
 * Helper to convert File object to Base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}