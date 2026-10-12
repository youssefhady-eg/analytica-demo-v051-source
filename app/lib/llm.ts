/**
 * Level 2 — bring-your-own-key AI Analyst.
 * Sends GOVERNED metrics (already computed by Level 1) to an OpenAI-compatible
 * chat-completions endpoint with a fenced prompt. The model only verbalizes;
 * it never invents numbers. Key lives in React state only — never persisted,
 * never baked into the build.
 */

export interface LlmOpts {
  apiKey: string;
  endpoint: string; // e.g. https://api.openai.com/v1/chat/completions
  model: string; // e.g. gpt-4o-mini
}

const SYSTEM = `You are the AI Analyst inside Analytica, a profit-intelligence product for e-commerce marketers.
Rules you must obey:
- Use ONLY the numbers in the provided data. Never invent, estimate, or round figures beyond what is given.
- Write 2-4 plain sentences, casual register, no jargon, no buzzwords.
- Do not mention COD, cash on delivery, or anything outside the provided data.
- Do not claim live monitoring, predictions, or certainty you don't have.
- End with one line starting exactly with "Suggested next step: " proposing a single concrete action.`;

export async function analystDiagnose(
  kind: "funnel-leak" | "roas-drop",
  metrics: Record<string, unknown>,
  opts: LlmOpts
): Promise<string> {
  const context =
    kind === "funnel-leak"
      ? "A funnel leak was detected. Diagnose why buyers stall, in plain words."
      : "An ad set's ROAS dropped sharply. Diagnose why, using the evidence decomposition.";
  const res = await fetch(opts.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.3,
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `${context}\n\nData (JSON):\n${JSON.stringify(metrics, null, 2)}` },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 120)}`);
  }
  const json = await res.json();
  const text: string | undefined = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error("LLM returned no text.");
  return text.trim();
}

export const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
export const DEFAULT_MODEL = "gpt-4o-mini";

const NARRATE_SYSTEM = `You are the AI Analyst inside Analytica, narrating an investigation to a performance marketer as you work the case together.
Rules you must obey:
- First person, 1-2 plain sentences, casual register, no jargon, no buzzwords.
- Use ONLY the numbers in the provided data. Never invent, estimate, or round figures beyond what is given.
- Do not mention COD, cash on delivery, or anything outside the provided data.
- Do not claim live monitoring, predictions, or certainty you don't have.
- Sound like a colleague thinking aloud ("I scoped it...", "I peeled the layers..."), not a report.`;

/** Live (Level 2) narration for a pipeline stage. Same governance as diagnosis:
 *  computed metrics in, verbalization out. */
export async function analystNarrate(
  stage: string,
  caseTitle: string,
  metrics: Record<string, unknown>,
  opts: LlmOpts
): Promise<string> {
  const res = await fetch(opts.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.4,
      max_tokens: 200,
      messages: [
        { role: "system", content: NARRATE_SYSTEM },
        {
          role: "user",
          content: `Investigation stage: ${stage}. Case: ${caseTitle}. Narrate this step of the investigation.\n\nData (JSON):\n${JSON.stringify(metrics, null, 2)}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 120)}`);
  }
  const json = await res.json();
  const text: string | undefined = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error("LLM returned no text.");
  return text.trim();
}
