# Open Video Cloner

**v0.3 secure local-workspace candidate.** Real FFmpeg conversion, trimming, frame extraction, authenticated projects, cancellation, retention cleanup, and sequential timeline rendering. Not an AI cloning engine.

## Startup

Install Node.js 20+, FFmpeg and FFprobe. Generate a secret and set the environment variable OVC_API_KEY to 32+ random characters. Example shell command:

    export OVC_API_KEY="$(openssl rand -hex 32)"
    npm install
    npm test
    npm start

Open http://127.0.0.1:3000/secure.html and paste the API key. The browser stores it only in page memory.

To run the browser E2E test, install Chromium with npx playwright install chromium, then run npm run test:browser. The test generates actual video using FFmpeg.

## API

All /api routes except /api/health require Authorization: Bearer <OVC_API_KEY>. This is a shared instance-wide key, **not multi-user authentication**.

- POST /api/projects — create project with name
- GET /api/projects — list projects
- POST /api/projects/:id/uploads — multipart video upload, validated through FFprobe
- GET /api/projects/:id/uploads — list media
- POST /api/projects/:id/jobs — conversion, trim, frame, timeline
- GET /api/projects/:id/jobs — project-specific jobs
- GET /api/jobs/:id — job status
- POST /api/jobs/:id/cancel — cancel queued or processing job
- GET /api/jobs/:id/download — authenticated completed artifact
- POST /api/maintenance/cleanup — JSON body with days: 30
- GET /api/events — authenticated SSE (secure UI uses polling instead)
- POST /api/clone — HTTP 501, AI cloning not implemented

Timeline payload example:

    {"operation":"timeline","clips":[{"uploadId":"UUID","start":0,"end":2},{"uploadId":"UUID","start":2,"end":4}]}

Timeline rendering concatenates 1–12 video clips, maximum 30 minutes, normalized to 1280x720 at 30fps, MP4 H.264. It produces **video without audio** and is not a multitrack editor.

## Security boundaries

The server binds localhost by default. Requests to protected endpoints require a secret. Media filenames are randomized, uploads capped, FFprobe validates video metadata, FFmpeg args use spawn without a shell, workers are single-concurrency and have a default one-hour timeout, and terminal data can be deleted by explicit retention cleanup.

**Not safe for internet exposure or hostile media yet.** FFmpeg is a child process in the Node OS security domain, not an isolated container. There is no cgroup/seccomp sandbox, dedicated unprivileged worker identity, quota, per-user access controls, TLS proxy or automated retention scheduler. Before public deployment put FFmpeg in a locked-down container or VM with no network, per-job temporary mounts, resource limits and unprivileged identity.

The legacy root dashboard is illustrative and does not use the new authenticated API. Use /secure.html. JSON persistence is single-process only; multiple replicas must not share the same files.

## Verification

Unit/API and Playwright browser tests have been added. The browser test generates and processes real test media. Do not claim CI passed without checking the actual workflow run.

## License

MIT applies to repository-authored code; media, models and dependencies have their own rights and licenses.

## v0.4 candidate: SQLite + Docker media boundary

Node.js 22.13+ is required for built-in `node:sqlite`. Data is stored in `data/state.sqlite` with WAL and transactional snapshot commits. Existing JSON data is imported on first start only if the database is empty. Retain backups of the old JSON data before upgrade.

Default `npm start` continues to execute FFmpeg directly on the local host for development and is **not sandboxed**.

To exercise the Docker boundary, build the dedicated worker and enable the mode:

```sh
docker build -t ovc-ffmpeg:local -f Dockerfile.worker .
export OVC_WORKER_MODE=docker
export OVC_API_KEY="$(openssl rand -hex 32)"
npm start
```

Docker mode runs FFmpeg and FFprobe using a container with no networking, read-only root, dropped capabilities, no-new-privileges, restricted process/memory/CPU budgets, temporary filesystem and mounted input media as read-only. Outputs are mounted writable. The runner requires a trusted, configured Docker daemon; use only on a Linux host where bind mounts and UID permissions have been verified. It is not a substitute for a hardened VM or full independent security assessment.

**Limitations:** still one shared instance API key (not per-user RBAC), one Node process, manual retention, interruption rather than automatic requeue after a crash, and no tested multi-replica worker lease. User accounts, independent worker service, retries and richer audit controls remain future tasks. The CI workflow adds Docker-mode browser processing; examine its run result before claiming Docker isolation verified.
