"use client";

import { useEffect, useRef, useState } from "react";

import { generateImages } from "@/lib/api-client";

/** Aspect-ratio presets; values are the provider pixel sizes. */
const RATIO_OPTIONS = [
  { label: "1:1 方形", value: "1024x1024" },
  { label: "3:2 横版", value: "1536x1024" },
  { label: "2:3 竖版", value: "1024x1536" },
  { label: "16:9 横屏", value: "1792x1024" },
  { label: "9:16 竖屏", value: "1024x1792" },
];

/** Empty value means "auto": the provider picks its default quality. */
const QUALITY_OPTIONS = [
  { label: "自动", value: "" },
  { label: "高", value: "high" },
  { label: "中", value: "medium" },
  { label: "低", value: "low" },
];

const COUNT_OPTIONS = [1, 2, 3, 4];

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(RATIO_OPTIONS[0].value);
  const [quality, setQuality] = useState("");
  const [count, setCount] = useState(1);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URLs must be revoked when replaced or on unmount.
  useEffect(() => {
    if (!referenceImage) {
      setReferencePreview("");
      return;
    }
    const url = URL.createObjectURL(referenceImage);
    setReferencePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [referenceImage]);

  function handleSelectImage(file: File | undefined): void {
    if (!file) {
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("图片不能超过 10MB");
      return;
    }
    setError("");
    setReferenceImage(file);
  }

  function handleRemoveImage(): void {
    setReferenceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleGenerate(): Promise<void> {
    if (!prompt.trim()) {
      setError("请输入描述");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const urls = await generateImages(prompt, {
        size,
        quality,
        n: count,
        image: referenceImage ?? undefined,
      });
      setImageUrls(urls);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败，请重试";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="image-generator">
      <h2 className="image-generator__title">AI 生成效果图</h2>
      <div className="image-generator__form">
        <div className="image-generator__upload">
          <input
            ref={fileInputRef}
            id="image-generator-reference"
            className="image-generator__file-input"
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            onChange={(e) => handleSelectImage(e.target.files?.[0])}
            disabled={loading}
          />
          {referenceImage ? (
            <div className="image-generator__reference">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img
                src={referencePreview}
                alt="户型图预览"
                className="image-generator__reference-thumb"
              />
              <div className="image-generator__reference-info">
                <span className="image-generator__reference-name">{referenceImage.name}</span>
                <span className="image-generator__reference-mode">
                  将以这张图为底图生成设计图
                </span>
              </div>
              <button
                type="button"
                className="image-generator__reference-remove"
                onClick={handleRemoveImage}
                disabled={loading}
              >
                移除
              </button>
            </div>
          ) : (
            <label htmlFor="image-generator-reference" className="image-generator__upload-label">
              + 上传房屋平面图（可选，PNG/JPG/WebP，10MB 内）
            </label>
          )}
        </div>
        <textarea
          className="image-generator__textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            referenceImage
              ? "描述设计要求，例如：根据这张户型图设计现代简约风格的全屋方案，客厅朝南采光好"
              : "描述你想要的装修效果，例如：现代简约风格客厅，白色墙面，木质地板，落地窗"
          }
          rows={3}
          disabled={loading}
        />
        <div className="image-generator__options">
          <label className="image-generator__option">
            <span className="image-generator__option-label">比例</span>
            <select
              className="image-generator__select"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              disabled={loading}
            >
              {RATIO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="image-generator__option">
            <span className="image-generator__option-label">质量</span>
            <select
              className="image-generator__select"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              disabled={loading}
            >
              {QUALITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="image-generator__option">
            <span className="image-generator__option-label">数量</span>
            <select
              className="image-generator__select"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={loading}
            >
              {COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} 张
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="image-generator__button"
          onClick={() => void handleGenerate()}
          disabled={loading || !prompt.trim()}
        >
          {loading ? "生成中..." : referenceImage ? "根据户型图生成设计图" : "生成效果图"}
        </button>
      </div>
      {loading && (
        <div className="image-generator__hint">正在生成效果图，约需 1~2 分钟，请耐心等待…</div>
      )}
      {error && <div className="image-generator__error">{error}</div>}
      {imageUrls.length > 0 && (
        <div
          className={
            imageUrls.length > 1
              ? "image-generator__result image-generator__result--grid"
              : "image-generator__result"
          }
        >
          {imageUrls.map((url, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- provider-hosted URL, not optimizable
            <img
              key={`${index}-${url.slice(0, 64)}`}
              src={url}
              alt={`生成的效果图 ${index + 1}`}
              className="image-generator__image"
            />
          ))}
        </div>
      )}
    </div>
  );
}
