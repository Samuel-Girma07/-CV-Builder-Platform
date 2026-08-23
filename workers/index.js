const reminderWorker = require('./reminders');
const digestWorker = require('./digest');

/** Register every worker + schedule after the queue has started. */
async function init() {
  await reminderWorker.register();
  await reminderWorker.recoverOverdue();
  await digestWorker.registerSchedule();
}

module.exports = { init };
