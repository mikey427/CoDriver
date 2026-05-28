export interface CodeEmissionResult {
  success: boolean;
  text: string;
  confidence: number;
  explanation?: string;
  warnings?: string[];
}

export interface DictationPhraseRecord {
  id: string;
  text: string;
  documentUri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  timestamp: string;
  modeId: string;
}
