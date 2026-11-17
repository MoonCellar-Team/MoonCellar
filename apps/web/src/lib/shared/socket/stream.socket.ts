import type { Socket } from "socket.io-client";
import {
  STREAM_SOCKET_NAMESPACE,
  type IStreamClientEvents,
  type IStreamServerEvents,
} from "@mooncellar/schemas";
import { getAccountManager } from "./account.socket";

export type IStreamSocket = Socket<IStreamServerEvents, IStreamClientEvents>;

export const getStreamSocket = async () => {
  const manager = await getAccountManager();
  return manager.socket(STREAM_SOCKET_NAMESPACE) as IStreamSocket;
};
