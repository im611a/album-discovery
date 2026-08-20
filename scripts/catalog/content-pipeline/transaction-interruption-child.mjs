import { promoteTransaction } from "./transaction.mjs";

process.on("message", async (message) => {
  try {
    await promoteTransaction({
      transactionRoot: message.transactionRoot,
      faultInjector: async (point) => {
        if (point === message.interruptionPoint) {
          process.send?.({ type: "INTERRUPTION_BOUNDARY_REACHED", point });
          await new Promise(() => {});
        }
      },
    });
    process.send?.({ type: "UNEXPECTED_COMPLETION" });
  } catch (error) {
    process.send?.({ type: "UNEXPECTED_CAUGHT_FAILURE", message: error.message });
  }
});
