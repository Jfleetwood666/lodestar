import {routes} from "@lodestar/api";
import {ApplicationMethods} from "@lodestar/api/server";
import {BeaconState} from "@lodestar/types";
import {getStateResponseWithRegen} from "../beacon/state/utils.js";
import {ApiModules} from "../types.js";
import {isOptimisticBlock} from "../../../util/forkChoice.js";
import {getStateSlotFromBytes} from "../../../util/multifork.js";

export function getDebugApi({
  chain,
  config,
}: Pick<ApiModules, "chain" | "config">): ApplicationMethods<routes.debug.Endpoints> {
  return {
    async getDebugChainHeadsV2() {
      const heads = chain.forkChoice.getHeads();
      return {
        data: heads.map((block) => ({
          slot: block.slot,
          root: block.blockRoot,
          executionOptimistic: isOptimisticBlock(block),
        })),
      };
    },

    async getProtoArrayNodes() {
      const nodes = chain.forkChoice.getAllNodes().map((node) => ({
        // if node has executionPayloadNumber, it will overwrite the below default
        executionPayloadNumber: 0,
        ...node,
        executionPayloadBlockHash: node.executionPayloadBlockHash ?? "",
        parent: String(node.parent),
        bestChild: String(node.bestChild),
        bestDescendant: String(node.bestDescendant),
      }));
      return {data: nodes};
    },

    async getStateV2({stateId}, context) {
      const {state, executionOptimistic, finalized} = await getStateResponseWithRegen(chain, stateId);
      let slot: number, data: Uint8Array | BeaconState;
      if (state instanceof Uint8Array) {
        slot = getStateSlotFromBytes(state);
        data = state;
      } else {
        slot = state.slot;
        data = context?.returnBytes ? state.serialize() : state.toValue();
      }
      return {
        data,
        meta: {
          version: config.getForkName(slot),
          executionOptimistic,
          finalized,
        },
      };
    },
  };
}
