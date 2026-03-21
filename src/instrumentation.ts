export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { initCronJobs } = await import("./lib/cron");
      initCronJobs();
    } catch (error) {
      console.error("[Instrumentation] Failed to initialize cron jobs:", error);
    }
  }
}
