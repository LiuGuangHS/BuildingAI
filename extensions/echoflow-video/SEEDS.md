## Echoflow Video Seeded Data

Initial seeds for video generation models and sample data.

### Models

The 4 default HappyHorse video models are seeded into `video_model_config` by the plugin upgrade scripts and returned via `GET /generation/options/models`:

- `happyhorse-1.0-t2v` — Text to Video
- `happyhorse-1.0-i2v` — Image to Video (first frame)
- `happyhorse-1.0-r2v` — Reference to Video
- `happyhorse-1.0-video-edit` — Video Edit

### Database

Run migrations and seeds from the extension root:
```bash
pnpm buildingai extension:release
```

### Configuration

Open the BuildingAI console and configure HappyHorse in:

`/extension/echoflow-video/console/config`

The plugin reads provider credentials from its own admin configuration table. No business API key is required in environment variables.

Configurable HappyHorse fields:

- API Key
- Base URL
- request/test timeout
- retry count and retry delay
- Webhook Secret
- enabled flag
