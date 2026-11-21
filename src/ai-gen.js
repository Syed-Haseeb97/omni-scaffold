/**
 * src/ai-gen.js — Phase 2: AI Code Generation (--prompt)
 * Calls Gemini API to generate App.jsx, components, and Tailwind styling,
 * validates via `npm run build`, and returns generated files.
 */

import { execa } from 'execa';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Generate starter application code using Gemini API.
 * @param {object} params
 * @param {string} params.prompt
 * @param {string} params.framework
 * @param {object} params.stack
 * @param {string} params.outDir
 * @param {boolean} [params.verbose]
 * @returns {Promise<{ files: string[], buildOk: boolean }>}
 */
export async function generateApp({ prompt, framework = 'vite-react', stack = {}, outDir, verbose = false }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[ai-gen] No GEMINI_API_KEY found. Skipping AI app generation.');
    return { files: [], buildOk: false };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const systemInstruction = `You are an expert full-stack developer. The user wants a starter app scaffolded with the following details:
Framework: ${framework}
Stack: ${JSON.stringify(stack)}
User Request: ${prompt}

Output a single JSON object with a "files" array containing files to create or overwrite relative to project root.
Format:
{
  "files": [
    {
      "path": "src/App.jsx",
      "content": "..."
    }
  ]
}
Make sure the React code is valid JSX/ESM, uses Tailwind CSS classes, and compiles cleanly with standard Vite. Only output JSON, no markdown code fence.`;

  let attempts = 0;
  let lastBuildError = '';

  while (attempts < 3) {
    attempts++;
    if (verbose) console.log(`[ai-gen] Generation attempt ${attempts}...`);

    let userPrompt = prompt;
    if (lastBuildError) {
      userPrompt += `\n\nPrevious code failed with build error:\n${lastBuildError}\nPlease fix all syntax/import errors.`;
    }

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\nUser Prompt: ${userPrompt}` }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[ai-gen] Gemini API returned ${res.status}: ${errText}`);
      break;
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) break;

    try {
      const parsed = JSON.parse(candidateText);
      const generatedFiles = [];

      for (const file of parsed.files || []) {
        const fullPath = join(outDir, file.path);
        const dir = join(fullPath, '..');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(fullPath, file.content, 'utf8');
        generatedFiles.push(file.path);
        if (verbose) console.log(`[ai-gen] Wrote ${file.path}`);
      }

      // Verify build
      try {
        await execa('npm', ['run', 'build'], { cwd: outDir });
        if (verbose) console.log('[ai-gen] Build succeeded! ✓');
        return { files: generatedFiles, buildOk: true };
      } catch (buildErr) {
        lastBuildError = buildErr.stderr || buildErr.stdout || buildErr.message;
        if (verbose) console.warn(`[ai-gen] Build failed: ${lastBuildError}`);
      }
    } catch (parseErr) {
      if (verbose) console.warn(`[ai-gen] JSON parse error: ${parseErr.message}`);
    }
  }

  return { files: [], buildOk: false };
}
