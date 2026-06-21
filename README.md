<img width="1518" height="790" alt="cowabunga" src="https://github.com/user-attachments/assets/82ca2ac6-cfc9-493e-ba2b-e8ce97442d4a" />

# cowabunga
classic arcade games built with claude code web and phaser. sent from my iphone

<img width="1445" height="1445" alt="tmnt" src="https://github.com/user-attachments/assets/8671c6df-1377-43e4-b080-87e5b0a88814" />

## Development

```sh
npm install
npm run dev          # dev server (HMR)
npm run build        # typecheck + production build
```

See [`CLAUDE.md`](CLAUDE.md) for the architecture and how to add a game.

## Testing

Games are verified headlessly by the agentic test harness in
[`src/shared/testkit/`](src/shared/testkit/README.md) — every game exposes a
test surface, so its rules can be checked without a human.

```sh
npm run test:game -- arkanoid     # headless scenario suite (also: galaga)
npm run fuzz:game -- arkanoid 15  # invariant-checked random-play soak (15s)
npm test                          # pure-logic unit tests (vitest)
```

**Adding a game includes adding its test surface + scenarios** — see the
checklist in [`src/shared/testkit/README.md`](src/shared/testkit/README.md).
