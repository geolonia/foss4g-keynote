import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectWithRetry } from "../lib/connectRetry";

// jitterはランダム要素ゆえテストでは0に固定し、backoff時間を決定的にする。
vi.mock("../lib/jitter", () => ({ randomJitterMs: () => 0 }));

type Handler = (...args: unknown[]) => void;

function fakeDb() {
  const handlers: Record<string, Handler[]> = {};
  return {
    on(event: string, cb: Handler) {
      (handlers[event] ??= []).push(cb);
    },
    off(event: string, cb: Handler) {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
    },
    emit(event: string, ...args: unknown[]) {
      (handlers[event] ?? []).forEach((h) => h(...args));
    },
    connect: vi.fn(() => Promise.resolve()),
    isConnected: vi.fn(() => false),
  };
}

describe("connectWithRetry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("attempts connect() immediately on setup", () => {
    const db = fakeDb();
    connectWithRetry(db as never);
    expect(db.connect).toHaveBeenCalledTimes(1);
  });

  it("retries with backoff on repeated 'error' events (429沈黙no-op対策)", async () => {
    const db = fakeDb();
    connectWithRetry(db as never, { maxAttempts: 4, baseDelayMs: 1000 });
    expect(db.connect).toHaveBeenCalledTimes(1);

    db.emit("error");
    await vi.advanceTimersByTimeAsync(1000);
    expect(db.connect).toHaveBeenCalledTimes(2);

    db.emit("error");
    await vi.advanceTimersByTimeAsync(2000);
    expect(db.connect).toHaveBeenCalledTimes(3);
  });

  it("stops retrying once 'connected' fires, even if a stray 'error' arrives afterward", async () => {
    const db = fakeDb();
    connectWithRetry(db as never, { maxAttempts: 4, baseDelayMs: 1000 });

    db.emit("connected");
    db.emit("error"); // 接続成功後の遅延errorは無視されねばならない(二重リトライ防止)
    await vi.advanceTimersByTimeAsync(10000);
    expect(db.connect).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts and calls onGiveUp exactly once (沈黙no-opにせず必ず通知)", async () => {
    const db = fakeDb();
    const onGiveUp = vi.fn();
    connectWithRetry(db as never, { maxAttempts: 3, baseDelayMs: 100, onGiveUp });
    expect(db.connect).toHaveBeenCalledTimes(1);

    db.emit("error");
    await vi.advanceTimersByTimeAsync(100);
    expect(db.connect).toHaveBeenCalledTimes(2);

    db.emit("error");
    await vi.advanceTimersByTimeAsync(200);
    expect(db.connect).toHaveBeenCalledTimes(3);

    db.emit("error");
    expect(onGiveUp).toHaveBeenCalledTimes(1);

    db.emit("error"); // 諦めた後の追加errorでonGiveUpが再発火してはならない
    await vi.advanceTimersByTimeAsync(10000);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(db.connect).toHaveBeenCalledTimes(3); // 追加のconnect()も発生しない
  });

  it("既に接続済みのdb(シングルトン共有時の2回目呼び出し)ではconnect()すら呼ばずリスナーも付けない", () => {
    const db = fakeDb();
    db.isConnected.mockReturnValue(true);
    const cleanup = connectWithRetry(db as never);
    expect(db.connect).not.toHaveBeenCalled();
    expect(() => cleanup()).not.toThrow(); // no-op cleanupが安全に呼べること
  });

  it("cleanup() unsubscribes so no further retries fire (コンポーネント破棄時の安全性)", async () => {
    const db = fakeDb();
    const onGiveUp = vi.fn();
    const cleanup = connectWithRetry(db as never, { maxAttempts: 3, baseDelayMs: 100, onGiveUp });
    cleanup();

    db.emit("error");
    await vi.advanceTimersByTimeAsync(10000);
    expect(db.connect).toHaveBeenCalledTimes(1); // cleanup後は初回のみ
    expect(onGiveUp).not.toHaveBeenCalled();
  });
});
