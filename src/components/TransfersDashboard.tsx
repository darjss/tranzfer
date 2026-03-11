import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/billing/plans";
import {
  MULTIPART_PART_SIZE_BYTES,
  type TransferListResponse,
  type TransferSummary,
} from "@/lib/transfers";
import { authClient } from "@/lib/auth-client";

type UploadInstruction =
  | {
      method: "PUT";
      mode: "single";
      url: string;
    }
  | {
      method: "PUT";
      mode: "multipart";
      partSizeBytes: number;
      parts: Array<{ partNumber: number; url: string }>;
      uploadId: string;
    };

type TransfersDashboardProps = {
  userEmail: string;
  userName: string | null;
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

export default function TransfersDashboard(props: TransfersDashboardProps) {
  const [dashboard, setDashboard] = createSignal<TransferListResponse | null>(null);
  const [title, setTitle] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [selectedFiles, setSelectedFiles] = createSignal<File[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [isUploading, setIsUploading] = createSignal(false);
  const [statusText, setStatusText] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [shareLink, setShareLink] = createSignal<string | null>(null);

  const selectedTotalBytes = createMemo(() => {
    return selectedFiles().reduce((sum, file) => sum + file.size, 0);
  });

  const remainingStorageBytes = createMemo(() => {
    const state = dashboard();
    if (!state) return 0;
    return Math.max(0, state.entitlement.storageLimitBytes - state.entitlement.activeStorageBytes);
  });

  async function loadDashboard() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/transfers");
      setDashboard(await readJson<TransferListResponse>(response));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load transfers.");
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadSingleFile(
    transferId: string,
    fileId: string,
    file: File,
    upload: Extract<UploadInstruction, { mode: "single" }>,
  ) {
    const response = await fetch(upload.url, {
      body: file,
      headers: file.type ? { "content-type": file.type } : undefined,
      method: upload.method,
    });

    if (!response.ok) {
      throw new Error(`Upload failed for ${file.name}.`);
    }

    await readJson<{ ok: true }>(
      await fetch(`/api/transfers/${transferId}/files/${fileId}/complete`, {
        body: JSON.stringify({
          etag: response.headers.get("etag"),
          mode: "single",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
  }

  async function uploadMultipartFile(
    transferId: string,
    fileId: string,
    file: File,
    upload: Extract<UploadInstruction, { mode: "multipart" }>,
  ) {
    const uploadedParts: Array<{ etag: string; partNumber: number }> = [];

    for (const part of upload.parts) {
      const start = (part.partNumber - 1) * upload.partSizeBytes;
      const end = Math.min(start + upload.partSizeBytes, file.size);
      const chunk = file.slice(start, end);
      const response = await fetch(part.url, {
        body: chunk,
        method: upload.method,
      });

      if (!response.ok) throw new Error(`Multipart upload failed for ${file.name}.`);

      uploadedParts.push({
        etag: response.headers.get("etag") || "",
        partNumber: part.partNumber,
      });
      setStatusText(`Uploading ${file.name}: ${part.partNumber}/${upload.parts.length} parts complete`);
    }

    await readJson<{ ok: true }>(
      await fetch(`/api/transfers/${transferId}/files/${fileId}/complete`, {
        body: JSON.stringify({
          mode: "multipart",
          parts: uploadedParts,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
  }

  async function createTransfer() {
    if (selectedFiles().length === 0) {
      setError("Choose at least one file.");
      return;
    }

    setError(null);
    setShareLink(null);
    setIsUploading(true);

    try {
      setStatusText("Creating transfer draft...");
      const createResponse = await readJson<{ plan: "free" | "pro"; transfer: TransferSummary }>(
        await fetch("/api/transfers", {
          body: JSON.stringify({
            files: selectedFiles().map((file) => ({
              contentType: file.type || null,
              name: file.name,
              sizeBytes: file.size,
            })),
            message: message(),
            title: title(),
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
      const remoteFiles = createResponse.transfer.files;

      if (remoteFiles.length !== selectedFiles().length) {
        throw new Error("Upload manifest does not match the selected files.");
      }

      for (let index = 0; index < remoteFiles.length; index += 1) {
        const remoteFile = remoteFiles[index];
        const localFile = selectedFiles()[index];

        setStatusText(`Preparing upload for ${localFile.name}...`);
        const uploadResponse = await readJson<{ fileId: string; upload: UploadInstruction }>(
          await fetch(`/api/transfers/${createResponse.transfer.id}/files/${remoteFile.id}/upload-url`, { method: "POST" }),
        );

        if (uploadResponse.upload.mode === "single") {
          await uploadSingleFile(createResponse.transfer.id, remoteFile.id, localFile, uploadResponse.upload);
        } else {
          await uploadMultipartFile(createResponse.transfer.id, remoteFile.id, localFile, uploadResponse.upload);
        }
      }

      setStatusText("Publishing share link...");
      const publishResponse = await readJson<{ shareUrl: string }>(
        await fetch(`/api/transfers/${createResponse.transfer.id}/publish`, { method: "POST" }),
      );

      setShareLink(`${window.location.origin}${publishResponse.shareUrl}`);
      setTitle("");
      setMessage("");
      setSelectedFiles([]);
      await loadDashboard();
      setStatusText("Transfer ready.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not publish transfer.");
      setStatusText(null);
    } finally {
      setIsUploading(false);
    }
  }

  async function copyShareLink(slug: string) {
    const url = `${window.location.origin}/t/${slug}`;
    await navigator.clipboard.writeText(url);
    setShareLink(url);
  }

  async function handleSignOut() {
    await authClient.signOut();
    window.location.assign("/");
  }

  onMount(() => {
    void loadDashboard();
  });

  return (
    <div class="grid gap-8 animate-fade-up">
      {/* Header Area */}
      <div class="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <div class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em] text-zinc-500 mb-3 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-electric animate-pulse-soft"></span>
            Command Center
          </div>
          <h1 class="text-4xl font-medium tracking-tight text-white">
            {props.userName ? props.userName : "Operator"}
          </h1>
          <p class="mt-2 text-sm font-mono text-zinc-500 tracking-tight">
            ID: <span class="text-zinc-300">{props.userEmail}</span>
          </p>
        </div>

        <div class="flex gap-3">
          <a
            class="rounded-full border border-white/10 bg-transparent px-5 py-2 text-[0.75rem] font-mono uppercase tracking-wider text-zinc-300 transition-all duration-300 hover:bg-white/5 hover:text-white"
            href="/account/billing"
          >
            Billing
          </a>
          <button
            class="rounded-full border border-transparent bg-white/5 px-5 py-2 text-[0.75rem] font-mono uppercase tracking-wider text-zinc-400 transition-all duration-300 hover:bg-white/10 hover:text-white"
            onClick={() => void handleSignOut()}
          >
            Abort Session
          </button>
        </div>
      </div>

      <div class="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
        {/* Left: Uploader (Cockpit Mode) */}
        <div class="glass-panel rounded-[2rem] p-8 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-8">
              <h2 class="text-xl font-medium text-white">New Transmission</h2>
              <div class="font-mono text-[0.65rem] uppercase tracking-widest text-zinc-500">Form_01</div>
            </div>

            <div class="grid gap-6">
              <div class="group relative">
                <input
                  class="w-full bg-transparent border-b border-white/10 py-3 text-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-electric transition-colors"
                  onInput={(event) => setTitle(event.currentTarget.value)}
                  placeholder="Transmission ID (e.g. V3_FINAL_CUT)"
                  value={title()}
                />
              </div>

              <div class="group relative">
                <textarea
                  class="w-full bg-transparent border-b border-white/10 py-3 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-electric transition-colors min-h-20 resize-none font-mono"
                  onInput={(event) => setMessage(event.currentTarget.value)}
                  placeholder="Attach operational notes..."
                  value={message()}
                />
              </div>

              <div class="relative rounded-2xl border border-dashed border-white/15 bg-white/[0.01] px-6 py-10 text-center transition-all duration-500 hover:border-electric/50 hover:bg-electric/[0.02]">
                <input
                  class="absolute inset-0 cursor-pointer opacity-0"
                  multiple
                  onChange={(event) => {
                    const nextFiles = Array.from(event.currentTarget.files ?? []);
                    setSelectedFiles(nextFiles);
                  }}
                  type="file"
                />
                <div class="flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    <svg class="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div class="text-[0.8rem] font-mono text-zinc-400">
                    DROP_PAYLOAD_HERE
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-8">
            <Show when={selectedFiles().length > 0}>
              <div class="flex items-center justify-between mb-6 px-4 py-3 rounded-xl bg-electric/10 border border-electric/20">
                <div class="text-[0.75rem] font-mono text-electric">
                  {selectedFiles().length} FILE(S) LOADED
                </div>
                <div class="text-[0.75rem] font-mono font-bold text-white">
                  {formatBytes(selectedTotalBytes())}
                </div>
              </div>
            </Show>

            <button
              class="w-full rounded-full bg-white px-6 py-4 text-[0.8rem] font-bold uppercase tracking-[0.15em] text-zinc-950 transition-all duration-500 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-95"
              disabled={isUploading() || selectedFiles().length === 0}
              onClick={() => void createTransfer()}
              type="button"
            >
              {isUploading() ? "TRANSMITTING..." : "INITIATE TRANSFER"}
            </button>
            
            <Show when={statusText()}>
              <div class="mt-4 text-center text-[0.7rem] font-mono text-zinc-400 animate-pulse-soft">
                {statusText()}
              </div>
            </Show>

            <Show when={shareLink()}>
              <div class="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <div class="text-[0.65rem] font-mono text-emerald-400 mb-2 uppercase tracking-widest">Link Generated</div>
                <a class="text-sm font-medium text-white hover:text-emerald-300 break-all transition-colors" href={shareLink()!} target="_blank">
                  {shareLink()}
                </a>
              </div>
            </Show>

            <Show when={error()}>
              <div class="mt-4 text-center text-[0.7rem] font-mono text-red-400">
                ERR: {error()}
              </div>
            </Show>
          </div>
        </div>

        {/* Right: Metrics & History */}
        <div class="flex flex-col gap-8">
          {/* Metrics Bento */}
          <div class="grid grid-cols-2 gap-4">
            <div class="glass-panel rounded-[2rem] p-6 flex flex-col justify-between aspect-square">
              <div class="text-[0.65rem] font-mono text-zinc-500 uppercase tracking-widest">Active Storage</div>
              <div>
                <div class="text-3xl font-mono text-white mb-1">
                  {dashboard() ? formatBytes(dashboard()!.entitlement.activeStorageBytes) : "---"}
                </div>
                <div class="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                  <div class="h-full bg-zinc-400 rounded-full" style={{ width: dashboard() ? `${(dashboard()!.entitlement.activeStorageBytes / dashboard()!.entitlement.storageLimitBytes) * 100}%` : '0%' }}></div>
                </div>
              </div>
            </div>

            <div class="glass-panel rounded-[2rem] p-6 flex flex-col justify-between aspect-square">
              <div class="text-[0.65rem] font-mono text-zinc-500 uppercase tracking-widest">Capacity</div>
              <div>
                <div class="text-3xl font-mono text-white mb-1">
                  {dashboard() ? formatBytes(remainingStorageBytes()) : "---"}
                </div>
                <div class="text-[0.7rem] font-mono text-electric">
                  PLAN: {dashboard()?.entitlement.plan.toUpperCase() ?? "FREE"}
                </div>
              </div>
            </div>
          </div>

          {/* History */}
          <div class="glass-panel rounded-[2rem] p-6 flex-1 flex flex-col">
            <div class="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <div class="text-[0.65rem] font-mono uppercase tracking-[0.2em] text-zinc-500">Transmission Log</div>
              <button class="text-[0.65rem] font-mono text-zinc-400 hover:text-white transition-colors" onClick={() => void loadDashboard()}>
                [ REFRESH ]
              </button>
            </div>

            <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <Show
                when={!isLoading() && (dashboard()?.transfers.length ?? 0) > 0}
                fallback={
                  <div class="h-full flex items-center justify-center text-[0.75rem] font-mono text-zinc-600">
                    AWAITING_FIRST_TRANSMISSION
                  </div>
                }
              >
                <div class="flex flex-col gap-4">
                  <For each={dashboard()?.transfers ?? []}>
                    {(item) => (
                      <div class="group border border-white/5 bg-white/[0.01] rounded-2xl p-4 transition-all hover:bg-white/5 hover:border-white/10">
                        <div class="flex justify-between items-start mb-3">
                          <div>
                            <div class="text-sm font-medium text-white mb-1">{item.title || "UNTITLED_PAYLOAD"}</div>
                            <div class="text-[0.65rem] font-mono text-zinc-500">{new Date(item.expiresAt).toLocaleDateString()}</div>
                          </div>
                          <div class="text-[0.65rem] font-mono px-2 py-1 rounded bg-white/5 text-zinc-400">
                            {item.status}
                          </div>
                        </div>
                        
                        <div class="flex items-center gap-4 text-[0.7rem] font-mono text-zinc-400 mb-4">
                          <span>{item.fileCount} FILE{item.fileCount !== 1 && "S"}</span>
                          <span class="w-1 h-1 rounded-full bg-zinc-700"></span>
                          <span>{formatBytes(item.totalBytes)}</span>
                        </div>

                        <div class="flex gap-2">
                          <button
                            class="flex-1 rounded-lg border border-white/10 py-2 text-[0.65rem] font-mono uppercase tracking-widest text-zinc-300 hover:bg-white/10 transition-colors"
                            onClick={() => void copyShareLink(item.slug)}
                          >
                            Copy Link
                          </button>
                          <a
                            class="flex-1 rounded-lg bg-white/10 py-2 text-[0.65rem] font-mono uppercase tracking-widest text-white text-center hover:bg-white/20 transition-colors"
                            href={`/t/${item.slug}`}
                            target="_blank"
                          >
                            Open
                          </a>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
