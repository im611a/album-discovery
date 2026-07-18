"use client";

import { useRef, useState } from "react";
import { TasteSetup } from "@/components/taste/taste-setup";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";

export function SettingsPanel() {
  const { exportJson, importJson, reset } = usePersonalState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  function download() { const url = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "album-discovery-state.json"; anchor.click(); URL.revokeObjectURL(url); }
  async function importFile(file?: File) { if (!file) return; const result = importJson(await file.text()); setMessage(result.ok ? "导入完成。" : result.message); if (inputRef.current) inputRef.current.value = ""; }
  return <div className="settings-stack">
    <section className="settings-card"><h2>本机数据</h2><p>口味选择、想听、喜欢、听过和“不适合我”只保存在当前浏览器，不会上传。</p><div className="form-actions"><button className="button button--secondary" type="button" onClick={download}>导出 JSON</button><button className="button button--secondary" type="button" onClick={() => inputRef.current?.click()}>导入 JSON</button><button className="button button--danger" type="button" onClick={() => { if (window.confirm("确定清除当前设备上的全部专辑状态吗？")) { reset(); setMessage("本机数据已重置。"); } }}>重置全部</button></div><input ref={inputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />{message ? <p role="status">{message}</p> : null}</section>
    <div id="taste"><TasteSetup redirectTo={null} /></div>
  </div>;
}
