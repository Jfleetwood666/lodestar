import {COMPOUNDING_WITHDRAWAL_PREFIX, FAR_FUTURE_EPOCH, MIN_ACTIVATION_BALANCE} from "@lodestar/params";
import {ValidatorIndex, ssz} from "@lodestar/types";
import {CachedBeaconStateElectra} from "../types.js";
import {hasEth1WithdrawalCredential} from "./capella.js";

export function hasCompoundingWithdrawalCredential(withdrawalCredentials: Uint8Array): boolean {
  return withdrawalCredentials[0] === COMPOUNDING_WITHDRAWAL_PREFIX;
}

export function hasExecutionWithdrawalCredential(withdrawalCredentials: Uint8Array): boolean {
  return (
    hasCompoundingWithdrawalCredential(withdrawalCredentials) || hasEth1WithdrawalCredential(withdrawalCredentials)
  );
}

export function switchToCompoundingValidator(state: CachedBeaconStateElectra, index: ValidatorIndex): void {
  const validator = state.validators.get(index);

  if (hasEth1WithdrawalCredential(validator.withdrawalCredentials)) {
    // directly modifying the byte leads to ssz missing the modification resulting into
    // wrong root compute, although slicing can be avoided but anyway this is not going
    // to be a hot path so its better to clean slice and avoid side effects
    const newWithdrawalCredentials = validator.withdrawalCredentials.slice();
    newWithdrawalCredentials[0] = COMPOUNDING_WITHDRAWAL_PREFIX;
    validator.withdrawalCredentials = newWithdrawalCredentials;
    queueExcessActiveBalance(state, index);
  }
}

export function queueExcessActiveBalance(state: CachedBeaconStateElectra, index: ValidatorIndex): void {
  const balance = state.balances.get(index);
  if (balance > MIN_ACTIVATION_BALANCE) {
    const excessBalance = balance - MIN_ACTIVATION_BALANCE;
    state.balances.set(index, MIN_ACTIVATION_BALANCE);

    const pendingBalanceDeposit = ssz.electra.PendingBalanceDeposit.toViewDU({
      index,
      amount: BigInt(excessBalance),
    });
    state.pendingBalanceDeposits.push(pendingBalanceDeposit);
  }
}

export function queueEntireBalanceAndResetValidator(state: CachedBeaconStateElectra, index: ValidatorIndex): void {
  const balance = state.balances.get(index);
  state.balances.set(index, 0);

  const validator = state.validators.get(index);
  validator.effectiveBalance = 0;
  state.epochCtx.effectiveBalanceIncrementsSet(index, 0);
  validator.activationEligibilityEpoch = FAR_FUTURE_EPOCH;

  const pendingBalanceDeposit = ssz.electra.PendingBalanceDeposit.toViewDU({
    index,
    amount: BigInt(balance),
  });
  state.pendingBalanceDeposits.push(pendingBalanceDeposit);
}
