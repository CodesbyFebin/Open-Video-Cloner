# Open Video Cloner

A local-first FFmpeg media-processing workbench, with an experimental UI for future AI-assisted video adaptation.

> **Status: FFmpeg MVP v0.2 — not an AI video cloner.** Real local video upload, inspection, conversion, trimming, frame extraction and downloads are implemented. The eight AI agents, voice/face cloning, script synthesis, model-driven style transfer and legacy timeline are not implemented. Illustrative legacy UI panels do not represent real processing.

## Run locally

Requirements: Node.js 20+, FFmpeg and FFprobe on PATH, free disk space for uploads and exports.

```sh
npm install
npm test
npm start
```

Open http://127.0.0.1:3000. Use the **FFmpeg Media Tools** panel on the dashboard to upload a local video, select convert/trim/frame, and create a job. Watch the real job status and download completed output.

The server binds to `127.0.0.1` by default. **Do not expose it on the public internet:** there is no user authentication, rate limiting, quotas per account, or hardened worker sandbox yet. Only submit media you are authorized to process.

## Implemented backend

| Endpoint | Function |
| --- | --- |
| `GET /api/health` | Service status |
| `POST /api/upload` | Multipart `file` upload, size cap, FFprobe validation |
| `POST /api/jobs` | Create convert, trim or frame job from `uploadId` |
| `GET /api/jobs` | Persistent job list |
| `GET /api/jobs/:id` | Job status and real FFmpeg percentage |
| `GET /api/jobs/:id/download` | Download completed media artifact |
| `GET /api/events` | Server-sent job state notifications |
| `GET /api/state` | Dashboard state derived from durable jobs |
| `POST /api/clone` | HTTP 501; AI cloning unavailable |
| `POST /api/export` | HTTP 501; use completed job download URL |

Example JSON for `POST /api/jobs`:

```json
{"uploadId":"<id-returned-from-upload>","operation":"trim","format":"mp4","start":1,"end":5}
```

Operations: `transcode` (MP4/WebM/MOV), `trim` (seconds), `frame` (JPEG at `start`). Input accepts .mp4, .mov, .mkv, .webm, .m4v and .avi with actual video stream. Invalid or oversized files are rejected.

## Persistence and progress

Uploaded videos and FFprobe records live under `data/inputs`. Exports are stored under `data/outputs`; durable job records are saved to `data/jobs.json` with atomic replacement. A single FFmpeg worker processes jobs sequentially and broadcasts status changes through SSE. Interrupted jobs are marked as interrupted on restart rather than falsely declared complete. Data retention and cleanup are currently manual.

## Tests

`npm test` runs validation tests, server lifecycle tests with a deterministic worker, and a **real** generated-video FFmpeg/FFprobe smoke test when those executables are installed. GitHub Actions installs FFmpeg and runs them. Do not assume CI passed until checking the actual workflow status.

## Security and implementation boundaries

- No external URL downloading; avoids server-side URL-fetch abuse.
- FFmpeg arguments are constructed as arrays for `spawn`, not interpolated into a shell command.
- Filenames on disk use random UUIDs and upload size is capped at 256 MiB by default (`MAX_UPLOAD_BYTES` can lower/raise up to 1 GiB).
- Local server only; not production safe for untrusted users or publicly exposed upload traffic.
- Future milestones: authentication, quotas, cancellation, worker isolation, retention, timeline rendering, and separately configurable consent-driven AI model adapters.

## Jules developer automation (experimental)

An initial `jules/automation.mjs` validation module exists. Jules cloud sessions are separate from local FFmpeg jobs and must not be mistaken for video-processing agents. Developer CLI integration remains pending.

## License

MIT for repository-authored code. Models, media and third-party assets have separate rights and licenses.
