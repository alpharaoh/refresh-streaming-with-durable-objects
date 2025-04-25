"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [streamText, setStreamText] = useState<string>("");
  const [websocketConnected, setWebsocketConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket("http://localhost:8787");

    socket.onmessage = (e) => {
      if (e.data === "clear_text") {
        setStreamText("");
      } else {
        setStreamText((prev) => prev + e.data);
      }
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

  const handleClick = () => {
    fetch("http://localhost:8787/prompt", { method: "POST" });
  };

  return (
    <div className="flex items-center justify-center h-dvh flex-col gap-5 p-5">
      <button
        className="cursor-pointer p-2 rounded-xl bg-stone-900 font-medium text-sm px-4"
        onClick={handleClick}
      >
        Stream poem
      </button>
      <div>
        {websocketConnected ? (
          <span className="text-green-500">✓ Connected</span>
        ) : (
          <span className="text-red-500">✗ Disconnected</span>
        )}
      </div>
      <pre className="flex items-center justify-center max-w-7xl whitespace-pre-wrap font-[inherit] max-h-10/12 overflow-y-auto border p-4 rounded-lg">
        {streamText}
      </pre>
    </div>
  );
}
