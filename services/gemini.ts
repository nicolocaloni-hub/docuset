
import { GoogleGenAI, Type } from "@google/genai";

// Always create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key
export async function extractDocumentData(base64Image: string, mimeType: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: "Estrai i dettagli personali da questo documento d'identità o CV italiano. Restituisci un oggetto JSON con: firstName (nome), lastName (cognome), birthDate (data di nascita YYYY-MM-DD), e role (ruolo, se menzionato). Se un campo non viene trovato, lascialo vuoto. Assicurati che la data sia nel formato YYYY-MM-DD.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            firstName: { type: Type.STRING },
            lastName: { type: Type.STRING },
            birthDate: { type: Type.STRING },
            role: { type: Type.STRING },
          },
        },
      },
    });

    // Directly access the .text property (not a method)
    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini API");
    }
    return JSON.parse(text);
  } catch (error) {
    console.error("Errore durante l'estrazione dei dati:", error);
    throw error;
  }
}

export async function askAssistant(prompt: string, contextData: any) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Sei DocuBot, l'assistente AI di DocuSet, una piattaforma di gestione documenti per produzioni cinematografiche. 
      Ecco i dati attuali delle produzioni e documenti: ${JSON.stringify(contextData)}.
      Rispondi in modo professionale e conciso in italiano alle domande dell'utente.
      Domanda: ${prompt}`,
    });
    // Directly access the .text property (not a method)
    return response.text || "Mi dispiace, non ho ricevuto una risposta valida.";
  } catch (error) {
    console.error("Errore Assistente AI:", error);
    return "Mi dispiace, ho avuto un problema tecnico. Riprova più tardi.";
  }
}
