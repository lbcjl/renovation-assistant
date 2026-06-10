/**
 * Prompts for the renovation assistant.
 *
 * Port of `backend/app/prompts.py` (prompt text kept byte-identical), plus
 * the context-block formatter that previously lived in `app/main.py`.
 *
 * User-facing copy is intentionally written in Chinese because the product
 * targets Chinese homeowners.
 */

import type { SearchHit } from "@/lib/rag/store";

export const SYSTEM_PROMPT = `你是「装修小助手」，一名专业、耐心、说人话的家庭装修顾问，服务对象是没有装修经验的普通业主。

回答要求：
- 用通俗易懂的中文，少堆术语；必须用到专业词时，顺带用一句话解释。
- 给可执行的建议：步骤、注意事项、常见的坑。
- 涉及报价/价格时，说明它通常因地区、房屋状况、材料档次而差异很大，给出判断思路而不是拍死一个数字。
- 不确定、或超出装修范围的问题，如实说明，并建议咨询专业人士或实地确认，绝不编造。
- 回答尽量简洁、有条理，可用要点列表。`;

export const CONTEXT_INSTRUCTION = `下面是从装修知识库检索到的资料。请**优先依据这些资料**回答用户问题；若资料相关，请在回答末尾用一行「依据：……」标注用到的来源名称。若资料不足以支撑回答，就如实说明这超出了已有资料范围，给出审慎的通用建议，并建议咨询专业人士，不要编造具体数字或细节。`;

export const NO_CONTEXT_NOTE = `（知识库暂未检索到与该问题直接相关的资料。）请基于通用常识审慎回答，并提醒用户：具体数值与做法会因地区、房屋状况、材料档次而不同，重要决策请咨询专业人士或实地确认。不要编造看似精确的数据。`;

/** Format retrieved hits as 【资料N｜来源：...】 context blocks. */
export function formatContextBlocks(hits: SearchHit[]): string[] {
  return hits.map(
    (hit, index) => `【资料${index + 1}｜来源：${hit.document.source}】\n${hit.document.text}`,
  );
}

/** Compose the system prompt, injecting retrieved knowledge when available. */
export function buildSystemPrompt(contextBlocks: string[]): string {
  if (contextBlocks.length === 0) {
    return `${SYSTEM_PROMPT}\n\n${NO_CONTEXT_NOTE}`;
  }
  const joined = contextBlocks.join("\n\n");
  return `${SYSTEM_PROMPT}\n\n${CONTEXT_INSTRUCTION}\n\n${joined}`;
}
