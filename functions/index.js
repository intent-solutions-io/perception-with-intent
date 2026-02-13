const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

const slackWebhookUrl = defineSecret("SLACK_WEBHOOK_URL");

/**
 * Notify Slack when a new user signs up.
 *
 * Firebase Auth triggers aren't available in v2 yet for all runtimes,
 * so we watch the /users/{userId} Firestore collection instead.
 * If no Firestore doc is created on signup, we fall back to an Auth
 * onCreate trigger (v1).
 */

// v1 Auth trigger — fires on every Firebase Auth signup
const functions = require("firebase-functions");
const https = require("https");

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
    const payload = JSON.stringify({
      text: [
        ":new: *New Perception user signup*",
        `*Email:* ${user.email || "no email"}`,
        `*UID:* \`${user.uid}\``,
        `*Provider:* ${user.providerData?.[0]?.providerId || "email"}`,
        `*Time:* ${createdAt}`,
      ].join("\n"),
    });

    return new Promise((resolve, reject) => {
      const url = new URL(webhookUrl);
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode === 200) {
              logger.info(`Slack notified for new user: ${user.email}`);
              resolve(data);
            } else {
              logger.error(`Slack webhook failed: ${res.statusCode} ${data}`);
              reject(new Error(`Slack webhook failed: ${res.statusCode}`));
            }
          });
        }
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  });
