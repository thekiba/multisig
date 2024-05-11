import {client, endpoint} from "@/storages/ton-client";
import { Cell, loadMessage } from "@ton/core";
import {
  type BlockchainTransaction,
  Blockchain,
  wrapTonClient4ForRemote,
  RemoteBlockchainStorage,
} from "@ton/sandbox";
import { parseInternal } from "@truecarry/tlb-abi";
import { megaLibsCell } from "./megaLibs";

export type ParsedBlockchainTransaction = BlockchainTransaction & {
  parsed?: ReturnType<typeof parseInternal>;
};

export async function getEmulatedTxInfo(
  cell: Cell | undefined,
  ignoreChecksig: boolean = false,
  isTestnet: boolean = false,
): Promise<ParsedBlockchainTransaction[]> {
  const blockchain = await Blockchain.create({
    storage: new RemoteBlockchainStorage(
      wrapTonClient4ForRemote(client()),
    ),
  });
  // Better to fetch only needed libs, but for now we just add all known libs
  blockchain.libs = megaLibsCell;

  blockchain.verbosity = {
    blockchainLogs: true,
    vmLogs: "vm_logs_full",
    debugLogs: true,
    print: false,
  };

  const msg = loadMessage(cell.beginParse());
  const iter = await blockchain.sendMessageIter(msg, {
    ignoreChksig: ignoreChecksig,
  });

  const transactions: ParsedBlockchainTransaction[] = [];
  for await (const tx of iter) {
    transactions.push(tx);
  }

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (tx.inMessage.body) {
      try {
        const parsed = parseInternal(tx.inMessage.body.asSlice());
        transactions[i].parsed = parsed;
      } catch (e) {
        //
      }
    }
  }

  return transactions;
}
