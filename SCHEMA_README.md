# Live Demo & Simulation Unified Trading Logic

This document summarizes the unified architecture between simulation (`analyst/simulation/simulate_nomd5.py`) and live demo (`live_demo/run_live_demo.py`).

---

## Core Components

**TradingProcessor** (single shared logic):

- Loads strategy / metrics
- Makes betting decisions (`make_betting_decision`)
- Performs settlement (`process_settlement`) with balanced pot + refund handling
- Maintains balance & stats in memory

**DecisionEngine** (live wrapper):

- Collects streaming snapshots per session
- Delegates decision & settlement to `TradingProcessor`
- Persists bet history + balance snapshots to Firebase

## Countdown Normalization

Unified rule applied before each decision / settlement:

`countdown = 5 + (n - 1 - idx)`

Where:

- `n` = total snapshots in the session
- `idx` = zero-based index of the snapshot

So the final snapshot always has `countdown = 5`.

Simulation builds all snapshots eagerly and applies the formula immediately. Live ingestion normalizes right before decision/settlement.

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

## Frontend Balance Fallback Order

1. Use `/live_demo/balance_logs` (chronological series)
2. Else synthesize from bet history cumulative `pnl` or explicit `balance_after_settlement`
3. Else fallback single snapshot from `/live_demo_balance` (now implemented in `dashboard.js`)

## Strategy Overrides

- Simulation: CLI flags `--strategy`, `--timepoint` → `TradingProcessor.update_strategy`
- Live: `LiveDataHandler.set_strategy()` → DecisionEngine → `TradingProcessor`

## Extensibility Path

1. Add/adjust strategy logic only inside shared strategy & processor methods
2. Reload / hot-swap metrics in `TradingProcessor` (future: dynamic reload hook)
3. No orchestrator changes required (simulation & live already delegate)

## Suggested Tests

- Synthetic snapshot sequences for: win / lose / full_refund / partial_refund (win & lose variants)
- Replay recorded session both (a) full batch via simulation and (b) streamed snapshot-by-snapshot via DecisionEngine; assert identical final balance and per-session PnL

---

Generated automatically to reflect current unified design. Keep this updated as schema or logic evolves.
