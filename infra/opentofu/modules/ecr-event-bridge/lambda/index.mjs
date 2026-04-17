/**
 * GitHub Dispatcher Lambda
 * ADR-0017: Autonomous Maintenance Platform
 *
 * Receives EventBridge events (ECR push, Inspector findings)
 * and dispatches repository_dispatch events to GitHub.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const secretsClient = new SecretsManagerClient({});

let cachedToken = null;

async function getGitHubToken() {
  if (cachedToken) return cachedToken;

  const response = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: process.env.GITHUB_TOKEN_SECRET_ID,
    })
  );

  cachedToken = response.SecretString;
  return cachedToken;
}

export async function handler(event) {
  console.log("Event received:", JSON.stringify(event));

  const token = await getGitHubToken();
  const repo = process.env.GITHUB_REPO;

  const eventType = event.event_type || "ecr-image-updated";
  const clientPayload = {
    source: "eventbridge",
    timestamp: new Date().toISOString(),
    ...event,
  };

  const response = await fetch(
    `https://api.github.com/repos/${repo}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: clientPayload,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText} — ${body}`
    );
  }

  console.log(`Dispatched ${eventType} to ${repo}`);
  return { statusCode: 204, event_type: eventType };
}
