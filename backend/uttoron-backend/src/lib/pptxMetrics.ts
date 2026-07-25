import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SCRIPT_PATH = path.join(__dirname, '../../scripts/extract_pptx_metrics.py');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

export interface PptxMetricsResult {
  parse_status: 'success' | 'failed';
  avg_words_per_slide?: number;
  avg_bullets_per_slide?: number;
  image_to_text_ratio?: number;
  distinct_font_count?: number;
  slide_count?: number;
  error?: string;
}

// Writes the buffer to a temp file (python-pptx needs a real file path),
// shells out to the extraction script, and always resolves — a Python
// crash or malformed deck comes back as parse_status:'failed', never a
// thrown error, so callers never need a try/catch around this.
export function extractPptxMetrics(buffer: Buffer): Promise<PptxMetricsResult> {
  return new Promise((resolve) => {
    const tmpFile = path.join(os.tmpdir(), `pptx-metrics-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pptx`);
    fs.writeFile(tmpFile, buffer, (writeErr) => {
      if (writeErr) { resolve({ parse_status: 'failed', error: writeErr.message }); return; }

      const proc = spawn(PYTHON_BIN, [SCRIPT_PATH, tmpFile]);
      let stdout = '';
      proc.stdout.on('data', (d) => { stdout += d; });
      proc.on('close', () => {
        fs.unlink(tmpFile, () => {}); // best-effort cleanup, don't block on it
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          resolve({ parse_status: 'failed', error: 'extraction script produced no valid output' });
        }
      });
      proc.on('error', (err) => {
        fs.unlink(tmpFile, () => {});
        resolve({ parse_status: 'failed', error: 'could not run python3 (' + err.message + ')' });
      });
    });
  });
}
