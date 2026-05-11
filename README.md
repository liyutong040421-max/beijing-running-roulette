# Beijing Running Roulette

一个北京跑步路线抽选小网页：左侧路线轮盘，右侧北京区域图、真实路线截图和路线详情。

## Local Preview

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env.local` for local development.

```bash
NEXT_PUBLIC_AMAP_JS_KEY=
NEXT_PUBLIC_AMAP_SECURITY_JS_CODE=
AMAP_WEB_SERVICE_KEY=
```

Do not commit `.env.local`.

## Deploy To Vercel

1. Push this project to a GitHub repository.
2. Import the repository in Vercel.
3. Add the environment variables above in Vercel project settings.
4. Deploy.

After deployment, add the Vercel domain to the 高德 Web JS API key whitelist if 高德 browser-side features are enabled.

## Internal Pages

- `/review` is a local photo review helper. It is not linked from the public home page.
