import { ipcMain } from "electron";
import { z } from "zod";

// const IPC_CHANNELS = {
//     "db:migrateFromJSON": {
//         request: z.object({
//             historyData: z.array(
//                 z.object({
//                     id: z.number(),
//                     itemId: z.number(),
//                     type: z.string(),
//                     lastRead: z.number(),
//                     chaptersRead: z.array(z.string()),
//                 })
//             ),
//             bookmarkData: z.array(
//                 z.object({
//                     id: z.number(),
//                     itemId: z.number(),
//                     type: z.string(),
//                     name: z.string(),
//                     lastRead: z.number(),
//                     chaptersRead: z.array(z.string()),
//                 })
//             ),
//         }),
//         response: z.undefined(),
//     },
// };

// export type IpcChannels = typeof IPC_CHANNELS;
// export type IpcChannelsNames = keyof IpcChannels;

// export type IpcRequestSchema<T extends IpcChannelsNames> = IpcChannels[T]["request"];
// export type IpcResponseSchema<T extends IpcChannelsNames> = IpcChannels[T]["response"];

// type Handler<Req, Res> = (event: Electron.IpcMainInvokeEvent, request: Req) => Res | Promise<Res>;

// export const registerHandler = <T extends IpcChannelsNames>(
//     channel: T,
//     handler: Handler<z.infer<IpcRequestSchema<T>>, z.infer<IpcResponseSchema<T>>>
// ) => {
//     const { request: requestSchema, response: responseSchema } = IPC_CHANNELS[channel];
//     ipcMain.handle(channel, async (event, rawRequest) => {
//         try {
//             const request = requestSchema.parse(rawRequest);
//             const response = await handler(event, request);
//             if (responseSchema) {
//                 return responseSchema.parse(response);
//             }
//         } catch (error) {
//             console.error(`Error in IPC channel "${channel}":`, error);
//             throw error;
//         }
//     });
// };

// export default IPC_CHANNELS;
