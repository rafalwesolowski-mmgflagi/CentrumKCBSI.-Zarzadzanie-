import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { refreshGoogleAccessToken } from "../_shared/google.ts";

const requestSchema = z.object({
  taskId: z.string().uuid(),
  sendEmailReminder: z.boolean().optional().default(true)
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401, req);

    const webhookUrl = (Deno.env.get("N8N_TASK_CALENDAR_WEBHOOK_URL") ?? "").trim();

    const parsedBody = await parseRequestBody(req);
    if (!parsedBody.ok) return jsonResponse({ error: parsedBody.error }, parsedBody.status, req);
    const body = parsedBody.data;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401, req);

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(`
        id,
        name,
        status,
        due_date,
        priority,
        impact,
        deadline_importance,
        risk_status,
        area,
        assignee,
        notes,
        recurrence,
        project:projects (
          id,
          name,
          color
        )
      `)
      .eq("id", body.taskId)
      .single();

    if (taskError) return jsonResponse({ error: taskError.message }, 404, req);

    const { data: googleIntegration } = await admin
      .from("google_user_integrations")
      .select("google_email, refresh_token")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const project = (Array.isArray(task.project) ? task.project[0] : task.project) ?? null;
    const workflow = googleIntegration ? "google-user-api" : "n8n-google-calendar";
    const pendingPayload = {
      taskId: body.taskId,
      workflow,
      requestedAt: new Date().toISOString()
    };
    const { data: notification, error: notificationError } = await supabase
      .from("task_calendar_notifications")
      .insert({
        user_id: userData.user.id,
        task_id: body.taskId,
        status: "pending",
        workflow,
        request_json: pendingPayload
      })
      .select("id")
      .single();

    if (notificationError) return jsonResponse({ error: notificationError.message }, 500, req);

    const payload = {
      eventType: "task.calendar_request",
      requestId: notification.id,
      sentAt: new Date().toISOString(),
      source: "ai-project-hub",
      user: {
        id: userData.user.id,
        email: userData.user.email
      },
      task: {
        id: task.id,
        name: task.name,
        status: task.status,
        dueDate: task.due_date,
        priority: task.priority,
        impact: task.impact,
        deadlineImportance: task.deadline_importance,
        riskStatus: task.risk_status,
        area: task.area,
        assignee: task.assignee,
        notes: task.notes,
        recurrence: task.recurrence
      },
      project: project
        ? {
          id: project.id,
          name: project.name,
          color: project.color
        }
        : null,
      calendar: {
        title: task.name,
        date: task.due_date,
        endDate: addOneDay(task.due_date),
        allDay: true,
        timezone: "Europe/Oslo",
        description: buildCalendarDescription(task, project)
      }
    };

    await supabase
      .from("task_calendar_notifications")
      .update({ request_json: payload })
      .eq("id", notification.id);

    if (googleIntegration) {
      let accessToken: string;
      try {
        accessToken = await refreshGoogleAccessToken(googleIntegration.refresh_token);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not refresh Google access token";
        if (isPermanentGoogleTokenError(message)) {
          await admin
            .from("google_user_integrations")
            .delete()
            .eq("user_id", userData.user.id);
        }
        await markNotificationFailed(supabase, notification.id, {
          status: "google_refresh_error",
          message
        }, message);
        return jsonResponse({
          error: "Could not refresh Google access token",
          details: message
        }, 401, req);
      }

      const googleResult = await sendWithGoogleUserApi({
        accessToken,
        payload,
        recipientEmail: googleIntegration.google_email ?? userData.user.email ?? null,
        sendEmailReminder: body.sendEmailReminder
      });

      if (!googleResult.ok) {
        await markNotificationFailed(supabase, notification.id, googleResult.details, googleResult.error);
        return jsonResponse({
          error: googleResult.error,
          details: googleResult.details
        }, googleResult.status, req);
      }

      await supabase
        .from("task_calendar_notifications")
        .update({
          status: "sent",
          response_json: googleResult.details,
          completed_at: new Date().toISOString()
        })
        .eq("id", notification.id);

      return jsonResponse({
        ok: true,
        workflow,
        notificationId: notification.id,
        requestId: notification.id,
        calendarEventId: textValue(googleResult.details.calendarEventId),
        htmlLink: textValue(googleResult.details.htmlLink),
        emailMessageId: textValue(googleResult.details.emailMessageId)
      }, 200, req);
    }

    if (!webhookUrl || !isHttpUrl(webhookUrl)) {
      const setupMessage = !webhookUrl
        ? "Missing N8N_TASK_CALENDAR_WEBHOOK_URL secret"
        : "N8N_TASK_CALENDAR_WEBHOOK_URL must be a valid http(s) URL";
      await markNotificationFailed(supabase, notification.id, {
        status: "configuration_error",
        message: setupMessage
      }, setupMessage);

      return jsonResponse({
        error: setupMessage,
        hint: "Ustaw secret Supabase Edge Function na produkcyjny URL webhooka n8n, a potem wdroz ponownie task-calendar-notify."
      }, 500, req);
    }

    let webhookResponse: Response;
    try {
      webhookResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not reach n8n webhook";
      await markNotificationFailed(supabase, notification.id, {
        status: "network_error",
        message
      }, message);

      return jsonResponse({
        error: "Could not reach n8n webhook",
        details: message
      }, 502, req);
    }

    const webhookResult = await readWebhookResponse(webhookResponse);
    if (!webhookResponse.ok) {
      await markNotificationFailed(
        supabase,
        notification.id,
        webhookResult,
        `n8n HTTP ${webhookResponse.status}`
      );

      return jsonResponse({
        error: "n8n workflow rejected the request",
        status: webhookResponse.status,
        details: webhookResult
      }, 502, req);
    }

    await supabase
      .from("task_calendar_notifications")
      .update({
        status: "sent",
        response_json: webhookResult,
        completed_at: new Date().toISOString()
      })
      .eq("id", notification.id);

    return jsonResponse({
      ok: true,
      workflow,
      notificationId: notification.id,
      requestId: notification.id,
      calendarEventId: textValue(webhookResult.calendarEventId),
      htmlLink: textValue(webhookResult.htmlLink)
    }, 200, req);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500, req);
  }
});

async function parseRequestBody(req: Request): Promise<
  | { ok: true; data: z.infer<typeof requestSchema> }
  | { ok: false; status: number; error: string }
> {
  let value: unknown;
  try {
    value = await req.json();
  } catch {
    return { ok: false, status: 400, error: "Request body must be valid JSON" };
  }

  const result = requestSchema.safeParse(value);
  if (!result.success) {
    return {
      ok: false,
      status: 400,
      error: result.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ")
    };
  }

  return { ok: true, data: result.data };
}

async function markNotificationFailed(
  supabase: ReturnType<typeof createClient>,
  notificationId: string,
  responseJson: Record<string, unknown>,
  errorMessage: string
) {
  await supabase
    .from("task_calendar_notifications")
    .update({
      status: "failed",
      response_json: responseJson,
      error_message: errorMessage,
      completed_at: new Date().toISOString()
    })
    .eq("id", notificationId);
}

async function sendWithGoogleUserApi({
  accessToken,
  payload,
  recipientEmail,
  sendEmailReminder
}: {
  accessToken: string;
  payload: {
    calendar: {
      title: string;
      date: string;
      endDate: string;
      description: string;
    };
    task: {
      name: string;
      dueDate: string;
      priority: string;
      impact: string;
      riskStatus: string;
    };
    project: { name: string } | null;
  };
  recipientEmail: string | null;
  sendEmailReminder: boolean;
}): Promise<
  | { ok: true; details: Record<string, unknown> }
  | { ok: false; status: number; error: string; details: Record<string, unknown> }
> {
  const eventResponse = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      summary: payload.calendar.title,
      description: payload.calendar.description,
      start: { date: payload.calendar.date },
      end: { date: payload.calendar.endDate },
      reminders: {
        useDefault: true
      }
    })
  });

  const eventResult = await readGoogleResponse(eventResponse);
  if (!eventResponse.ok) {
    return {
      ok: false,
      status: eventResponse.status === 401 || eventResponse.status === 403 ? 401 : 502,
      error: "Google Calendar rejected the request",
      details: eventResult
    };
  }

  const details: Record<string, unknown> = {
    calendarEventId: textValue(eventResult.id),
    htmlLink: textValue(eventResult.htmlLink),
    calendarResponse: eventResult
  };

  if (sendEmailReminder && recipientEmail) {
    const targetEmail = await readGoogleUserEmail(accessToken) ?? recipientEmail;
    const emailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        raw: base64UrlEncode(buildReminderEmail({
          to: targetEmail,
          subject: `Przypomnienie: ${payload.task.name}`,
          payload
        }))
      })
    });

    const emailResult = await readGoogleResponse(emailResponse);
    details.emailResponse = emailResult;

    if (!emailResponse.ok) {
      details.emailError = {
        status: emailResponse.status,
        message: "Gmail rejected the reminder email"
      };
      return { ok: true, details };
    }

    details.emailMessageId = textValue(emailResult.id);
  }

  return { ok: true, details };
}

function buildReminderEmail({
  to,
  subject,
  payload
}: {
  to: string;
  subject: string;
  payload: {
    calendar: { description: string };
    task: {
      name: string;
      dueDate: string;
      priority: string;
      impact: string;
      riskStatus: string;
    };
    project: { name: string } | null;
  };
}) {
  const lines = [
    `From: ${to}`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    `Zadanie: ${payload.task.name}`,
    payload.project ? `Projekt: ${payload.project.name}` : null,
    `Termin: ${payload.task.dueDate}`,
    `Priorytet: ${payload.task.priority}`,
    `Wpływ: ${payload.task.impact}`,
    `Ryzyko: ${payload.task.riskStatus}`,
    "",
    payload.calendar.description
  ].filter((line) => line !== null);

  return lines.join("\r\n");
}

function buildCalendarDescription(
  task: {
    priority: string;
    impact: string;
    risk_status: string;
    area: string | null;
    assignee: string | null;
    notes: string | null;
  },
  project: { name: string } | null
) {
  return [
    project ? `Projekt: ${project.name}` : null,
    task.area ? `Obszar: ${task.area}` : null,
    task.assignee ? `Wykonawca: ${task.assignee}` : null,
    `Priorytet: ${task.priority}`,
    `Wpływ: ${task.impact}`,
    `Ryzyko: ${task.risk_status}`,
    task.notes ? `Notatka: ${task.notes}` : null
  ].filter(Boolean).join("\n");
}

function addOneDay(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isPermanentGoogleTokenError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid_grant") ||
    normalized.includes("token has been expired or revoked") ||
    normalized.includes("bad request")
  );
}

async function readWebhookResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return { parseError: "Could not parse JSON response" };
    }
  }

  const text = await response.text();
  return { text: text.slice(0, 1000) };
}

async function readGoogleResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const value = await response.json();
      return isRecord(value) ? value : { value };
    } catch {
      return { parseError: "Could not parse JSON response" };
    }
  }

  const text = await response.text();
  return { text: text.slice(0, 1000) };
}

async function readGoogleUserEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });
  if (!response.ok) return null;
  const profile = await readGoogleResponse(response);
  return textValue(profile.email);
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeMimeHeader(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
