"use client";

import { ProviderSettingsForm } from "./ProviderSettingsForm";
import { ToastContainer, useToasts } from "./Toast";

export function SettingsPage() {
  const { toasts, notify, dismiss } = useToasts();

  return (
    <div className="settings">
      <ProviderSettingsForm
        provider="llm"
        title="对话模型"
        description="问答使用的 OpenAI 兼容端点。改完地址和 Key 后点击「获取模型列表」，选好模型再保存。"
        notify={notify}
      />
      <ProviderSettingsForm
        provider="image"
        title="生图模型"
        description="AI 效果图使用的 OpenAI 兼容端点，配置方式与对话模型相同。"
        notify={notify}
      />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
