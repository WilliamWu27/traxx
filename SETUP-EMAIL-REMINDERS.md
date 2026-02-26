# TRAX Email Reminders — Setup Guide

## Prerequisites
- Firebase project on **Blaze plan** (pay-as-you-go) — Cloud Functions require this
- Firebase CLI installed: `npm install -g firebase-tools`
- A Gmail account (or other SMTP provider)

## Step 1: Prepare Gmail App Password

1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification** if not already on
3. Go to https://myaccount.google.com/apppasswords
4. Create an App Password for "Mail" → "Other" → name it "TRAX"
5. Copy the 16-character password (e.g. `abcd efgh ijkl mnop`)

## Step 2: Initialize Functions in Your Project

If you haven't already initialized functions in your Firebase project:

```bash
cd your-project-root
firebase init functions
```

Select:
- Language: **JavaScript**
- ESLint: No (or Yes if you want)
- Install dependencies: **Yes**

This creates a `functions/` directory. Replace the contents with the files provided.

## Step 3: Copy the Files

Copy these into your project's `functions/` directory:
- `functions/package.json`
- `functions/index.js`

Then install dependencies:
```bash
cd functions
npm install
```

## Step 4: Configure Email Credentials

```bash
firebase functions:config:set email.user="your-gmail@gmail.com" email.pass="your-app-password"
```

Replace with your actual Gmail and the App Password from Step 1.

## Step 5: Update the App URL

In `functions/index.js`, find all instances of:
```
https://your-app-url.vercel.app
```
And replace with your actual Vercel URL (e.g. `https://trax-app.vercel.app`).

## Step 6: Deploy

```bash
firebase deploy --only functions
```

This deploys 4 functions:
- **noonReminder** — Runs daily at 12:00 PM EST, emails users who haven't logged any habits
- **eveningReminder** — Runs daily at 6:00 PM EST, emails inactive users and streak-holders
- **weeklyWinner** — Runs Monday at 8:00 AM EST, emails all room members with the weekly results
- **unsubscribe** — HTTP endpoint for users to opt out of emails

## Step 7: Verify

Check that functions are deployed:
```bash
firebase functions:log
```

You can also test locally:
```bash
cd functions
firebase emulators:start --only functions
```

## How It Works

### Noon Reminder (12 PM)
- Checks which users have NOT logged any completions today
- Sends a midday nudge with their streak count
- Skipped for users who opted out (`emailReminders: false`)

### Evening Reminder (6 PM)
- **Inactive users**: Get an urgent "day's almost over" email
- **Partial users** (with streak ≥ 2): Get encouragement to keep going
- Users with no streak who already logged get no email (not annoying)

### Weekly Winner (Monday 8 AM)
- Calculates last week's total points per room
- Emails the winner with a celebration
- Emails losers with motivation to fight back
- Mentions stakes if applicable
- Skips tied results and solo rooms

### Unsubscribe
- Users can click the unsubscribe link in any email
- Sets `emailReminders: false` on their user doc
- They can re-enable in app settings (future feature)

## Cost

Firebase Cloud Functions on Blaze plan:
- **Free tier**: 2M invocations/month, 400K GB-seconds
- These 3 scheduled functions run ~90 times/month total
- Email sending: Free with Gmail (up to ~500/day)
- **Expected cost: $0/month** for a small user base

## Troubleshooting

**"Could not send email"**: Check your Gmail App Password is correct
```bash
firebase functions:config:get
```

**Functions not running on schedule**: Verify timezone is correct in the function
```bash
firebase functions:log --only noonReminder
```

**Users not receiving emails**: Check spam folder. Gmail may flag automated emails initially.

## Optional: Use SendGrid Instead

For production with many users, switch to SendGrid (free up to 100 emails/day):

```bash
firebase functions:config:set email.user="apikey" email.pass="SG.your-sendgrid-api-key" email.host="smtp.sendgrid.net" email.port="587"
```
