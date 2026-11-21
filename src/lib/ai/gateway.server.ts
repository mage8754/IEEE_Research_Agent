import {
  generateChatCompletion,
  GatewayError,
  PaymentRequiredError,
  PermissionDeniedError,
  RateLimitError,
} from "@lovable.dev/ai-gateway";
import type { z } from "zod";

/** Gemini model used for every research task (served through Lovable AI). */
export const RESEARCH_MODEL = "google/gemini-3.8-flash" as const;

const BASE_RULES = `You are IEEE Research Agent, an expert academic editor and IEEE reviewer.
Rules you must always follow:
- Use only the text the user provides. Never invent results, numbers, datasets, citations or references.
- If information is not present in the text, say "Not stated in the document".
- Never claim a citation or fact has been externally verified.
- Respond with a single valid JSON object only, matching the requested shape. No markdown fences.`;

function parseJson(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("parse");
  }
}

export async function generateJson<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  task: string,
  input: string,
): Promise<T> {
  let content: string | null | undefined;
  try {
    const completion = await generateChatCompletion({
      model: RESEARCH_MODEL,
      messages: [
        { role: "system", content: `${BASE_RULES}\n\n${task}` },
        { role: "user", content: input },
      ],
      response_format: { type: "json_object" },
    });
    content = completion.choices?.[0]?.message?.content as string | null | undefined;
  } catch (error) {
    console.error("AI gateway error", error);
    if (error instanceof RateLimitError)
      throw new Error("The AI service is busy right now. Please wait a moment and try again.");
    if (error instanceof PaymentRequiredError)
      throw new Error("AI credits for this workspace are used up. Add credits to continue.");
    if (error instanceof PermissionDeniedError)
      throw new Error("The AI model is not available for this workspace.");
    if (error instanceof GatewayError)
      throw new Error("The AI service could not complete this request. Please try again.");
    throw new Error("Unexpected error while contacting the AI service.");
  }
  if (!content) throw new Error("The AI returned an empty response. Please try again.");
  let parsed: unknown;
  try {
    parsed = parseJson(content);
  } catch {
    throw new Error("The AI returned an unreadable response. Please try again.");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error("AI schema mismatch", result.error.issues.slice(0, 5));
    throw new Error("The AI response was incomplete. Please try again.");
  }
  return result.data;
}
