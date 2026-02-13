const { logger } = require("firebase-functions");

/**
 * Notify Slack when a new user signs up.
 *
 * Uses the v1 Auth onCreate trigger which fires on every
 * Firebase Auth signup event.
 */

const functions = require("firebase-functions");

/** Mask email for logging: "user@example.com" → "us***@example.com" */
function maskEmail(email) {
  if (!email) return "no email";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

exports.onNewUser = functions
  .runWith({ secrets: ["SLACK_WEBHOOK_URL"] })
  .auth.user()
  .onCreate(async (user) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.error("SLACK_WEBHOOK_URL secret not configured");
      return;
    }

    const createdAt = user.metadata.creationTime || new Date().toISOString();
    const maskedEmail = maskEmail(user.email);
    const shortUid = user.uid.slice(0, 8);

    const payload = JSON.stringify({
      text: [
        ":new: *New Perception user signup*",
        `*Email:* ${maskedEmail}`,
        `*UID:* \`${shortUid}...\``,
        `*Provider:* ${user.providerData?.[0]?.providerId || "email"}`,
        `*Time:* ${createdAt}`,
      ].join("\n"),
    });

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(`Slack webhook failed: ${response.status} ${body}`);
      throw new Error(`Slack webhook failed: ${response.status}`);
    }

    logger.info(`Slack notified for new user: ${maskedEmail}`);
  });
