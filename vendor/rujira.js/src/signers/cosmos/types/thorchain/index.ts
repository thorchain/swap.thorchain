import { GeneratedType } from "../../proto-signing";
import { MsgDeposit } from "./types/msg_deposit";
export { createThorchainAminoConverters } from "./types/aminomessages";

export const thorchainTypes: ReadonlyArray<[string, GeneratedType]> = [
  ["/types.MsgDeposit", MsgDeposit],
];
