import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined in environment.');
    }
    aiInstance = new GoogleGenAI();
  }
  return aiInstance;
}

export interface GaugeReadingResult {
  reading_mmwc: number | null;
  confidence: number;
  note: string;
}

export interface CylinderScanResult {
  serial: string;
  gas: 'O₂' | 'N₂O' | 'CO₂' | string;
  hydrotest: string;
  confidence: number;
  rawText: string;
  note?: string;
}

export async function analyzeGaugePhoto(base64Image: string): Promise<GaugeReadingResult> {
  const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  const mimeType = base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  try {
    const ai = getGenAI();
    const prompt = `Analyze this medical gas liquid oxygen (LOX) VIE storage tank level gauge photo.
Read ONLY the liquid level gauge calibrated in mmWC (millimetres of water column, scale 0 to 1600 or 0 to 2000 mmWC).
DO NOT read the tank pressure gauge (which is measured in bar, psi, or kg/cm2).
Read the exact pointer position.
Return strictly valid JSON:
{
  "reading_mmwc": <number rounded to integer, or null if gauge unreadable>,
  "confidence": <float from 0.0 to 1.0>,
  "note": "<brief English description of dial reading and pointer position>"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    return {
      reading_mmwc: typeof parsed.reading_mmwc === 'number' ? parsed.reading_mmwc : null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      note: parsed.note || 'Gauge analyzed successfully'
    };
  } catch (error) {
    console.error('Error analyzing gauge with Gemini:', error);
    return {
      reading_mmwc: null,
      confidence: 0,
      note: error instanceof Error ? error.message : 'Failed to analyze gauge photo'
    };
  }
}

export async function analyzeCylinderPhoto(base64Image: string): Promise<CylinderScanResult> {
  const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  const mimeType = base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  try {
    const ai = getGenAI();
    const prompt = `Analyze this photo of a medical gas cylinder in an Indian hospital.
1. Extract the unique cylinder serial number stamped on the shoulder or collar or laser-etched on neck tag.
   - CRITICAL: IGNORE Test Pressure (TP), Working Pressure (WP), Water Capacity (WC), Tare Weight (TW), and standard codes (IS 7285, DOT-3AA).
   - Find the primary serial number (e.g. "OX1042", "MED9081", "B20491", "48201", "D119").
   - Normalize the serial: remove punctuation and whitespace, keep uppercase letters and digits only.
2. Identify the gas type from the cylinder colour scheme (IS 3933 / medical standard):
   - Black body with white shoulder = "O₂" (Medical Oxygen)
   - French blue body/shoulder = "N₂O" (Nitrous Oxide)
   - Grey body/shoulder = "CO₂" (Carbon Dioxide)
   - Default to "O₂" if predominantly black or if oxygen labels are present.
3. Identify the latest hydraulic test (hydrotest) date stamp if visible (format YYYY-MM, or MM/YY convert to YYYY-MM).
Return strictly valid JSON:
{
  "serial": "<normalized uppercase serial>",
  "gas": "<O₂ or N₂O or CO₂>",
  "hydrotest": "<YYYY-MM or empty string>",
  "confidence": <float 0.0 to 1.0>,
  "rawText": "<all text visible on cylinder shoulder>",
  "note": "<brief observation>"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    const normalizedSerial = (parsed.serial || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return {
      serial: normalizedSerial,
      gas: parsed.gas || 'O₂',
      hydrotest: parsed.hydrotest || '',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      rawText: parsed.rawText || '',
      note: parsed.note || ''
    };
  } catch (error) {
    console.error('Error analyzing cylinder with Gemini:', error);
    return {
      serial: '',
      gas: 'O₂',
      hydrotest: '',
      confidence: 0,
      rawText: '',
      note: error instanceof Error ? error.message : 'Failed to analyze cylinder photo'
    };
  }
}
