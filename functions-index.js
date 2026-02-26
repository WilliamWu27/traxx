const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────
// CONFIGURE YOUR EMAIL PROVIDER
// ─────────────────────────────────────────────
// Option 1: Gmail (easiest for testing)
//   - Enable 2FA on your Google account
//   - Generate an App Password: https://myaccount.google.com/apppasswords
//   - Set config with:
//     firebase functions:config:set email.user="your@gmail.com" email.pass="your-app-password"
//
// Option 2: Any SMTP provider (SendGrid, Mailgun, etc.)
//   - Set config with:
//     firebase functions:config:set email.user="apikey" email.pass="your-api-key" email.host="smtp.sendgrid.net"
//
// After setting config, deploy with: firebase deploy --only functions
// ─────────────────────────────────────────────

function getTransporter() {
  const config = functions.config().email || {};
  const host = config.host || "smtp.gmail.com";
  const port = config.port ? parseInt(config.port) : 587;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

// ─────────────────────────────────────────────
// GET USERS WHO HAVEN'T LOGGED TODAY
// ─────────────────────────────────────────────
async function getInactiveUsers() {
  const today = getToday();

  // Get all users
  const usersSnap = await db.collection("users").get();
  const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Get today's completions
  const completionsSnap = await db
    .collection("completions")
    .where("date", "==", today)
    .get();

  // Set of user IDs who have logged something today
  const activeUserIds = new Set(
    completionsSnap.docs.map((d) => d.data().userId)
  );

  // Filter to users who haven't logged AND have email AND haven't opted out
  return users.filter(
    (u) =>
      !activeUserIds.has(u.id) &&
      u.email &&
      u.emailReminders !== false // respect opt-out
  );
}

// ─────────────────────────────────────────────
// GET USERS WHO HAVE LOGGED BUT AREN'T DONE
// ─────────────────────────────────────────────
async function getPartialUsers() {
  const today = getToday();

  const usersSnap = await db.collection("users").get();
  const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const completionsSnap = await db
    .collection("completions")
    .where("date", "==", today)
    .get();

  const activeUserIds = new Set(
    completionsSnap.docs.map((d) => d.data().userId)
  );

  // Users who HAVE logged today (partially active)
  return users.filter(
    (u) =>
      activeUserIds.has(u.id) &&
      u.email &&
      u.emailReminders !== false
  );
}

// ─────────────────────────────────────────────
// CALCULATE STREAK FOR A USER
// ─────────────────────────────────────────────
async function getUserStreak(userId) {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - 30);
  const dateStr = daysAgo.toISOString().split("T")[0];

  const snap = await db
    .collection("completions")
    .where("userId", "==", userId)
    .where("date", ">=", dateStr)
    .get();

  const dates = [...new Set(snap.docs.map((d) => d.data().date))]
    .sort()
    .reverse();

  const today = getToday();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split("T")[0];

  let streak = 0;
  if (dates.includes(today) || dates.includes(yStr)) {
    let check = dates.includes(today) ? new Date() : yesterday;
    while (dates.includes(check.toISOString().split("T")[0])) {
      streak++;
      check.setDate(check.getDate() - 1);
    }
  }
  return streak;
}

// ─────────────────────────────────────────────
// EMAIL TEMPLATES
// ─────────────────────────────────────────────
function buildNoonEmail(user, streak) {
  const streakText =
    streak > 0
      ? `You're on a ${streak}-day streak! Don't let it break.`
      : "Start a new streak today!";

  return {
    subject: "🎯 TRAX — Midday check-in",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#ffffff;font-size:28px;font-weight:900;letter-spacing:0.3em;margin:0;">TRAX</h1>
      <div style="display:flex;justify-content:center;gap:8px;margin-top:12px;">
        <span style="width:24px;height:3px;background:#3b82f6;border-radius:2px;display:inline-block;"></span>
        <span style="width:24px;height:3px;background:#f97316;border-radius:2px;display:inline-block;"></span>
        <span style="width:24px;height:3px;background:#10b981;border-radius:2px;display:inline-block;"></span>
      </div>
    </div>
    
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;margin-bottom:24px;">
      <h2 style="color:#ffffff;font-size:18px;margin:0 0 8px;">Hey ${user.username} 👋</h2>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 16px;line-height:1.5;">
        It's midday and you haven't logged any habits yet. Half the day is still ahead — make it count!
      </p>
      <div style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.2);border-radius:12px;padding:16px;text-align:center;">
        <span style="font-size:24px;">🔥</span>
        <p style="color:#fb923c;font-size:14px;font-weight:700;margin:8px 0 0;">${streakText}</p>
      </div>
    </div>
    
    <div style="text-align:center;">
      <a href="https://your-app-url.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 32px;border-radius:12px;">
        Open TRAX →
      </a>
    </div>
    
    <p style="color:#4b5563;font-size:11px;text-align:center;margin-top:32px;">
      <a href="https://your-app-url.vercel.app" style="color:#6b7280;text-decoration:underline;">Unsubscribe from reminders</a>
    </p>
  </div>
</body>
</html>`,
  };
}

function buildEveningEmail(user, streak, isPartial) {
  const streakText =
    streak > 0
      ? `${streak}-day streak on the line!`
      : "Today could be day 1.";

  const message = isPartial
    ? "You've started logging today — nice! But there's still time to max out more habits before midnight."
    : "The day is almost over and you haven't logged any habits. There's still time!";

  return {
    subject: streak > 0 ? `🔥 TRAX — ${streak}-day streak at risk!` : "⏰ TRAX — Day's almost over!",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#ffffff;font-size:28px;font-weight:900;letter-spacing:0.3em;margin:0;">TRAX</h1>
      <div style="display:flex;justify-content:center;gap:8px;margin-top:12px;">
        <span style="width:24px;height:3px;background:#3b82f6;border-radius:2px;display:inline-block;"></span>
        <span style="width:24px;height:3px;background:#f97316;border-radius:2px;display:inline-block;"></span>
        <span style="width:24px;height:3px;background:#10b981;border-radius:2px;display:inline-block;"></span>
      </div>
    </div>
    
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;margin-bottom:24px;">
      <h2 style="color:#ffffff;font-size:18px;margin:0 0 8px;">${streak > 0 ? "Don't break it! ⚡" : "Last chance today ⏰"}</h2>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 16px;line-height:1.5;">
        ${message}
      </p>
      ${streak > 0 ? `
      <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px;text-align:center;">
        <span style="font-size:24px;">🔥</span>
        <p style="color:#f87171;font-size:14px;font-weight:700;margin:8px 0 0;">${streakText}</p>
      </div>
      ` : `
      <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:16px;text-align:center;">
        <span style="font-size:24px;">✨</span>
        <p style="color:#34d399;font-size:14px;font-weight:700;margin:8px 0 0;">Even one habit keeps the momentum going.</p>
      </div>
      `}
    </div>
    
    <div style="text-align:center;">
      <a href="https://your-app-url.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#ef4444,#ec4899);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 32px;border-radius:12px;">
        Log Habits Now →
      </a>
    </div>
    
    <p style="color:#4b5563;font-size:11px;text-align:center;margin-top:32px;">
      <a href="https://your-app-url.vercel.app" style="color:#6b7280;text-decoration:underline;">Unsubscribe from reminders</a>
    </p>
  </div>
</body>
</html>`,
  };
}

// ─────────────────────────────────────────────
// WEEKLY WINNER EMAIL (sent Monday morning)
// ─────────────────────────────────────────────
function buildWeeklyWinnerEmail(user, winnerName, isWinner, points) {
  return {
    subject: isWinner ? "🏆 TRAX — You won this week!" : `🏆 TRAX — ${winnerName} won this week!`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#ffffff;font-size:28px;font-weight:900;letter-spacing:0.3em;margin:0;">TRAX</h1>
    </div>
    
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <span style="font-size:48px;">🏆</span>
      <h2 style="color:#ffffff;font-size:22px;margin:16px 0 8px;">
        ${isWinner ? "You're the champion!" : `${winnerName} won this week`}
      </h2>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 16px;line-height:1.5;">
        ${isWinner 
          ? `You dominated with ${points} points. Time to collect on those stakes!` 
          : `They scored ${points} points. New week starts now — time to fight back!`}
      </p>
      <div style="background:${isWinner ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)'};border:1px solid ${isWinner ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)'};border-radius:12px;padding:16px;">
        <p style="color:${isWinner ? '#fbbf24' : '#60a5fa'};font-size:14px;font-weight:700;margin:0;">
          ${isWinner ? "Collect your stakes! 💰" : "New week, new chance. Let's go! 🚀"}
        </p>
      </div>
    </div>
    
    <div style="text-align:center;">
      <a href="https://your-app-url.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#f97316);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 32px;border-radius:12px;">
        Open TRAX →
      </a>
    </div>
  </div>
</body>
</html>`,
  };
}

// ─────────────────────────────────────────────
// SCHEDULED FUNCTION: NOON REMINDER (12 PM EST)
// Runs daily, emails users who haven't logged yet
// ─────────────────────────────────────────────
exports.noonReminder = functions.pubsub
  .schedule("0 12 * * *")
  .timeZone("America/New_York")
  .onRun(async () => {
    try {
      const transporter = getTransporter();
      const config = functions.config().email || {};
      const inactiveUsers = await getInactiveUsers();

      console.log(`Noon reminder: ${inactiveUsers.length} inactive users`);

      for (const user of inactiveUsers) {
        try {
          const streak = await getUserStreak(user.id);
          const { subject, html } = buildNoonEmail(user, streak);

          await transporter.sendMail({
            from: `"TRAX" <${config.user}>`,
            to: user.email,
            subject,
            html,
          });

          console.log(`Sent noon reminder to ${user.email}`);
        } catch (err) {
          console.error(`Failed to email ${user.email}:`, err.message);
        }
      }

      return null;
    } catch (err) {
      console.error("Noon reminder error:", err);
      return null;
    }
  });

// ─────────────────────────────────────────────
// SCHEDULED FUNCTION: EVENING REMINDER (6 PM EST)
// Emails ALL users - inactive get urgency, partial get encouragement
// ─────────────────────────────────────────────
exports.eveningReminder = functions.pubsub
  .schedule("0 18 * * *")
  .timeZone("America/New_York")
  .onRun(async () => {
    try {
      const transporter = getTransporter();
      const config = functions.config().email || {};

      const inactiveUsers = await getInactiveUsers();
      const partialUsers = await getPartialUsers();

      console.log(`Evening reminder: ${inactiveUsers.length} inactive, ${partialUsers.length} partial`);

      // Send to inactive users (haven't logged at all)
      for (const user of inactiveUsers) {
        try {
          const streak = await getUserStreak(user.id);
          const { subject, html } = buildEveningEmail(user, streak, false);
          await transporter.sendMail({ from: `"TRAX" <${config.user}>`, to: user.email, subject, html });
          console.log(`Sent evening reminder (inactive) to ${user.email}`);
        } catch (err) {
          console.error(`Failed: ${user.email}:`, err.message);
        }
      }

      // Send to partial users (logged some but could do more)
      for (const user of partialUsers) {
        try {
          const streak = await getUserStreak(user.id);
          // Only send if they have a streak worth protecting
          if (streak >= 2) {
            const { subject, html } = buildEveningEmail(user, streak, true);
            await transporter.sendMail({ from: `"TRAX" <${config.user}>`, to: user.email, subject, html });
            console.log(`Sent evening reminder (partial) to ${user.email}`);
          }
        } catch (err) {
          console.error(`Failed: ${user.email}:`, err.message);
        }
      }

      return null;
    } catch (err) {
      console.error("Evening reminder error:", err);
      return null;
    }
  });

// ─────────────────────────────────────────────
// SCHEDULED FUNCTION: WEEKLY WINNER (Monday 8 AM EST)
// Calculates last week's winner and emails everyone
// ─────────────────────────────────────────────
exports.weeklyWinner = functions.pubsub
  .schedule("0 8 * * 1")
  .timeZone("America/New_York")
  .onRun(async () => {
    try {
      const transporter = getTransporter();
      const config = functions.config().email || {};

      // Calculate last week's date range (Mon-Sun)
      const now = new Date();
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - 7);
      const day = lastMonday.getDay();
      lastMonday.setDate(lastMonday.getDate() - day + (day === 0 ? -6 : 1));
      const lastMondayStr = lastMonday.toISOString().split("T")[0];

      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      const lastSundayStr = lastSunday.toISOString().split("T")[0];

      // Get all rooms
      const roomsSnap = await db.collection("rooms").get();

      for (const roomDoc of roomsSnap.docs) {
        const roomId = roomDoc.id;

        // Get members of this room
        const membersSnap = await db
          .collection("users")
          .where("rooms", "array-contains", roomId)
          .get();
        const members = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (members.length < 2) continue; // skip solo rooms

        // Get last week's completions for this room
        const compSnap = await db
          .collection("completions")
          .where("roomId", "==", roomId)
          .where("date", ">=", lastMondayStr)
          .where("date", "<=", lastSundayStr)
          .get();

        // Get habits for point calculation
        const habitsSnap = await db
          .collection("habits")
          .where("roomId", "==", roomId)
          .get();
        const habits = habitsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Calculate scores
        const scores = members
          .map((m) => {
            const pts = compSnap.docs
              .filter((d) => d.data().userId === m.id)
              .reduce((sum, d) => {
                const data = d.data();
                const h = habits.find((x) => x.id === data.habitId);
                return sum + ((h?.points || data.habitPoints || 0) * (data.count || 1));
              }, 0);
            return { member: m, pts };
          })
          .sort((a, b) => b.pts - a.pts);

        if (scores.length === 0 || scores[0].pts === 0) continue;

        const winner = scores[0];
        const isTied = scores.length > 1 && scores[0].pts === scores[1].pts;
        if (isTied) continue; // no winner if tied

        // Email all members
        for (const { member } of scores) {
          if (!member.email || member.emailReminders === false) continue;
          try {
            const isWinner = member.id === winner.member.id;
            const { subject, html } = buildWeeklyWinnerEmail(
              member,
              winner.member.username,
              isWinner,
              winner.pts
            );
            await transporter.sendMail({ from: `"TRAX" <${config.user}>`, to: member.email, subject, html });
            console.log(`Sent weekly winner email to ${member.email}`);
          } catch (err) {
            console.error(`Failed: ${member.email}:`, err.message);
          }
        }
      }

      return null;
    } catch (err) {
      console.error("Weekly winner error:", err);
      return null;
    }
  });

// ─────────────────────────────────────────────
// OPT-OUT ENDPOINT
// Users can disable email reminders
// ─────────────────────────────────────────────
exports.unsubscribe = functions.https.onRequest(async (req, res) => {
  const userId = req.query.uid;
  if (!userId) {
    res.status(400).send("Missing user ID");
    return;
  }
  try {
    await db.collection("users").doc(userId).update({ emailReminders: false });
    res.send(`
      <html><body style="background:#0a0a0f;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
        <div style="text-align:center;color:white;">
          <h1 style="letter-spacing:0.3em;">TRAX</h1>
          <p style="color:#9ca3af;">You've been unsubscribed from email reminders.</p>
          <p style="color:#6b7280;font-size:12px;">You can re-enable them in the app settings.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send("Error unsubscribing");
  }
});
