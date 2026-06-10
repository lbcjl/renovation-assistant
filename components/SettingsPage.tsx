"use client";

import { ProviderSettingsForm } from "./ProviderSettingsForm";

export function SettingsPage() {
  return (
    <div className="settings">
      <ProviderSettingsForm
        provider="llm"
        title="对话模型"
        description="问答使用的 OpenAI 兼容端点。改完地址和 Key 后点击「获取模型列表」，选好模型再保存。"
      />
      <ProviderSettingsForm
        provider="image"
        title="生图模型"
        description="AI 效果图使用的 OpenAI 兼容端点，配置方式与对话模型相同。"
      />
    </div>
  );
}
