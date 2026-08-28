# Deploying Posh List

This turns the code into a real, always-on website with a link your family can open — currently it only runs on whichever computer starts it.

Recommended host: **[Render](https://render.com)**. It runs a real server (needed for the live sync — this isn't the kind of app that fits a "serverless" host like Vercel or Netlify), and it can deploy straight from a GitHub repo with a few clicks.

## Before you start

Push this code to your `Posh-List` GitHub repo first (see the README for the git commands, if you haven't already). Render deploys from GitHub, so the code needs to be there.

## Steps

1. **Sign up at [render.com](https://render.com)** — free, no card needed for this step.
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account when prompted, and pick the **Posh-List** repo.
4. Render will find the `render.yaml` file in this repo and read the setup from it automatically — service name, build/start commands, a small persistent disk for the data. Click **Apply** to confirm.
5. Render will ask you to add a payment method at this point — that's for the 1GB disk (about **$0.25/month**), which is what makes the shopping list survive restarts and redeploys rather than resetting itself. The web server itself stays on Render's free tier.
6. Wait for the first deploy to finish (a few minutes) — you'll see build logs.
7. Once it says **Live**, Render gives you a URL like `https://posh-list.onrender.com`. Open it — that's the real app.

## What to expect

- **Free-tier services on Render spin down after periods of no traffic**, and take 30–60 seconds to wake back up on the next visit. For a small family list that's opened a few times a day, that's a fine trade-off for $0.25/month — if it bothers you, Render's paid "Starter" compute tier (a few dollars/month) keeps it always warm.
- Whoever opens the site first creates a list and gets a share link — from then on, share that link (not the render.onrender.com homepage) with the rest of the family. That's the actual link people should bookmark or add to their home screen.
- Google Fonts (used for the display/body/mono typefaces) load from the internet as normal on a real deployment — the font-loading issue mentioned earlier only applied to this dev sandbox's network restrictions, not to a real deployed site.

## If you change the code later

Push to the `main` branch on GitHub — Render's Blueprint sets up auto-deploy, so every push rebuilds and redeploys automatically. No extra steps needed.
