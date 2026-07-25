export interface RenderedNotification {
  subject: string;
  html: string;
  sms: string;
}

type TemplateFn = (
  message: string,
  metadata?: Record<string, unknown>,
) => RenderedNotification;

const defaultTemplate: TemplateFn = (message) => ({
  subject: 'PayrollFiti Notification',
  html: `<p>${message}</p>`,
  sms: message,
});

/**
 * One entry per `type` string used with NotificationsService.dispatch(...) /
 * dispatchForRoles(...). Only gives each notification type a proper email
 * subject line — the human-readable `message` built by the caller is reused
 * as-is for the body, so adding a new type here is optional (it falls back
 * to `defaultTemplate` and still delivers correctly).
 */
const templates: Record<string, TemplateFn> = {
  PAYROLL_RUN_COMPLETED: (message) => ({
    subject: 'Payroll run completed',
    html: `<p>${message}</p>`,
    sms: message,
  }),
  PAYROLL_DUE: (message) => ({
    subject: 'Payroll is due',
    html: `<p>${message}</p>`,
    sms: message,
  }),
  LEAVE_REQUEST_PENDING: (message) => ({
    subject: 'Leave request awaiting approval',
    html: `<p>${message}</p>`,
    sms: message,
  }),
  LEAVE_REQUEST_DECIDED: (message) => ({
    subject: 'Your leave request has been decided',
    html: `<p>${message}</p>`,
    sms: message,
  }),
};

export function renderNotificationTemplate(
  type: string,
  message: string,
  metadata?: Record<string, unknown>,
): RenderedNotification {
  const template = templates[type] ?? defaultTemplate;
  return template(message, metadata);
}
