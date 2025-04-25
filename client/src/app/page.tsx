"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [streamText, setStreamText] = useState<string>("");

  useEffect(() => {
    const socket = new WebSocket("http://localhost:8787");

    socket.onmessage = (e) => {
      console.log("LLM chunk:", e.data);
      setStreamText((prev) => prev + e.data);
    };

    socket.onopen = () => {
      console.log("WebSocket connection established");
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div className="flex items-center justify-center h-dvh">{streamText}</div>
  );
}
