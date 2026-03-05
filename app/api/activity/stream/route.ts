import { subscribeActivity } from "@/lib/activity-bus";
import { readActivityEvents } from "@/lib/activity-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeSseLine(line: string): Uint8Array {
  return new TextEncoder().encode(`${line}\n`);
}

function encodeSseEvent(payload: unknown, eventName = "message"): Uint8Array {
  return new TextEncoder().encode(
    `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`,
  );
}

export async function GET(request: Request) {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      const send = (payload: unknown, eventName = "message") => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encodeSseEvent(payload, eventName));
        } catch {
          close();
        }
      };

      const unsubscribe = subscribeActivity((event) => {
        send({ type: "activity", event }, "activity");
      });

      const heartbeat = setInterval(() => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encodeSseLine(":keepalive\n"));
        } catch {
          close();
        }
      }, 15000);

      request.signal.addEventListener("abort", close);

      send({ type: "ready", ts: new Date().toISOString() }, "ready");
      const snapshot = await readActivityEvents();
      send(
        { type: "snapshot", events: snapshot.slice(0, 40) },
        "snapshot",
      );
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

