export const DEFAULT_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "http://python-address-book-fargate-alb-2037795374.us-east-2.elb.amazonaws.com";

function trimSlash(value) {
  return value.replace(/\/+$/, "");
}

async function request(apiBaseUrl, path, options = {}) {
  const response = await fetch(`${trimSlash(apiBaseUrl)}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(body?.error || body?.message || `Request failed: ${response.status}`);
  }

  return body;
}

export function listContacts(apiBaseUrl, filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  });

  const query = params.toString();
  return request(apiBaseUrl, `/api/contacts${query ? `?${query}` : ""}`);
}

export function createContact(apiBaseUrl, contact) {
  return request(apiBaseUrl, "/api/contacts", {
    method: "POST",
    body: JSON.stringify(contact)
  });
}

export function updateContact(apiBaseUrl, id, contact) {
  return request(apiBaseUrl, `/api/contacts/${id}`, {
    method: "PUT",
    body: JSON.stringify(contact)
  });
}

export function deleteContact(apiBaseUrl, id) {
  return request(apiBaseUrl, `/api/contacts/${id}`, {
    method: "DELETE"
  });
}

export function checkReady(apiBaseUrl) {
  return request(apiBaseUrl, "/ready");
}
