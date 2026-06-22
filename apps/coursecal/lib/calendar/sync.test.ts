import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarOAuthClient } from "./client";
import { deleteEvent, insertEvent, patchEvent } from "./sync";

// Mock googleapis so the wrappers exercise their outcome mapping + backoff with no
// network client. google.calendar() returns these shared event-method spies; the
// vi.mock factory is hoisted above the imports, so ./sync sees the mock.
const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

// sync.ts is a server-only module; neutralize the import guard under vitest (node).
vi.mock("server-only", () => ({}));

vi.mock("googleapis", () => ({
  google: {
    calendar: () => ({
      events: { insert: mocks.insert, patch: mocks.patch, delete: mocks.del },
    }),
  },
}));

const auth = {} as unknown as CalendarOAuthClient;

// Shapes classifyError understands: a numeric `code`, or response.data.error as a
// string (OAuth token endpoint) / { errors: [{ reason }] } (Calendar API).
const httpError = (code: number) => ({ code });
const reasonError = (code: number, reason: string) => ({
  code,
  response: { data: { error: { errors: [{ reason }] } } },
});
const oauthError = (error: string) => ({ response: { data: { error } } });

beforeEach(() => {
  mocks.insert.mockReset();
  mocks.patch.mockReset();
  mocks.del.mockReset();
});

describe("insertEvent", () => {
  it("returns the new event id on success", async () => {
    mocks.insert.mockResolvedValue({ data: { id: "evt_1" } });
    await expect(insertEvent(auth, {})).resolves.toEqual({ kind: "ok", eventId: "evt_1" });
  });

  it("maps a 401 to reconnect (refresh already failed upstream)", async () => {
    mocks.insert.mockRejectedValue(httpError(401));
    await expect(insertEvent(auth, {})).resolves.toEqual({ kind: "reconnect" });
  });

  it("maps invalid_grant to reconnect", async () => {
    mocks.insert.mockRejectedValue(oauthError("invalid_grant"));
    await expect(insertEvent(auth, {})).resolves.toEqual({ kind: "reconnect" });
  });

  it("retries on 429 then succeeds", async () => {
    vi.useFakeTimers();
    mocks.insert
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValueOnce({ data: { id: "evt_2" } });
    const p = insertEvent(auth, {});
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ kind: "ok", eventId: "evt_2" });
    vi.useRealTimers();
  });
});

describe("patchEvent", () => {
  it("returns ok on success", async () => {
    mocks.patch.mockResolvedValue({ data: { id: "evt_1" } });
    await expect(patchEvent(auth, "evt_1", {})).resolves.toEqual({ kind: "ok" });
  });

  it("maps a 404 to notFound (event deleted in Google — offer recreate)", async () => {
    mocks.patch.mockRejectedValue(httpError(404));
    await expect(patchEvent(auth, "evt_1", {})).resolves.toEqual({ kind: "notFound" });
  });

  it("maps insufficientPermissions to reconnect", async () => {
    mocks.patch.mockRejectedValue(reasonError(403, "insufficientPermissions"));
    await expect(patchEvent(auth, "evt_1", {})).resolves.toEqual({ kind: "reconnect" });
  });

  it("fails on a non-retryable 400", async () => {
    mocks.patch.mockRejectedValue(httpError(400));
    await expect(patchEvent(auth, "evt_1", {})).resolves.toEqual({ kind: "failed" });
  });
});

describe("deleteEvent", () => {
  it("returns ok on success", async () => {
    mocks.del.mockResolvedValue({ status: 204 });
    await expect(deleteEvent(auth, "evt_1")).resolves.toEqual({ kind: "ok" });
  });

  it("treats a 404 as ok (already gone in Google)", async () => {
    mocks.del.mockRejectedValue(httpError(404));
    await expect(deleteEvent(auth, "evt_1")).resolves.toEqual({ kind: "ok" });
  });

  it("treats a 410 as ok (already gone in Google)", async () => {
    mocks.del.mockRejectedValue(httpError(410));
    await expect(deleteEvent(auth, "evt_1")).resolves.toEqual({ kind: "ok" });
  });

  it("maps insufficientPermissions to reconnect", async () => {
    mocks.del.mockRejectedValue(reasonError(403, "insufficientPermissions"));
    await expect(deleteEvent(auth, "evt_1")).resolves.toEqual({ kind: "reconnect" });
  });
});
