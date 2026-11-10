// Local demo only. The ordinary production entry point leaves this feature off.
process.env.QIXIA_DEMO_ENABLED='1';
await import('../src/server.mjs');
