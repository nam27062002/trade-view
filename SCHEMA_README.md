# Live Demo & Simulation Unified Trading Logic

This document summarizes the unified architecture between simulation (`analyst/simulation/simulate_nomd5.py`) and live demo (`live_demo/run_live_demo.py`).

## Core Components

- **TradingProcessor**: single source of truth for:
  - Loading strategy/metrics
  - Making betting decisions (`make_betting_decision`)
  - Settlement (`process_settlement`) applying balanced pot + refund logic
  - Tracking balance & stats
- **DecisionEngine** (live only wrapper):
  - Collects streaming snapshots per session
  - Calls TradingProcessor for decision/settlement
  - Persists bet history + balance to Firebase

## Countdown Normalization

All decisions & settlement rely on countdown defined as: `countdown = 5 + (n - 1 - idx)` so the last snapshot of a session has countdown=5. Simulation builds snapshots eagerly; live stream normalizes at session completion before settlement.

## Realtime Database Schema

```jsonc
/live_demo_balance {
  balance: <int>,
  stats: { wins, losses, refunds, total_bet_sessions, last_result },
  mode: "simulation" | "real",
  updated_at: "ISO timestamp"
}

/live_demo/balance_logs/{push_key} {
  balance: <int>,
  performance: { /* cumulative stats snapshot */ },
  ts: <epoch_or_iso>
}

/live_demo_bet_history/YYYYMMDD/{session_id}/{push_key} {
  session_id: "string",
  decision_time: "ISO",
  settlement_time: "ISO",
  strategy: "string",
  timepoint: <int|null>,
  bet_side: "Tai" | "Xiu",
  bet_idx: <int>,
  bet_countdown: <int>,
  stake: <int>,
  same_side_total_at_bet: <int>,
  opposite_side_total_at_bet: <int>,
  final_tai_total: <int>,
  final_xiu_total: <int>,
  final_total_min: <int>,
  final_pot_size: <int>,
  outcome: "Tai" | "Xiu",
  result_status: "win" | "lose" | "full_refund" | "partial_refund_win" | "partial_refund_lose",
  pnl: <int>,
  refunded_amount: <int>,
  effective_bet_amount: <int>,
  balance_after_settlement: <int>,
  stats_after: { wins, losses, refunds, total_bet_sessions, last_result },
  mode: "simulation" | "real" | undefined
}
```

## Frontend Fallback Logic

1. Primary balance series: `/live_demo/balance_logs` (ordered by ts)
2. If empty but bet history present: synthesize series from cumulative trade `pnl` or recorded `balance_after_settlement`.
3. If no logs and no trades: single snapshot fallback from `/live_demo_balance` (implemented in `dashboard.js`).

## Strategy Overrides

- Simulation: CLI flags `--strategy` & `--timepoint` call `TradingProcessor.update_strategy`.
- Live: runtime method `LiveDataHandler.set_strategy()` delegates to DecisionEngine → TradingProcessor.

## Extensibility

1. Implement logic inside shared strategy config & decision routine.
2. Ensure `TradingProcessor.trading_strategy` loads updated metrics or config.
3. No changes needed in simulation or live orchestrators (they already delegate).

## Testing Ideas

- Feed synthetic snapshots to TradingProcessor for win / lose / full_refund / partial_refund cases.
- Replay a recorded session JSON through simulation then stream snapshots sequentially to mimic live; assert identical decision & pnl.

---
Generated automatically to reflect current unified design. Keep this updated as schema or logic evolves.
# Live Demo & Simulation Unified Trading Logic

This document summarizes the unified architecture between simulation (`analyst/simulation/simulate_nomd5.py`) and live demo (`live_demo/run_live_demo.py`).

## Core Components
- TradingProcessor: Single source of truth for
  - Loading strategy/metrics
  - Making betting decisions (`make_betting_decision`)
  - Settlement (`process_settlement`) applying balanced pot + refund logic
  - Tracking balance & stats
- DecisionEngine (live only wrapper):
  - Collects streaming snapshots per session
  - Calls TradingProcessor for decision/settlement
  - Persists bet history + balance to Firebase

## Countdown Normalization
All decisions & settlement rely on countdown defined as: `countdown = 5 + (n - 1 - idx)` so the last snapshot of a session has countdown=5.
Simulation builds snapshots eagerly; live stream normalizes at session completion before settlement.

## Realtime Database Schema
```
/live_demo_balance {
  balance: <int>,
  stats: { wins, losses, refunds, total_bet_sessions, last_result },
  mode: "simulation" | "real",
  updated_at: ISO timestamp
}

/live_demo/balance_logs/{push_key} {
  balance: <int>,
  performance: {...},
  ts: epoch_or_iso
}

/live_demo_bet_history/YYYYMMDD/{session_id}/{push_key} {
  session_id,
  decision_time,
  settlement_time,
  strategy,
  timepoint,
  bet_side,
  bet_idx,
  bet_countdown,
  stake,
  same_side_total_at_bet,
  opposite_side_total_at_bet,
  final_tai_total,
  final_xiu_total,
  final_total_min,
  final_pot_size,
  outcome,
  result_status,
  pnl,
  refunded_amount,
  effective_bet_amount,
  balance_after_settlement,
  stats_after: { wins, losses, refunds, total_bet_sessions, last_result },
  mode (optional)
}
```

## Frontend Fallback Logic
1. Primary balance series: `/live_demo/balance_logs` (ordered by ts)
2. If empty but bet history present: synthesize series from cumulative trade `pnl` or recorded `balance_after_settlement`.
3. If no logs and no trades: single snapshot fallback from `/live_demo_balance` (implemented in `dashboard.js`).

## Strategy Overrides
- Simulation: `--strategy` and `--timepoint` flags call `TradingProcessor.update_strategy`.
- Live: runtime method `LiveDataHandler.set_strategy()` delegates to DecisionEngine -> TradingProcessor.

## Extensibility
To add a new strategy:
1. Implement logic inside shared strategy config & decision routine.
2. Ensure `TradingProcessor.trading_strategy` loads updated metrics or config.
3. No changes needed in simulation or live orchestrators (they already delegate).

## Testing Ideas
- Feed synthetic snapshots to TradingProcessor in a unit test for win / lose / full_refund / partial_refund.
- Replay a small recorded session JSON through simulation then transform snapshots sequentially to mimic live stream; assert identical decision & pnl.

---
Generated automatically to reflect current unified design. Keep this updated as schema or logic evolves.
