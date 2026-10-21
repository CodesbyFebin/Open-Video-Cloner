# Open Video Cloner

Dark browser dashboard and proposed open-source video editing, adaptation and cloning toolkit.

> **Status: UI prototype v0.1.** The supplied Jules archive did **not** implement its claimed eight AI agents, 16 media tools, 12-stage execution pipeline, timeline rendering, voice cloning, lip sync, quality metrics or final media exports. Its server previously generated random progress, job completions and logs; these have been removed.

## Quickstart

Requires Node.js 20+.

```sh
npm install
npm start
```

Open http://127.0.0.1:3000.

## What works

- Original visual dashboard with navigation, workflow mockup, timeline layout and export layout
- Express static hosting and a health endpoint
- `GET /api/health`: reports `mediaProcessing: false`
- `GET /api/state`: empty, truthful agents, jobs and logs
- `GET /api/progress`: idle, zero progress
- `POST /api/clone` and `POST /api/export`: HTTP 501 until real workers exist

**Important:** Some client-side panels still include illustrative labels, tool cards, media examples and export-history rows. These are UI placeholders, **not real processed media**.

## Next implementation milestones

1. Authorized upload, file validation, size limits and project ownership.
2. Persistent jobs, cancel/retry, real event progress and worker isolation.
3. FFmpeg/ffprobe-backed inspect, trim, transcode, extract, compose, thumbnail and export.
4. Opt-in adapters for scene detection, speech recognition, voice generation, lip sync, and script assistance.
5. Timeline/project persistence and real media previews.
6. Measured SSIM/VMAF validation, downloadable artifacts, tests and CI.
7. Rights and consent safeguards for source media, voice and likeness; SSRF defenses and resource quotas.

## Provenance

UI based on the user-provided Jules full-stack-conversion ZIP. It was not production-ready and is published as a prototype without fabricated backend telemetry.

## License

MIT for repository-authored code. External models, assets and media retain their respective licenses.
