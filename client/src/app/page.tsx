"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [streamText, setStreamText] = useState<string>("");
  const [websocketConnected, setWebsocketConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket("http://localhost:8787");

    socket.onmessage = (e) => {
      console.log("LLM chunk:", e.data);
      setStreamText((prev) => prev + e.data);
    };

    socket.onopen = () => {
      console.log("WebSocket connection established");
      setWebsocketConnected(true);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
      setWebsocketConnected(false);
    };

    return () => {
      socket.close();
      setWebsocketConnected(false);
    };
  }, []);

  return (
    <div className="flex items-center justify-center h-dvh flex-col gap-10">
      <div>
        {websocketConnected ? (
          <span className="text-green-500">✓ Connected</span>
        ) : (
          <span className="text-red-500">✗ Disconnected</span>
        )}
      </div>
      <pre className="flex items-center justify-center max-w-6xl whitespace-pre-wrap font-[inherit]">
        {streamText}
      </pre>
    </div>
  );
}
