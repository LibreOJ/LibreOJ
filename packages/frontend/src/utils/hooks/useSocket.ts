import { useEffect } from "react";
import SocketIO, { Socket } from "socket.io-client";
import SocketIOParser from "socket.io-msgpack-parser";

export function useSocket(
  namespace: string,
  query: Record<string, string>,
  onInit: (socket: Socket) => void,
  onConnect: (socket: Socket) => void,
  useOrNot: boolean
): void {
  useEffect(() => {
    if (useOrNot) {
      const socket = SocketIO(window.apiEndpoint + namespace, {
        path: "/api/socket",
        transports: ["websocket"],
        query: query,
        ...{ parser: SocketIOParser }
      });
      socket.on("error", (error: Error) => console.log("SocketIO error:", error));
      socket.on("disconnect", reason => console.log("SocketIO disconnect:", reason));
      socket.io.on("reconnect", attempt => console.log("SocketIO reconnect:", attempt));
      socket.on("connect", () => onConnect(socket));
      onInit(socket);
      return () => {
        socket.disconnect();
      };
    }
  }, []);
}
