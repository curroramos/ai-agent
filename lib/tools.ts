import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// --- youtube_transcript tool -------------------------------------------------
export const youtubeTranscriptTool = new DynamicStructuredTool({
  name: "youtube_transcript",
  description: "Retrieve a YouTube video transcript. Requires videoUrl and langCode.",
  schema: z.object({
    videoUrl: z.string().url(),
    langCode: z.string().optional().default("en"),
  }),
  func: async ({ videoUrl, langCode }) => {
    const videoId = videoIdFromUrl(videoUrl);
    if (!videoId) throw new Error("Un-recognised YouTube URL");

    // Candidate endpoints (try JSON first, then XML, then ASR).
    const endpoints = [
      `https://video.google.com/timedtext?fmt=json3&lang=${langCode}&v=${videoId}`,
      `https://video.google.com/timedtext?lang=${langCode}&v=${videoId}`,
      `https://video.google.com/timedtext?fmt=json3&type=asr&lang=${langCode}&v=${videoId}`,
      `https://video.google.com/timedtext?type=asr&lang=${langCode}&v=${videoId}`,
    ];

    let cues: { text: string; start: number; dur: number }[] | undefined;

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { headers: new Headers({ "User-Agent": "transcript-bot" }) });
        if (!res.ok) continue;                            // move on ─ bad status
        const ctype = res.headers.get("content-type") ?? "";

        if (ctype.includes("application/json") || url.includes("fmt=json3")) {
          const data = (await res.json()) as { events?: any[] };
          if (!data?.events) continue;
          cues = data.events.flatMap(ev =>
            (ev.segs ?? []).map((seg: any) => ({
              text: seg.utf8.trim(),
              start: (ev.tStartMs ?? 0) / 1000,
              dur: (ev.dDurationMs ?? ev.dur ?? 0) / 1000,
            })),
          );
        } else {
          const xml = await res.text();
          if (!xml.trim()) continue;
          cues = xmlToCues(xml);
        }
        if (cues?.length) break;                         // success
      } catch (err) {
        console.error(`[transcript fetch] ${url}:`, err);
      }
    }

    if (!cues?.length)
      throw new Error(`No transcript available for ${videoId} (${langCode})`);

    return {
      title: await fetchYouTubeTitle(videoId),
      captions: cues,
      language: langCode,
      videoUrl,
    };
  },
});


// --- google_books tool -------------------------------------------------------
export const googleBooksTool = new DynamicStructuredTool({
  name: "google_books",
  description: "Search for books. Requires query and maxResults.",
  schema: z.object({
    q: z.string(),
    maxResults: z.string().default("5"), // must stay string
  }),
  func: async ({ q, maxResults }) => {
    const max = Math.max(1, Math.min(Number.parseInt(maxResults, 10) || 5, 40));

    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
      q,
    )}&maxResults=${max}`;

    try {
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(`Books API error: ${res.status} ${res.statusText}`);

      const data = (await res.json()) as { items?: any[] };
      const results = (data.items ?? []).map(item => ({
        volumeId: item.id,
        title: item.volumeInfo?.title ?? "Untitled",
        authors: item.volumeInfo?.authors ?? [],
      }));

      return { query: q, results };
    } catch (err) {
      console.error("[google_books]", err);
      throw err;
    }
  },
});
