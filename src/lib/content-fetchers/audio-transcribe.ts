import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

import { pipelineLogSync } from "../pipeline-log.js";
import { stageLog } from "../stage-log.js";

function parseItunesDuration(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parts = value.trim().split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }

  return null;
}

export function itunesDurationToSeconds(value: string | undefined): number | null {
  return parseItunesDuration(value);
}

export function art19EpisodeUrl(
  enclosureUrl: string,
  showSlug = "how-i-built-this",
): string | null {
  const match = /\/episodes\/([0-9a-f-]{36})\.mp3/i.exec(enclosureUrl);
  if (!match) {
    return null;
  }
  return `https://art19.com/shows/${showSlug}/episodes/${match[1]}`;
}

function downloadAudio(audioUrl: string, outputPath: string): void {
  const result = spawnSync("curl", ["-sL", "--fail", audioUrl, "-o", outputPath], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0 || !existsSync(outputPath)) {
    throw new Error(result.stderr?.trim() || `failed to download audio from ${audioUrl}`);
  }
}

export function transcribeAudioFile(
  audioPath: string,
  options: { model?: string; sourceId?: string; itemId?: string } = {},
): string {
  const model = options.model ?? process.env.WHISPER_MODEL ?? "base";
  const outputDir = join(tmpdir(), `whisper-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(outputDir, { recursive: true });

  try {
    const result = pipelineLogSync(
      "podcast-fetch",
      "whisper-transcribe",
      {
        sourceId: options.sourceId ?? null,
        itemId: options.itemId ?? null,
        model,
      },
      () =>
        spawnSync(
          "whisper",
          [
            audioPath,
            "--model",
            model,
            "--output_format",
            "txt",
            "--output_dir",
            outputDir,
            "--language",
            "en",
            "--fp16",
            "False",
          ],
          { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
        ),
    );

    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || "whisper failed");
    }

    const baseName = audioPath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "audio";
    const transcriptPath = join(outputDir, `${baseName}.txt`);
    if (!existsSync(transcriptPath)) {
      const fallback = join(outputDir, "audio.txt");
      if (!existsSync(fallback)) {
        throw new Error("whisper produced no transcript file");
      }
      return readFileSync(fallback, "utf8").trim();
    }

    return readFileSync(transcriptPath, "utf8").trim();
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

export function transcribeAudioUrl(
  audioUrl: string,
  options: { model?: string; sourceId?: string; itemId?: string } = {},
): string {
  const tempDir = join(tmpdir(), `podcast-audio-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  const audioPath = join(tempDir, "episode.mp3");

  try {
    stageLog("podcast-fetch", "downloading audio", {
      sourceId: options.sourceId ?? null,
      itemId: options.itemId ?? null,
    });
    downloadAudio(audioUrl, audioPath);
    return transcribeAudioFile(audioPath, options);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export function writeTranscriptFile(path: string, text: string): void {
  writeFileSync(path, `${text.trim()}\n`, "utf8");
}
