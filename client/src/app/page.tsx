"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    const socket = new WebSocket("http://localhost:8787");

    socket.onmessage = (e) => {
      console.log("LLM chunk:", e.data);
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
    <div className="flex items-center justify-center h-dvh">Hello World</div>
  );
}
